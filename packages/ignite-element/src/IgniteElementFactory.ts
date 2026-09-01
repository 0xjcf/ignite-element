import type { CommandMetadata, IgniteAdapter } from "@ignite-element/core";
import { StateScope } from "@ignite-element/core";
import type { RenderStrategyFactory } from "@ignite-element/renderer";
import IgniteElement, {
	type IgniteElementLifecycleHooks,
} from "./IgniteElement";
import {
	commitProjectionDocumentTarget,
	commitProjectionSpeechTarget,
	createProjectionBindingState,
	createProjectionDocument,
	createProjectionSpeech,
	type ProjectionInspection,
} from "./internal/projectionBinding";
import "./renderers/ignite-jsx";
import type { IgniteComponent } from "./igniteCore/types";
import {
	parseProjectionDocumentCollection,
	parseProjectionSpeechRequest,
} from "./internal/projectionDocument";
import { resolveConfiguredRenderStrategy } from "./renderers/resolveConfiguredRenderStrategy";
import {
	createAgentRuntime,
	type IgniteDomBridgeOptions,
	igniteRuntimeHostOverrideSymbol,
} from "./runtime/agent";
import { commandMetadataSymbol } from "./runtime/commands";
import { facadeCleanupSymbol } from "./runtime/effects";
import { resolveProjectionTarget } from "./runtime/projectionTargets";
import { toInspectableSchemaValue, toSchemaValue } from "./runtime/schema";
import type {
	IgniteAgentSubscription,
	IgniteProjectionSession,
	IgniteProjectionTarget,
	IgniteStoryLifecycleEntry,
	IgniteStoryLifecycleScope,
	IgniteStoryLifecycleStage,
} from "./types/agent";
import type { IgniteSchemaValue } from "./types/schema";

export type BaseRenderArgs<State, Event> = {
	state: State;
	send: (event: Event) => void;
};

export type IgniteRenderArgs<State, Event> = BaseRenderArgs<State, Event>;

type AdditionalRenderArgs<
	State,
	Event,
	RenderArgs extends BaseRenderArgs<State, Event>,
> = Omit<RenderArgs, keyof BaseRenderArgs<State, Event>>;

type RendererObject<RenderArgs, View> = {
	render: (args: RenderArgs) => View;
};

export type ComponentRenderer<RenderArgs, View = unknown> =
	| ((args: RenderArgs) => View)
	| RendererObject<RenderArgs, View>
	| (new () => RendererObject<RenderArgs, View>);

export type ComponentFactory<
	State,
	Event,
	RenderArgs extends BaseRenderArgs<State, Event> = BaseRenderArgs<
		State,
		Event
	>,
	View = unknown,
> = (
	elementName: string,
	renderer: ComponentRenderer<RenderArgs, View>,
) => void;

export type AdapterPack<Factory> = Factory extends ComponentFactory<
	infer _State,
	infer _Event,
	infer RenderArgs,
	infer _View
>
	? RenderArgs
	: "__igniteRenderArgs" extends keyof Factory
		? Factory extends {
				readonly __igniteRenderArgs?: infer RenderArgs;
			}
			? Exclude<RenderArgs, undefined>
			: never
		: Factory extends (elementName: string, renderer: infer Renderer) => unknown
			? Renderer extends ComponentRenderer<infer RenderArgs, infer _View>
				? RenderArgs
				: Renderer extends (args: infer RenderArgs) => unknown
					? RenderArgs
					: never
			: never;

type FactoryOptions<
	State,
	Event,
	RenderArgs extends BaseRenderArgs<State, Event>,
	RuntimeStates extends Record<string, unknown>,
	View,
> = {
	scope?: StateScope;
	eventTypes?: readonly string[];
	createAdditionalArgs?: (
		adapter: IgniteAdapter<State, Event>,
		host?: EventTarget,
	) => AdditionalRenderArgs<State, Event, RenderArgs>;
	resolveStates?: (adapter: IgniteAdapter<State, Event>) => RuntimeStates;
	resolveInspection?: (adapter: IgniteAdapter<State, Event>) => {
		snapshot: unknown;
		states: RuntimeStates;
	};
	resolveDeliveredStates?: (snapshot: State) => RuntimeStates;
	createRenderArgs?: (
		snapshot: State,
		send: (event: Event) => void,
		additionalArgs: AdditionalRenderArgs<State, Event, RenderArgs>,
	) => RenderArgs;
	createRenderStrategy?: RenderStrategyFactory<View>;
	cleanup?: boolean;
};

function getCommandMetadata(
	commandValue: unknown,
): CommandMetadata | undefined {
	if (typeof commandValue !== "function") {
		return undefined;
	}

	const metadata = Reflect.get(commandValue, commandMetadataSymbol);
	if (
		typeof metadata === "undefined" ||
		metadata === null ||
		Array.isArray(metadata) ||
		typeof metadata !== "object"
	) {
		return undefined;
	}

	return metadata;
}

function hasCanExecute(
	metadata: CommandMetadata | undefined,
): metadata is CommandMetadata & {
	canExecute: NonNullable<CommandMetadata["canExecute"]>;
} {
	return typeof metadata?.canExecute === "function";
}

function getCommandContract(
	commandValue: unknown,
): Record<string, IgniteSchemaValue> | undefined {
	const metadata = getCommandMetadata(commandValue);
	if (!metadata) {
		return undefined;
	}

	const contract = toSchemaValue(metadata);
	const commandContract =
		contract !== null &&
		typeof contract === "object" &&
		!Array.isArray(contract)
			? contract
			: undefined;

	if (hasCanExecute(metadata)) {
		return {
			...(commandContract ?? {}),
			gated: true,
		};
	}

	return commandContract;
}

function getAdditionalArg(
	additionalArgs: object,
	commandName: string,
): unknown {
	return Reflect.get(additionalArgs, commandName);
}

function createCommandSchemaEntry(
	name: string,
	commandValue: unknown,
): [string, Record<string, IgniteSchemaValue>] {
	return [name, getCommandContract(commandValue) ?? {}];
}

function getOwnCommandEntries(value: object): Array<[string, unknown]> {
	const entries: Array<[string, unknown]> = [];
	for (const name of Object.keys(value)) {
		const descriptor = Object.getOwnPropertyDescriptor(value, name);
		if (
			descriptor &&
			"value" in descriptor &&
			typeof descriptor.value === "function"
		) {
			entries.push([name, descriptor.value]);
		}
	}
	return entries;
}

/**
 * Expose command functions from additionalArgs as methods on the custom element.
 * Commands are identified as enumerable own properties that are functions with
 * a value descriptor (not getters, which are view/state projections).
 */
function exposeCommands(
	element: HTMLElement,
	additionalArgs: Record<string, unknown>,
): void {
	for (const key of Object.keys(additionalArgs)) {
		const descriptor = Object.getOwnPropertyDescriptor(additionalArgs, key);
		if (
			descriptor &&
			"value" in descriptor &&
			typeof descriptor.value === "function"
		) {
			(element as unknown as Record<string, unknown>)[key] = descriptor.value;
		}
	}
}

/**
 * Infer observed attributes from single-arg `setX` commands.
 * Convention: command `setRepo(value)` → attribute `repo`.
 * Only commands with exactly 1 parameter and name starting with "set" qualify.
 */
function inferObservedAttributes(
	additionalArgs: Record<string, unknown>,
): Map<string, string> {
	const attrToCommand = new Map<string, string>();
	for (const key of Object.keys(additionalArgs)) {
		const descriptor = Object.getOwnPropertyDescriptor(additionalArgs, key);
		if (
			descriptor &&
			"value" in descriptor &&
			typeof descriptor.value === "function" &&
			key.length > 3 &&
			key.startsWith("set") &&
			key[3] === key[3].toUpperCase() &&
			(descriptor.value as (...args: unknown[]) => unknown).length === 1
		) {
			const attr = key[3].toLowerCase() + key.slice(4);
			attrToCommand.set(attr, key);
		}
	}
	return attrToCommand;
}

/**
 * Process initial attributes that were set before the element was upgraded.
 */
function processInitialAttributes(
	element: HTMLElement,
	attrMap: Map<string, string>,
): void {
	for (const [attr, commandName] of attrMap) {
		const value = element.getAttribute(attr);
		if (value !== null) {
			const fn = (
				element as unknown as Record<string, (...args: unknown[]) => unknown>
			)[commandName];
			fn?.(value);
		}
	}
}

/**
 * @internal Low-level custom-element factory used by `igniteCore`. Not part of
 * the public `ignite-element` surface — no package entry re-exports it.
 */
export default function igniteElementFactory<
	State,
	Event,
	RenderArgs extends BaseRenderArgs<State, Event> = BaseRenderArgs<
		State,
		Event
	>,
	RuntimeView extends Record<string, unknown> = Record<never, never>,
	View = unknown,
>(
	createAdapter: (host?: HTMLElement) => IgniteAdapter<State, Event>,
	options?: FactoryOptions<State, Event, RenderArgs, RuntimeView, View>,
): ComponentFactory<State, Event, RenderArgs, View> {
	type RuntimeAdditionalArgs = AdditionalRenderArgs<State, Event, RenderArgs>;
	type RuntimeHostOverrideBase = {
		host: EventTarget | null;
		additionalArgs: RuntimeAdditionalArgs | null;
		sharedRuntimeActive: boolean;
	};
	type RuntimeHostOverrideFrame = {
		host: EventTarget;
		additionalArgs: RuntimeAdditionalArgs;
		sharedRuntimeActive: boolean;
	};

	let sharedAdapter: IgniteAdapter<State, Event> | null = null;
	let sharedAdditionalArgs = new WeakMap<
		IgniteElement<State, Event, View>,
		RuntimeAdditionalArgs
	>();
	let sharedInstanceCount = 0;
	let sharedRuntimeActive = false;
	let sharedRuntimeAccessCount = 0;
	let sharedCleanupPending = false;
	let runtimeAdapter: IgniteAdapter<State, Event> | null = null;
	let runtimeAdditionalArgs: RuntimeAdditionalArgs | null = null;
	let runtimeHost: EventTarget | null = null;
	let runtimeHostOverrideBase: RuntimeHostOverrideBase | null = null;
	const runtimeHostOverrideFrames: RuntimeHostOverrideFrame[] = [];
	let lifecycleSequence = 0;
	let lifecycleInstanceSequence = 0;
	const lifecycleObservers = new Set<
		(entry: IgniteStoryLifecycleEntry) => void
	>();

	const createAdditionalArgs: (
		adapter: IgniteAdapter<State, Event>,
		host?: EventTarget,
	) => AdditionalRenderArgs<State, Event, RenderArgs> =
		options?.createAdditionalArgs ??
		((_) => ({}) as AdditionalRenderArgs<State, Event, RenderArgs>);

	const configuredFactory = resolveConfiguredRenderStrategy();
	const renderStrategyFactory: RenderStrategyFactory<View> =
		options?.createRenderStrategy ??
		(configuredFactory as RenderStrategyFactory<View>);
	const inferredScope =
		options?.scope ??
		(createAdapter as { scope?: StateScope }).scope ??
		StateScope.Isolated;
	// A consumer-owned shared source (an already-live instance passed to
	// igniteCore — a started actor, store, observable, or actor-web source) lives
	// for the core's lifetime, not any single element's. Releasing the shared
	// adapter when the element refcount transiently hits zero (e.g. an outlet
	// swapping pages, or test teardown) would freeze every consumer's reads. So
	// cleanup defaults to false for shared scope; isolated scope, where ignite
	// creates and owns one adapter per element, keeps per-element teardown.
	const cleanupSharedLifecycle =
		options?.cleanup ?? inferredScope !== StateScope.Shared;
	const eventTypes = options?.eventTypes ?? [];
	const resolveStates =
		options?.resolveStates ?? ((_) => Object.create(null) as RuntimeView);
	const resolveDeliveredStates =
		options?.resolveDeliveredStates ??
		((_) => Object.create(null) as RuntimeView);
	const resolveInspection =
		options?.resolveInspection ??
		((adapter: IgniteAdapter<State, Event>) => ({
			snapshot: adapter.getSnapshot(),
			states: resolveStates(adapter),
		}));
	const createRenderArgs =
		options?.createRenderArgs ??
		((
			snapshot: State,
			send: (event: Event) => void,
			additionalArgs: RuntimeAdditionalArgs,
		) =>
			({
				...additionalArgs,
				state: snapshot,
				send,
			}) as RenderArgs);
	const resolveLifecycleScope = (): IgniteStoryLifecycleScope =>
		inferredScope === StateScope.Shared ? "shared" : "isolated";

	const observeLifecycle = (
		handler: (entry: IgniteStoryLifecycleEntry) => void,
	) => {
		lifecycleObservers.add(handler);

		return {
			unsubscribe: () => {
				lifecycleObservers.delete(handler);
			},
		};
	};

	const recordLifecycle = (
		stage: IgniteStoryLifecycleStage,
		elementName: string,
		scope: IgniteStoryLifecycleScope,
		instanceId?: number,
	) => {
		if (lifecycleObservers.size === 0) {
			return;
		}

		lifecycleSequence += 1;
		const entry: IgniteStoryLifecycleEntry = {
			kind: "lifecycle",
			sequence: lifecycleSequence,
			stage,
			elementName,
			scope,
			...(typeof instanceId === "number" ? { instanceId } : {}),
		};

		for (const observer of lifecycleObservers) {
			observer(entry);
		}
	};

	const createLifecycleHooks = (
		elementName: string,
		scope: IgniteStoryLifecycleScope,
	): IgniteElementLifecycleHooks => {
		lifecycleInstanceSequence += 1;
		return {
			elementName,
			instanceId: lifecycleInstanceSequence,
			scope,
			record: recordLifecycle,
		};
	};

	const cleanupAdditionalArgs = (
		additionalArgs?: AdditionalRenderArgs<State, Event, RenderArgs> | null,
	) => {
		const cleanup = (
			additionalArgs as
				| (AdditionalRenderArgs<State, Event, RenderArgs> & {
						[facadeCleanupSymbol]?: () => void;
				  })
				| null
				| undefined
		)?.[facadeCleanupSymbol];
		cleanup?.();
	};

	const resolveSharedResources = (): {
		adapter: IgniteAdapter<State, Event>;
	} => {
		if (!sharedAdapter) {
			const adapter = createAdapter();
			adapter.scope = StateScope.Shared;
			sharedAdapter = adapter;
		}

		return {
			adapter: sharedAdapter,
		};
	};

	const resolveSharedAdditionalArgs = (
		host: IgniteElement<State, Event, View>,
	): AdditionalRenderArgs<State, Event, RenderArgs> => {
		const { adapter } = resolveSharedResources();
		let existing = sharedAdditionalArgs.get(host);
		if (!existing) {
			existing = createAdditionalArgs(adapter, host);
			sharedAdditionalArgs.set(host, existing);
		}
		return existing;
	};

	const releaseSharedResources = () => {
		if (!sharedAdapter) {
			return;
		}

		const adapterToStop = sharedAdapter;
		const runtimeArgsToCleanup = runtimeAdditionalArgs;
		let releaseError: unknown;
		try {
			if (runtimeArgsToCleanup) {
				cleanupAdditionalArgs(runtimeArgsToCleanup);
			}
		} catch (error) {
			releaseError = error;
		}
		try {
			adapterToStop.stop();
		} catch (error) {
			releaseError ??= error;
		} finally {
			sharedAdapter = null;
			sharedAdditionalArgs = new WeakMap();
			sharedInstanceCount = 0;
			sharedRuntimeAccessCount = 0;
			sharedRuntimeActive = false;
			sharedCleanupPending = false;
			runtimeAdditionalArgs = null;
			runtimeHost = null;
		}
		if (releaseError !== undefined) {
			throw releaseError;
		}
	};

	// The headless agent runtime only needs EventTarget APIs for `on()` and
	// effect-emitted events. The DOM render path creates its own real element.
	const createRuntimeHost = (): EventTarget =>
		typeof document === "undefined"
			? new EventTarget()
			: document.createElement("div");

	const createRuntimeDomBridge = (
		renderer: ComponentRenderer<RenderArgs, View>,
		options?: IgniteDomBridgeOptions,
	) => {
		const { adapter, additionalArgs } = resolveRuntimeResources();
		retainRuntimeAccess();
		const bridgeHost = document.createElement("div");
		const bridgeRoot = bridgeHost.attachShadow({ mode: "open" });
		const strategy = renderStrategyFactory();
		const render = resolveRenderer(renderer);
		const bridgeElementName = options?.elementName ?? "ignite-test-bridge";
		const lifecycleHooks = createLifecycleHooks(
			bridgeElementName,
			resolveLifecycleScope(),
		);
		let active = true;

		strategy.attach(bridgeRoot);
		document.body.appendChild(bridgeHost);
		recordLifecycle(
			"connected",
			bridgeElementName,
			lifecycleHooks.scope,
			lifecycleHooks.instanceId,
		);

		const renderCurrent = (snapshot: State) => {
			strategy.render(
				render(
					createRenderArgs(
						snapshot,
						(event) => adapter.send(event),
						additionalArgs,
					),
				),
			);
			recordLifecycle(
				"rendered",
				bridgeElementName,
				lifecycleHooks.scope,
				lifecycleHooks.instanceId,
			);
		};

		const subscription = adapter.subscribeSnapshots((snapshot) => {
			if (!active) {
				return;
			}

			renderCurrent(snapshot);
		});

		renderCurrent(adapter.getSnapshot());

		return {
			host: bridgeHost,
			root: bridgeRoot,
			stop() {
				if (!active) {
					return;
				}

				active = false;
				try {
					subscription.unsubscribe();
					recordLifecycle(
						"disconnected",
						bridgeElementName,
						lifecycleHooks.scope,
						lifecycleHooks.instanceId,
					);
					strategy.detach?.();
					bridgeHost.remove();
					recordLifecycle(
						"cleaned-up",
						bridgeElementName,
						lifecycleHooks.scope,
						lifecycleHooks.instanceId,
					);
				} finally {
					releaseRuntimeAccess();
				}
			},
		};
	};

	const resolveRuntimeAdapter = () => {
		if (inferredScope === StateScope.Shared) {
			const { adapter } = resolveSharedResources();
			return adapter;
		}

		if (!runtimeAdapter) {
			runtimeAdapter = createAdapter();
			runtimeAdapter.scope ??= StateScope.Isolated;
		}

		return runtimeAdapter;
	};

	const resolveRuntimeResources = () => {
		const adapter = resolveRuntimeAdapter();

		if (!runtimeHost || !runtimeAdditionalArgs) {
			runtimeHost = createRuntimeHost();
			runtimeAdditionalArgs = createAdditionalArgs(adapter, runtimeHost);
		}

		return {
			adapter,
			additionalArgs: runtimeAdditionalArgs,
			host: runtimeHost,
		};
	};
	const retainRuntimeAccess = () => {
		if (inferredScope !== StateScope.Shared) {
			return;
		}

		sharedRuntimeAccessCount += 1;
		sharedRuntimeActive = true;
	};
	const releaseRuntimeAccess = () => {
		if (inferredScope !== StateScope.Shared) {
			return;
		}

		if (sharedRuntimeAccessCount > 0) {
			sharedRuntimeAccessCount -= 1;
		}
		sharedRuntimeActive = sharedRuntimeAccessCount > 0;
		if (
			sharedCleanupPending &&
			cleanupSharedLifecycle &&
			sharedInstanceCount === 0 &&
			sharedRuntimeAccessCount === 0
		) {
			try {
				releaseSharedResources();
			} catch (error) {
				console.error(
					"[IgniteElement] Deferred disconnect cleanup failed.",
					error,
				);
			}
		}
	};

	const withRuntimeHost = <Result>(
		host: EventTarget,
		callback: () => Result,
	): Result => {
		const previousRuntimeHost = runtimeHost;
		const previousRuntimeAdditionalArgs = runtimeAdditionalArgs;
		const previousSharedRuntimeActive = sharedRuntimeActive;
		const previousRuntimeHostOverrideBase = runtimeHostOverrideBase;
		const previousRuntimeHostOverrideFrameCount =
			runtimeHostOverrideFrames.length;
		const baseFrame =
			runtimeHostOverrideFrames.length === 0
				? {
						host: runtimeHost,
						additionalArgs: runtimeAdditionalArgs,
						sharedRuntimeActive,
					}
				: null;
		let frame: RuntimeHostOverrideFrame | null = null;

		let restored = false;
		const restore = () => {
			if (restored || !frame) {
				return;
			}
			restored = true;
			const frameToRestore = frame;

			const frameIndex = runtimeHostOverrideFrames.indexOf(frameToRestore);
			if (frameIndex !== -1) {
				runtimeHostOverrideFrames.splice(frameIndex, 1);
			}
			const activeFrame =
				runtimeHostOverrideFrames[runtimeHostOverrideFrames.length - 1];
			if (activeFrame) {
				runtimeHost = activeFrame.host;
				runtimeAdditionalArgs = activeFrame.additionalArgs;
				sharedRuntimeActive = activeFrame.sharedRuntimeActive;
				cleanupAdditionalArgs(frameToRestore.additionalArgs);
				return;
			}

			runtimeHost = runtimeHostOverrideBase?.host ?? null;
			runtimeAdditionalArgs = runtimeHostOverrideBase?.additionalArgs ?? null;
			sharedRuntimeActive =
				runtimeHostOverrideBase?.sharedRuntimeActive ?? false;
			runtimeHostOverrideBase = null;
			cleanupAdditionalArgs(frameToRestore.additionalArgs);
		};
		const rollbackSetup = () => {
			runtimeHost = previousRuntimeHost;
			runtimeAdditionalArgs = previousRuntimeAdditionalArgs;
			sharedRuntimeActive = previousSharedRuntimeActive;
			runtimeHostOverrideBase = previousRuntimeHostOverrideBase;
			runtimeHostOverrideFrames.length = previousRuntimeHostOverrideFrameCount;
		};
		const isThenable = (value: unknown): value is PromiseLike<unknown> =>
			(typeof value === "object" || typeof value === "function") &&
			value !== null &&
			"then" in value &&
			typeof (value as { then?: unknown }).then === "function";
		const restoreAfterSuccess = (message: string) => {
			try {
				restore();
			} catch (restoreError) {
				console.error(message, restoreError);
			}
		};

		try {
			const adapter = resolveRuntimeAdapter();
			const additionalArgs = createAdditionalArgs(adapter, host);
			if (runtimeHostOverrideFrames.length === 0) {
				runtimeHostOverrideBase = baseFrame;
			}

			frame = {
				host,
				additionalArgs,
				sharedRuntimeActive,
			};
			runtimeHostOverrideFrames.push(frame);
			runtimeHost = frame.host;
			runtimeAdditionalArgs = frame.additionalArgs;

			const result = callback();
			if (isThenable(result)) {
				return result.then(
					(value) => {
						restoreAfterSuccess(
							"[igniteElementFactory] Runtime host restore failed after callback resolution.",
						);
						return value;
					},
					(error) => {
						try {
							restore();
						} catch (restoreError) {
							console.error(
								"[igniteElementFactory] Runtime host restore failed after callback error.",
								restoreError,
							);
						}
						throw error;
					},
				) as Result;
			}

			restoreAfterSuccess(
				"[igniteElementFactory] Runtime host restore failed after callback completion.",
			);
			return result;
		} catch (error) {
			if (frame) {
				try {
					restore();
				} catch (restoreError) {
					console.error(
						"[igniteElementFactory] Runtime host restore failed after callback error.",
						restoreError,
					);
				}
			} else {
				rollbackSetup();
			}
			throw error;
		}
	};

	const isInspectableRecord = (
		value: unknown,
	): value is Record<string, unknown> =>
		typeof value === "object" && value !== null && !Array.isArray(value);
	type InspectablePropertyRead =
		| { found: false }
		| { found: true; safe: false }
		| { found: true; safe: true; value: unknown };
	const readInspectableProperty = (
		value: Record<string, unknown>,
		key: string,
	): InspectablePropertyRead => {
		let descriptor: PropertyDescriptor | undefined;
		try {
			descriptor = Object.getOwnPropertyDescriptor(value, key);
		} catch {
			return { found: true, safe: false };
		}
		if (!descriptor) {
			return { found: false };
		}
		if (!("value" in descriptor)) {
			return { found: true, safe: false };
		}
		const propertyValue: unknown = descriptor.value;
		return { found: true, safe: true, value: propertyValue };
	};
	type ProjectionDocumentsRead =
		| { found: false; safe: true }
		| {
				found: true;
				safe: boolean;
				value: readonly ProjectionInspection["documents"][number][];
		  };
	type ProjectionSpeechRead =
		| { found: false; safe: true }
		| {
				found: true;
				safe: boolean;
				value: ProjectionInspection["speech"];
		  };

	const readProjectionDocuments = (
		candidate: unknown,
	): ProjectionDocumentsRead => {
		if (!isInspectableRecord(candidate)) {
			return { found: false, safe: true };
		}

		const property = readInspectableProperty(candidate, "documents");
		if (!property.found) {
			return { found: false, safe: true };
		}
		if (!property.safe) {
			return { found: true, safe: false, value: [] };
		}

		const parsed = parseProjectionDocumentCollection(property.value);
		return {
			found: true,
			safe: parsed.ok,
			value: parsed.ok ? parsed.documents : [],
		};
	};

	const readProjectionSpeech = (candidate: unknown): ProjectionSpeechRead => {
		if (!isInspectableRecord(candidate)) {
			return { found: false, safe: true };
		}

		const property = readInspectableProperty(candidate, "speech");
		if (!property.found) {
			return { found: false, safe: true };
		}
		if (!property.safe) {
			return { found: true, safe: false, value: null };
		}

		const parsed = parseProjectionSpeechRequest(property.value);
		return {
			found: true,
			safe: parsed.ok,
			value: parsed.ok ? parsed.speech : null,
		};
	};

	const resolveProjectionState = (
		snapshot: unknown,
		states: unknown,
	): Pick<ProjectionInspection, "documents" | "speech"> & {
		inspectionDataSafe: boolean;
	} => {
		let inspectionDataSafe = true;
		const actorOwnedContainers = [snapshot];
		if (isInspectableRecord(snapshot)) {
			for (const key of ["context", "projection"]) {
				const property = readInspectableProperty(snapshot, key);
				if (property.found && property.safe) {
					actorOwnedContainers.push(property.value);
				} else if (property.found) {
					inspectionDataSafe = false;
				}
			}
		}

		const derivedStatesContainers = [states];
		if (isInspectableRecord(states)) {
			const property = readInspectableProperty(states, "projection");
			if (property.found && property.safe) {
				derivedStatesContainers.push(property.value);
			} else if (property.found) {
				inspectionDataSafe = false;
			}
		}
		const containers = [...actorOwnedContainers, ...derivedStatesContainers];

		let documents:
			| readonly ProjectionInspection["documents"][number][]
			| undefined;
		let speech: ProjectionInspection["speech"] = null;
		let speechFound = false;

		for (const container of containers) {
			const documentsRead = readProjectionDocuments(container);
			inspectionDataSafe = inspectionDataSafe && documentsRead.safe;
			if (typeof documents === "undefined" && documentsRead.found) {
				documents = documentsRead.value;
			}

			const speechRead = readProjectionSpeech(container);
			inspectionDataSafe = inspectionDataSafe && speechRead.safe;
			if (!speechFound && speechRead.found) {
				speech = speechRead.value;
				speechFound = true;
			}
		}

		return { documents: documents ?? [], speech, inspectionDataSafe };
	};

	const resolveProjectionInspection = (): ProjectionInspection => {
		const { adapter, additionalArgs } = resolveRuntimeResources();
		const commandEntries = getOwnCommandEntries(additionalArgs);
		const { snapshot, states } = resolveInspection(adapter);
		const projectionState = resolveProjectionState(snapshot, states);
		const schema = {
			commands: Object.fromEntries(
				commandEntries
					.map(([name, value]) => createCommandSchemaEntry(name, value))
					.sort(([left], [right]) => left.localeCompare(right)),
			),
			events: [...eventTypes].sort().map((type) => ({ type })),
			snapshot: projectionState.inspectionDataSafe
				? (toInspectableSchemaValue(snapshot) ?? null)
				: null,
			states: projectionState.inspectionDataSafe
				? (toInspectableSchemaValue(states) ?? null)
				: null,
		};
		const revision = JSON.stringify({
			snapshot: schema.snapshot,
			states: schema.states,
			commands: Object.keys(schema.commands),
		});

		return {
			snapshot,
			states,
			schema,
			canExecute: (commandName: string) => {
				const command = getAdditionalArg(additionalArgs, commandName);
				if (typeof command !== "function") {
					return false;
				}
				const metadata = getCommandMetadata(command);
				if (!hasCanExecute(metadata)) {
					return true;
				}
				return metadata.canExecute({ snapshot });
			},
			documents: projectionState.documents,
			speech: projectionState.speech,
			revision,
		};
	};
	const agentRuntime = createAgentRuntime<
		State,
		Event,
		RuntimeView,
		AdditionalRenderArgs<State, Event, RenderArgs>,
		ComponentRenderer<RenderArgs, View>
	>({
		createDomBridge: (renderer, options) =>
			createRuntimeDomBridge(renderer, options),
		eventTypes,
		observeLifecycle,
		retainRuntimeAccess,
		releaseRuntimeAccess,
		resolveInspection,
		resolveRuntime: resolveRuntimeResources,
		resolveDeliveredStates,
		resolveStates,
	});

	const bindProjectionTarget = (target: unknown): IgniteProjectionSession => {
		const targetConfiguration = resolveProjectionTarget(target);
		if (!targetConfiguration) {
			throw new Error(
				"[igniteElementFactory] The one-argument overload only accepts first-party projection targets.",
			);
		}

		let setupState: "installing" | "active" | "failed" | "disposed" =
			"installing";
		const bindingState = createProjectionBindingState();
		let commitQueue = Promise.resolve();
		let commitQueued = false;

		const commitCurrent = () => {
			if (setupState !== "active" || commitQueued) {
				return;
			}
			commitQueued = true;

			commitQueue = commitQueue
				.then(async () => {
					commitQueued = false;
					if (setupState !== "active") {
						return;
					}

					const inspection = resolveProjectionInspection();
					const fact =
						targetConfiguration.kind === "document"
							? await commitProjectionDocumentTarget({
									state: bindingState,
									inspection,
									projection: createProjectionDocument(
										targetConfiguration.documentId,
									),
									commitDocument: targetConfiguration.commitDocument,
								})
							: await commitProjectionSpeechTarget({
									state: bindingState,
									inspection,
									projection: createProjectionSpeech(),
									commitSpeech: targetConfiguration.commitSpeech,
									acknowledge: async (speech) => {
										const payload =
											targetConfiguration.resolveAcknowledgePayload?.(speech);
										const { additionalArgs } = resolveRuntimeResources();
										const command = getAdditionalArg(
											additionalArgs,
											targetConfiguration.acknowledgeCommandName,
										);
										if (typeof command !== "function") {
											throw new Error(
												`Unknown command "${targetConfiguration.acknowledgeCommandName}".`,
											);
										}
										await command(payload);
									},
								});

					if (fact.status === "error" || fact.status === "unsupported") {
						console.error(
							"[igniteElementFactory] Projection commit fact",
							fact,
						);
					}
				})
				.catch((error) => {
					console.error(
						"[igniteElementFactory] Projection commit failed unexpectedly.",
						error,
					);
				});
		};

		let subscription: IgniteAgentSubscription | undefined;
		try {
			subscription = agentRuntime.watchSnapshot(() => {
				if (setupState === "active") {
					commitCurrent();
				}
			});
			setupState = "active";
		} catch (error) {
			setupState = "failed";
			try {
				releaseRuntimeAccess();
			} catch (releaseError) {
				console.error(
					"[igniteElementFactory] Runtime access release failed after projection watcher setup error.",
					releaseError,
				);
			}
			throw error;
		}

		commitCurrent();

		return {
			dispose() {
				if (setupState !== "active") {
					return;
				}
				setupState = "disposed";
				const ownedSubscription = subscription;
				subscription = undefined;
				ownedSubscription?.unsubscribe();
			},
		};
	};

	const register = (
		elementNameOrTarget: string | IgniteProjectionTarget,
		renderer?: ComponentRenderer<RenderArgs, View>,
	): IgniteComponent | IgniteProjectionSession => {
		if (renderer === undefined) {
			return bindProjectionTarget(elementNameOrTarget);
		}
		const resolvedRenderer = renderer;

		if (typeof elementNameOrTarget !== "string") {
			throw new Error(
				"[igniteElementFactory] DOM registration requires an element name and renderer.",
			);
		}

		const elementName = elementNameOrTarget;
		// The handle delegates getSchema LAZILY: createAgentRuntime(...) is
		// Object.assign-ed onto `register` AFTER this body is defined, so we must
		// call through `register.getSchema()` at invocation time rather than
		// capturing it eagerly. This keeps the single agent-runtime builder the
		// sole schema source of truth (it resolves the runtime adapter on demand).
		const handle: IgniteComponent = {
			tagName: elementName,
			getSchema: () => agentRuntime.getSchema(),
		};

		if (customElements.get(elementName)) {
			return handle;
		}

		const lifecycleScope = resolveLifecycleScope();

		// Attribute observation is set up per-instance after commands are resolved.
		// We use MutationObserver since observedAttributes must be static and
		// commands aren't known until the adapter is created.
		const setupAttributeObservation = (
			element: HTMLElement,
		): (() => void) | undefined => {
			const map = inferObservedAttributes(
				element as unknown as Record<string, unknown>,
			);
			if (map.size === 0) return undefined;
			processInitialAttributes(element, map);
			const observer = new MutationObserver((mutations) => {
				for (const mutation of mutations) {
					if (mutation.type !== "attributes" || !mutation.attributeName)
						continue;
					const commandName = map.get(mutation.attributeName);
					if (!commandName) continue;
					const fn = (
						element as unknown as Record<
							string,
							(...args: unknown[]) => unknown
						>
					)[commandName];
					if (fn) fn(element.getAttribute(mutation.attributeName));
				}
			});
			observer.observe(element, {
				attributes: true,
				attributeFilter: [...map.keys()],
			});
			return () => observer.disconnect();
		};

		if (inferredScope === StateScope.Shared) {
			const render = resolveRenderer(resolvedRenderer);
			resolveSharedResources();

			class SharedIgniteComponent extends IgniteElement<State, Event, View> {
				private additionalArgs: AdditionalRenderArgs<State, Event, RenderArgs>;
				private readonly lifecycleHooks: IgniteElementLifecycleHooks;
				private disconnectAttrObserver: (() => void) | undefined;

				constructor() {
					const { adapter } = resolveSharedResources();
					const lifecycleHooks = createLifecycleHooks(
						elementName,
						lifecycleScope,
					);
					super(adapter, renderStrategyFactory(), lifecycleHooks);
					this.lifecycleHooks = lifecycleHooks;
					this.additionalArgs = resolveSharedAdditionalArgs(this);
				}

				connectedCallback(): void {
					const reconnectedBeforeTeardown = this.hasPendingDisconnectTeardown;
					const { adapter } = resolveSharedResources();
					if (this.adapter !== adapter) {
						this.initializeAdapter(adapter);
					}
					this.additionalArgs = resolveSharedAdditionalArgs(this);
					exposeCommands(this, this.additionalArgs as Record<string, unknown>);
					this.disconnectAttrObserver ??= setupAttributeObservation(this);
					if (!reconnectedBeforeTeardown) {
						sharedInstanceCount += 1;
					}
					super.connectedCallback();
				}

				disconnectedCallback(): void {
					super.disconnectedCallback();
				}

				protected onTrueDisconnect(): void {
					this.disconnectAttrObserver?.();
					this.disconnectAttrObserver = undefined;
					const additionalArgs = this.additionalArgs;
					recordLifecycle(
						"cleaned-up",
						elementName,
						lifecycleScope,
						this.lifecycleHooks.instanceId,
					);
					sharedAdditionalArgs.delete(this);

					if (sharedInstanceCount > 0) {
						sharedInstanceCount -= 1;
					}

					if (
						cleanupSharedLifecycle &&
						sharedInstanceCount === 0 &&
						!sharedRuntimeActive
					) {
						releaseSharedResources();
					} else if (
						cleanupSharedLifecycle &&
						sharedInstanceCount === 0 &&
						sharedRuntimeActive
					) {
						sharedCleanupPending = true;
					}
					cleanupAdditionalArgs(additionalArgs);
				}

				protected renderView(): View {
					return render(
						createRenderArgs(
							this.currentState,
							(event) => this.send(event),
							this.additionalArgs,
						),
					);
				}
			}

			customElements.define(elementName, SharedIgniteComponent);
			recordLifecycle("registered", elementName, lifecycleScope);
			return handle;
		}

		class IsolatedIgniteComponent extends IgniteElement<State, Event, View> {
			private additionalArgs:
				| AdditionalRenderArgs<State, Event, RenderArgs>
				| undefined;
			private adapterInstance: IgniteAdapter<State, Event> | undefined;
			private readonly lifecycleHooks: IgniteElementLifecycleHooks;
			private readonly renderImpl: (args: RenderArgs) => View;
			private disconnectAttrObserver: (() => void) | undefined;

			constructor() {
				const lifecycleHooks = createLifecycleHooks(
					elementName,
					lifecycleScope,
				);
				super(undefined, renderStrategyFactory(), lifecycleHooks);
				this.lifecycleHooks = lifecycleHooks;
				this.renderImpl = resolveRenderer(resolvedRenderer);
			}

			connectedCallback(): void {
				if (!this.adapterInstance) {
					const adapter = createAdapter(this);
					adapter.scope ??= StateScope.Isolated;
					this.adapterInstance = adapter;
					this.additionalArgs = createAdditionalArgs(adapter, this);
					exposeCommands(this, this.additionalArgs as Record<string, unknown>);
					this.disconnectAttrObserver = setupAttributeObservation(this);
					this.initializeAdapter(adapter);
				}

				super.connectedCallback();
			}

			disconnectedCallback(): void {
				super.disconnectedCallback();
			}

			protected onTrueDisconnect(): void {
				this.disconnectAttrObserver?.();
				this.disconnectAttrObserver = undefined;
				const additionalArgs = this.additionalArgs;
				this.additionalArgs = undefined;
				this.adapterInstance = undefined;
				recordLifecycle(
					"cleaned-up",
					elementName,
					lifecycleScope,
					this.lifecycleHooks.instanceId,
				);
				cleanupAdditionalArgs(additionalArgs);
			}

			protected renderView(): View {
				if (!this.additionalArgs) {
					throw new Error(
						`[igniteElementFactory] Unable to render "${elementName}" before initialization.`,
					);
				}

				return this.renderImpl(
					createRenderArgs(
						this.currentState,
						(event) => this.send(event),
						this.additionalArgs,
					),
				);
			}
		}

		customElements.define(elementName, IsolatedIgniteComponent);
		recordLifecycle("registered", elementName, lifecycleScope);
		return handle;
	};

	Object.assign(register, agentRuntime, {
		[igniteRuntimeHostOverrideSymbol]: withRuntimeHost,
	});

	return register;

	function resolveRenderer(
		renderer: ComponentRenderer<RenderArgs, View>,
	): (args: RenderArgs) => View {
		if (typeof renderer === "function") {
			if (
				renderer.prototype &&
				typeof renderer.prototype.render === "function"
			) {
				const instance = new (
					renderer as new () => RendererObject<RenderArgs, View>
				)();
				return (args) => instance.render(args);
			}
			return renderer as (args: RenderArgs) => View;
		}

		if (renderer && typeof renderer === "object" && "render" in renderer) {
			const bound = renderer.render.bind(renderer);
			return (args) => bound(args);
		}

		throw new Error(
			"[igniteElementFactory] Invalid renderer provided. Supply a render function, an object with a render method, or a class with a render method.",
		);
	}
}

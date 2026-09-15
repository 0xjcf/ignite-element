import type { IgniteAdapter } from "@ignite-element/core";
import { StateScope } from "@ignite-element/core";
import type { RenderStrategyFactory } from "@ignite-element/renderer";
import {
	endElementRendering,
	getIgniteElementClasses,
	rollbackElementSetup,
} from "./IgniteElement";
import {
	commitProjectionDocumentTarget,
	commitProjectionSpeechTarget,
	createProjectionBindingState,
	createProjectionDocument,
	createProjectionSpeech,
	type ProjectionInspection,
} from "./internal/projectionBinding";
import { requireDomRegistration } from "./internal/requireDomRegistration";
import "./renderers/ignite-jsx";
import type { IgniteComponent } from "./igniteCore/types";
import {
	parseProjectionDocumentCollection,
	parseProjectionSpeechRequest,
} from "./internal/projectionDocument";
import { resolveConfiguredRenderStrategy } from "./renderers/resolveConfiguredRenderStrategy";
import { createAgentRuntime } from "./runtime/agent";
import {
	registerBindingStore,
	registerElementCommands,
	setCommandOwner,
} from "./runtime/bindings";
import { deferHostEffects, facadeCleanupSymbol } from "./runtime/effects";
import { createEventOrigins } from "./runtime/eventOrigins";
import { forwardNativeEvents } from "./runtime/nativeEvents";
import { createLifetime, releaseAll } from "./runtime/lifetime";
import { resolveProjectionTarget } from "./runtime/projectionTargets";
import { toInspectableSchemaValue } from "./runtime/schema";
import type {
	IgniteAgentSubscription,
	IgniteProjectionSession,
	IgniteProjectionTarget,
} from "./types/agent";
import type {
	BaseRenderArgs,
	ComponentRenderer,
	RendererObject,
} from "./types/render";
import type { IgniteSchemaValue } from "./types/schema";

export type { BaseRenderArgs, ComponentRenderer } from "./types/render";

export type IgniteRenderArgs<State, Event> = BaseRenderArgs<State, Event>;

type AdditionalRenderArgs<
	State,
	Event,
	RenderArgs extends BaseRenderArgs<State, Event>,
> = Omit<RenderArgs, keyof BaseRenderArgs<State, Event>>;

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
	hasCommands?: boolean;
	createAdditionalArgs?: (
		adapter: IgniteAdapter<State, Event>,
		host?: EventTarget,
		observeEffect?: (name: string) => void,
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
	void commandValue;
	return [name, { input: null }];
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
): () => void {
	const previous = new Map<string, PropertyDescriptor | undefined>();
	const release = () => {
		registerElementCommands(element, {});
		const descriptors = [...previous];
		previous.clear();
		releaseAll(
			descriptors.map(([key, descriptor]) => () => {
				if (descriptor) Object.defineProperty(element, key, descriptor);
				else Reflect.deleteProperty(element, key);
			}),
		);
	};
	registerElementCommands(element, additionalArgs);
	try {
		for (const key of Object.keys(additionalArgs)) {
			const descriptor = Object.getOwnPropertyDescriptor(additionalArgs, key);
			if (
				descriptor &&
				"value" in descriptor &&
				typeof descriptor.value === "function"
			) {
				previous.set(key, Object.getOwnPropertyDescriptor(element, key));
				(element as unknown as Record<string, unknown>)[key] = descriptor.value;
			}
		}
	} catch (error) {
		try {
			release();
		} catch (cleanupError) {
			console.error(
				"[IgniteElement] Command setup rollback failed.",
				cleanupError,
			);
		}
		throw error;
	}
	return release;
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
	const lifetime = createLifetime();
	const eventOrigins = createEventOrigins();
	lifetime.own(() => eventOrigins.dispose());
	let registrationInProgress = false;
	let acquiring = false;

	let sharedAdapter: IgniteAdapter<State, Event> | null = null;
	let runtimeAdapter: IgniteAdapter<State, Event> | null = null;
	let runtimeAdditionalArgs: RuntimeAdditionalArgs | null = null;
	let runtimeHost: EventTarget | null = null;
	let releaseRuntimeArgs: (() => void) | undefined;
	let connectedViews = 0;
	let runtimeUsers = 0;
	let cleanupRequested = false;

	const createAdditionalArgs: (
		adapter: IgniteAdapter<State, Event>,
		host?: EventTarget,
	) => AdditionalRenderArgs<State, Event, RenderArgs> = (adapter, host) => {
		const args =
			options?.createAdditionalArgs?.(adapter, host, (name) =>
				eventOrigins.observe(adapter, name, "effect"),
			) ?? ({} as AdditionalRenderArgs<State, Event, RenderArgs>);
		publishCatalogue(args);
		return args;
	};

	const inferredScope =
		options?.scope ??
		(createAdapter as { scope?: StateScope }).scope ??
		StateScope.Isolated;
	// A shared core owns its prepared observation until dispose(), independently
	// of temporary element/React borrowers. Isolated elements still own acquisition.
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

	// The headless agent runtime only needs EventTarget APIs for `on()` and
	// effect-emitted events. The DOM render path creates its own real element.
	const createRuntimeHost = (): EventTarget => {
		const host = new EventTarget();
		deferHostEffects(host);
		return host;
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

	const clearRuntime = () => {
		const adapter = runtimeAdapter ?? sharedAdapter;
		runtimeAdapter = null;
		sharedAdapter = null;
		runtimeAdditionalArgs = null;
		runtimeHost = null;
		adapter?.stop();
	};
	// Only explicit element cleanup may release a shared adapter early. A
	// prepared cache is not a permanent lease; actual framework/watch/on users are.
	const releaseUnusedSharedAdapter = () => {
		if (!lifetime.active || !cleanupRequested || connectedViews || runtimeUsers)
			return;
		const adapter = sharedAdapter,
			releaseArgs = releaseRuntimeArgs;
		sharedAdapter = null;
		runtimeAdditionalArgs = null;
		runtimeHost = null;
		releaseRuntimeArgs = undefined;
		cleanupRequested = false;
		releaseAll([
			releasePreparation,
			() => releaseArgs?.(),
			() => adapter?.stop(),
		]);
	};
	const rollbackNewAdapter = () => {
		// Shared factories cache a reusable wrapper over a borrowed source. Its
		// stop is terminal, not a release of this acquisition's observation handles.
		// Those handles are drained separately; keep the wrapper for retry/dispose.
		if (inferredScope !== StateScope.Shared) clearRuntime();
	};
	const dispose = () => {
		if (registrationInProgress)
			throw new Error("[igniteCore] Cannot dispose during registration.");
		lifetime.dispose(clearRuntime);
	};
	const resolveRuntimeResources = () => {
		lifetime.assertActive();
		if (acquiring)
			throw new Error("[igniteCore] Reentrant runtime acquisition.");
		acquiring = true;
		const existingAdapter = runtimeAdapter ?? sharedAdapter;
		let rollback = () => {};
		try {
			const adapter = resolveRuntimeAdapter();
			lifetime.assertActive();
			if (!runtimeHost || !runtimeAdditionalArgs) {
				runtimeHost = createRuntimeHost();
				const args = createAdditionalArgs(adapter, runtimeHost);
				setCommandOwner(args, lifetime.assertActive);
				const releaseArgs = lifetime.own(() => cleanupAdditionalArgs(args));
				releaseRuntimeArgs = releaseArgs;
				let rolledBack = false;
				rollback = () => {
					if (rolledBack) return;
					rolledBack = true;
					releaseAll([
						releaseArgs,
						() => {
							if (runtimeAdditionalArgs === args) {
								runtimeAdditionalArgs = null;
								runtimeHost = null;
							}
							// An already-acquired shared DOM adapter is not owned by this
							// failed headless preparation. Preserve its element consumers.
							if (!existingAdapter) rollbackNewAdapter();
						},
					]);
				};
				lifetime.assertActive();
				runtimeAdditionalArgs = args;
				publishCatalogue(args);
			}
			return {
				adapter,
				additionalArgs: runtimeAdditionalArgs,
				host: runtimeHost,
				rollback,
			};
		} catch (error) {
			try {
				releaseAll([
					rollback,
					() => {
						if (!existingAdapter && (runtimeAdapter || sharedAdapter))
							rollbackNewAdapter();
					},
				]);
			} catch (cleanupError) {
				console.error(
					"[igniteCore] Acquisition rollback failed.",
					cleanupError,
				);
			}
			throw error;
		} finally {
			acquiring = false;
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
				const availability =
					isInspectableRecord(states) &&
					isInspectableRecord(states.commandAvailability)
						? states.commandAvailability
						: undefined;
				return availability?.[commandName] !== false;
			},
			documents: projectionState.documents,
			speech: projectionState.speech,
			revision,
		};
	};
	const {
		runtime: agentRuntime,
		watchSnapshot,
		bindingStore,
		publishCatalogue,
		readCatalogue,
		releasePreparation,
	} = createAgentRuntime<
		State,
		Event,
		RuntimeView,
		AdditionalRenderArgs<State, Event, RenderArgs>
	>({
		eventTypes,
		hasCommands: options?.hasCommands,
		lifetime,
		dispose,
		resolveInspection,
		resolveRuntime: resolveRuntimeResources,
		observeNative: (adapter, name) =>
			eventOrigins.observe(adapter, name, "native"),
		resolveDeliveredStates,
		resolveStates,
		retainRuntimeAccess: () => {
			runtimeUsers++;
		},
		releaseRuntimeAccess: () => {
			runtimeUsers--;
			try {
				releaseUnusedSharedAdapter();
			} catch (error) {
				console.error(
					"[IgniteElement] Deferred disconnect cleanup failed.",
					error,
				);
			}
		},
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
			subscription = watchSnapshot(() => {
				if (setupState === "active") {
					commitCurrent();
				}
			});
			setupState = "active";
		} catch (error) {
			setupState = "failed";
			throw error;
		}

		commitCurrent();

		const release = lifetime.own(() => {
			if (setupState !== "active") {
				return;
			}
			setupState = "disposed";
			const ownedSubscription = subscription;
			subscription = undefined;
			ownedSubscription?.unsubscribe();
		});
		return { dispose: release };
	};

	const registerImpl = (
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
		const { ElementBase, registry } = requireDomRegistration();
		const handle: IgniteComponent = {
			tagName: elementName,
			get: readCatalogue,
		};

		if (registry.get(elementName)) {
			return handle;
		}
		const renderStrategyFactory =
			options?.createRenderStrategy ??
			(resolveConfiguredRenderStrategy() as RenderStrategyFactory<View>);
		const IgniteElement = getIgniteElementClasses(ElementBase).Element;

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
			try {
				observer.observe(element, {
					attributes: true,
					attributeFilter: [...map.keys()],
				});
			} catch (error) {
				try {
					observer.disconnect();
				} catch (cleanupError) {
					console.error(
						"[IgniteElement] Attribute setup rollback failed.",
						cleanupError,
					);
				}
				throw error;
			}
			return () => observer.disconnect();
		};

		if (inferredScope === StateScope.Shared) {
			const render = resolveRenderer(resolvedRenderer);
			class SharedIgniteComponent extends IgniteElement<State, Event, View> {
				private additionalArgs: RuntimeAdditionalArgs | undefined;
				private releaseCommands: (() => void) | undefined;
				private releaseOwner: (() => void) | undefined;
				private counted = false;
				private disconnectAttrObserver: (() => void) | undefined;
				private releaseNativeEvents: (() => void) | undefined;
				constructor() {
					super(undefined, renderStrategyFactory());
					if (lifetime.active) this.acquire();
				}
				private acquire(): void {
					if (this.additionalArgs) return;
					try {
						const { adapter } = resolveSharedResources();
						const args = createAdditionalArgs(adapter, this);
						this.additionalArgs = args;
						setCommandOwner(args, lifetime.assertActive);
						this.releaseCommands = exposeCommands(this, args);
						this.initializeAdapter(adapter);
						this.releaseOwner = lifetime.own(() => {
							if (!lifetime.active)
								releaseAll([
									() => endElementRendering(this),
									() => this.onTrueDisconnect(),
								]);
						});
					} catch (error) {
						try {
							releaseAll([
								() => rollbackElementSetup(this),
								() => this.onTrueDisconnect(),
							]);
						} catch (cleanupError) {
							console.error(
								"[IgniteElement] Connection rollback failed.",
								cleanupError,
							);
						}
						throw error;
					}
				}
				connectedCallback(): void {
					if (!lifetime.active) {
						endElementRendering(this);
						return;
					}
					try {
						this.acquire();
						const adapter = this.adapter;
						if (adapter && !this.releaseNativeEvents) {
							const release = forwardNativeEvents(
								adapter,
								this,
								eventTypes,
								(name) => eventOrigins.observe(adapter, name, "native"),
								lifetime,
							);
							if (!lifetime.active) {
								release();
								lifetime.assertActive();
							}
							this.releaseNativeEvents = release;
						}
						if (!this.counted) {
							this.counted = true;
							connectedViews++;
						}
						this.disconnectAttrObserver ??= setupAttributeObservation(this);
						super.connectedCallback();
					} catch (error) {
						try {
							releaseAll([
								() => rollbackElementSetup(this),
								() => this.onTrueDisconnect(),
							]);
						} catch (cleanupError) {
							console.error(
								"[IgniteElement] Connection rollback failed.",
								cleanupError,
							);
						}
						throw error;
					}
				}
				onTrueDisconnect(): void {
					const nativeEvents = this.releaseNativeEvents;
					this.releaseNativeEvents = undefined;
					const args = this.additionalArgs,
						commands = this.releaseCommands;
					const observer = this.disconnectAttrObserver,
						owner = this.releaseOwner;
					this.additionalArgs = undefined;
					this.releaseCommands = undefined;
					this.disconnectAttrObserver = undefined;
					this.releaseOwner = undefined;
					if (this.counted) {
						this.counted = false;
						connectedViews--;
						if (options?.cleanup && connectedViews === 0)
							cleanupRequested = true;
					}
					releaseAll([
						() => nativeEvents?.(),
						() => observer?.(),
						() => commands?.(),
						() => cleanupAdditionalArgs(args),
						() => owner?.(),
						releaseUnusedSharedAdapter,
					]);
				}
				renderView(): View {
					if (!this.additionalArgs)
						throw new Error("[igniteCore] View is not initialized.");
					return render(
						createRenderArgs(
							this.currentState,
							(event) => {
								lifetime.assertActive();
								this.send(event);
							},
							this.additionalArgs,
						),
					);
				}
			}

			registry.define(elementName, SharedIgniteComponent);
			return handle;
		}

		class IsolatedIgniteComponent extends IgniteElement<State, Event, View> {
			private releaseNativeEvents: (() => void) | undefined;
			private additionalArgs:
				| AdditionalRenderArgs<State, Event, RenderArgs>
				| undefined;
			private adapterInstance: IgniteAdapter<State, Event> | undefined;
			private readonly renderImpl: (args: RenderArgs) => View;
			private disconnectAttrObserver: (() => void) | undefined;
			private releaseCommands: (() => void) | undefined;
			private releaseOwner: (() => void) | undefined;

			constructor() {
				super(undefined, renderStrategyFactory());
				this.renderImpl = resolveRenderer(resolvedRenderer);
			}

			connectedCallback(): void {
				if (!lifetime.active) {
					endElementRendering(this);
					return;
				}
				const acquiring = !this.adapterInstance;
				try {
					if (!this.adapterInstance) {
						const adapter = createAdapter(this);
						adapter.scope ??= StateScope.Isolated;
						this.adapterInstance = adapter;
						this.additionalArgs = createAdditionalArgs(adapter, this);
						setCommandOwner(this.additionalArgs, lifetime.assertActive);
						this.releaseOwner = lifetime.own(() => {
							if (!lifetime.active)
								releaseAll([
									() => endElementRendering(this),
									() => this.onTrueDisconnect(),
									() => adapter.stop(),
								]);
						});
						this.releaseCommands = exposeCommands(
							this,
							this.additionalArgs as Record<string, unknown>,
						);
						this.disconnectAttrObserver = setupAttributeObservation(this);
						this.initializeAdapter(adapter);
					}

					const adapter = this.adapterInstance;
					if (adapter && !this.releaseNativeEvents) {
						const release = forwardNativeEvents(
							adapter,
							this,
							eventTypes,
							(name) => eventOrigins.observe(adapter, name, "native"),
							lifetime,
						);
						if (!lifetime.active) {
							release();
							lifetime.assertActive();
						}
						this.releaseNativeEvents = release;
					}
					super.connectedCallback();
				} catch (error) {
					if (acquiring) {
						const adapter = this.adapterInstance;
						try {
							releaseAll([
								() => rollbackElementSetup(this),
								() => this.onTrueDisconnect(),
								() => adapter?.stop(),
							]);
						} catch (cleanupError) {
							console.error(
								"[IgniteElement] Connection rollback failed.",
								cleanupError,
							);
						}
					}
					throw error;
				}
			}

			disconnectedCallback(): void {
				if (lifetime.active) super.disconnectedCallback();
			}

			public onTrueDisconnect(): void {
				const nativeEvents = this.releaseNativeEvents;
				this.releaseNativeEvents = undefined;
				const disconnectObserver = this.disconnectAttrObserver;
				const releaseCommands = this.releaseCommands;
				this.releaseCommands = undefined;
				this.disconnectAttrObserver = undefined;
				const additionalArgs = this.additionalArgs;
				const releaseOwner = this.releaseOwner;
				this.releaseOwner = undefined;
				this.additionalArgs = undefined;
				this.adapterInstance = undefined;
				releaseAll([
					() => nativeEvents?.(),
					() => disconnectObserver?.(),
					() => releaseCommands?.(),
					() => cleanupAdditionalArgs(additionalArgs),
					() => releaseOwner?.(),
				]);
			}

			public renderView(): View {
				if (!this.additionalArgs) {
					throw new Error(
						`[igniteElementFactory] Unable to render "${elementName}" before initialization.`,
					);
				}

				return this.renderImpl(
					createRenderArgs(
						this.currentState,
						(event) => {
							lifetime.assertActive();
							this.send(event);
						},
						this.additionalArgs,
					),
				);
			}
		}

		registry.define(elementName, IsolatedIgniteComponent);
		return handle;
	};

	const register = (
		target: string | IgniteProjectionTarget,
		renderer?: ComponentRenderer<RenderArgs, View>,
	) => {
		lifetime.assertActive();
		if (renderer === undefined) return registerImpl(target);
		if (registrationInProgress)
			throw new Error("[igniteCore] Reentrant registration.");
		registrationInProgress = true;
		try {
			return registerImpl(target, renderer);
		} finally {
			registrationInProgress = false;
		}
	};
	Object.assign(register, agentRuntime);
	registerBindingStore(register, bindingStore);

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

import type { IgniteAdapter } from "@ignite-element/core";
import { StateScope } from "@ignite-element/core";
import type { RenderStrategyFactory } from "@ignite-element/renderer";
import { coreHostsFor, readReducedMotion } from "./hosts/registry";
import {
	endElementRendering,
	getIgniteElementClasses,
	rollbackElementSetup,
} from "./IgniteElement";
import { assertSupportedSourceOptions } from "./internal/assertSupportedSourceOptions";
import { HOST_RUNTIME_FIELD } from "./internal/hostRuntime.js";
import { requireDomRegistration } from "./internal/requireDomRegistration";
import "./renderers/ignite-jsx";
import type { IgniteComponent } from "./igniteCore/types";
import { resolveConfiguredRenderStrategy } from "./renderers/resolveConfiguredRenderStrategy";
import { createAgentRuntime } from "./runtime/agent";
import {
	registerBindingStore,
	registerElementCommands,
	setCommandOwner,
} from "./runtime/bindings";
import { activateHostEffects, facadeCleanupSymbol } from "./runtime/effects";
import { createEventOrigins } from "./runtime/eventOrigins";
import { createLifetime, releaseAll } from "./runtime/lifetime";
import { forwardNativeEvents } from "./runtime/nativeEvents";
import type {
	BaseRenderArgs,
	ComponentRenderer,
	RendererObject,
} from "./types/render";

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
	disposeEffects?: () => void;
	createAdditionalArgs?: (
		adapter: IgniteAdapter<State, Event>,
		host?: EventTarget,
		observeEffect?: (name: string) => void,
	) => AdditionalRenderArgs<State, Event, RenderArgs>;
	resolveStates?: (adapter: IgniteAdapter<State, Event>) => RuntimeStates;
	resolveDeliveredStates?: (snapshot: State) => RuntimeStates;
	createRenderArgs?: (
		snapshot: State,
		send: (event: Event) => void,
		additionalArgs: AdditionalRenderArgs<State, Event, RenderArgs>,
	) => RenderArgs;
	createRenderStrategy?: RenderStrategyFactory<View>;
};

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
	assertSupportedSourceOptions(options);
	const coreHosts = coreHostsFor(createAdapter);
	const publishHosts = (
		element: EventTarget,
		snapshot: State,
		send: (event: Event) => void,
	) => {
		if (!coreHosts) {
			delete (element as unknown as Record<string, unknown>)[
				HOST_RUNTIME_FIELD
			];
			return;
		}
		Object.defineProperty(element, HOST_RUNTIME_FIELD, {
			configurable: true,
			enumerable: false,
			writable: true,
			value: {
				snapshot,
				send: (event: unknown) => send(event as Event),
				reducedMotion: readReducedMotion,
				hosts: coreHosts,
			},
		});
	};
	type RuntimeAdditionalArgs = AdditionalRenderArgs<State, Event, RenderArgs>;
	const lifetime = createLifetime();
	lifetime.own(() => options?.disposeEffects?.());
	const eventOrigins = createEventOrigins();
	lifetime.own(() => eventOrigins.dispose());
	let registrationInProgress = false;
	let acquiring = false;

	let sharedAdapter: IgniteAdapter<State, Event> | null = null;
	let runtimeAdapter: IgniteAdapter<State, Event> | null = null;
	let runtimeAdditionalArgs: RuntimeAdditionalArgs | null = null;
	let runtimeHost: EventTarget | null = null;

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
	const createBaseRenderArgs =
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
	const createRenderArgs = (
		snapshot: State,
		send: (event: Event) => void,
		additionalArgs: RuntimeAdditionalArgs,
	) => {
		const base = createBaseRenderArgs(snapshot, send, additionalArgs);
		if (!coreHosts) return base;
		const hosts = Object.create(null) as Record<string, string>;
		for (const name of Object.keys(coreHosts)) {
			Object.defineProperty(hosts, name, {
				value: name,
				enumerable: true,
				configurable: true,
				writable: true,
			});
		}
		return {
			...base,
			hosts,
		} as RenderArgs;
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

	// The headless agent runtime only needs EventTarget APIs for `on()` and
	// effect-emitted events. The DOM render path creates its own real element.
	const createRuntimeHost = (): EventTarget => {
		const host = new EventTarget();
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

	const {
		runtime: agentRuntime,
		bindingStore,
		publishCatalogue,
		readCatalogue,
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
		resolveRuntime: resolveRuntimeResources,
		observeNative: (adapter, name) =>
			eventOrigins.observe(adapter, name, "native"),
		resolveDeliveredStates,
		resolveStates,
	});

	const registerImpl = (
		elementName: string,
		renderer: ComponentRenderer<RenderArgs, View>,
	): IgniteComponent => {
		if (typeof elementName !== "string" || renderer === undefined) {
			throw new Error(
				"[igniteElementFactory] DOM registration requires an element name and renderer.",
			);
		}
		const resolvedRenderer = renderer;
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
						this.disconnectAttrObserver ??= setupAttributeObservation(this);
						super.connectedCallback();
						activateHostEffects(this);
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
					releaseAll([
						() => nativeEvents?.(),
						() => observer?.(),
						() => commands?.(),
						() => cleanupAdditionalArgs(args),
						() => owner?.(),
					]);
				}
				renderView(): View {
					if (!this.additionalArgs)
						throw new Error("[igniteCore] View is not initialized.");
					const send = (event: Event) => {
						lifetime.assertActive();
						this.send(event);
					};
					publishHosts(this, this.currentState, send);
					return render(
						createRenderArgs(this.currentState, send, this.additionalArgs),
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
					activateHostEffects(this);
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
				const send = (event: Event) => {
					lifetime.assertActive();
					this.send(event);
				};
				publishHosts(this, this.currentState, send);
				return this.renderImpl(
					createRenderArgs(this.currentState, send, this.additionalArgs),
				);
			}
		}

		registry.define(elementName, IsolatedIgniteComponent);
		return handle;
	};

	const register = (
		elementName: string,
		renderer: ComponentRenderer<RenderArgs, View>,
	) => {
		lifetime.assertActive();
		if (registrationInProgress)
			throw new Error("[igniteCore] Reentrant registration.");
		registrationInProgress = true;
		try {
			return registerImpl(elementName, renderer);
		} finally {
			registrationInProgress = false;
		}
	};
	Object.assign(register, agentRuntime);
	registerBindingStore(register, bindingStore, lifetime);

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

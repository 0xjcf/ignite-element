import type { IgniteAdapter } from "ignite-core";
import { StateScope } from "ignite-core";
import type { IgniteJsxChild, RenderStrategyFactory } from "ignite-renderer";
import type { TemplateResult } from "lit-html";
import IgniteElement, {
	type IgniteElementLifecycleHooks,
} from "./IgniteElement";
import "./renderers/ignite-jsx";
import { resolveConfiguredRenderStrategy } from "./renderers/resolveConfiguredRenderStrategy";
import { createAgentRuntime } from "./runtime/agent";
import { facadeCleanupSymbol } from "./runtime/effects";
import type {
	IgniteStoryLifecycleEntry,
	IgniteStoryLifecycleScope,
	IgniteStoryLifecycleStage,
} from "./types/agent";

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

export type ComponentRenderer<
	RenderArgs,
	View = TemplateResult | IgniteJsxChild,
> =
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
	View = TemplateResult | IgniteJsxChild,
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
	: Factory extends (
				elementName: string,
				renderFn: (args: infer RenderArgs) => TemplateResult,
			) => void
		? RenderArgs
		: never;

type FactoryOptions<
	State,
	Event,
	RenderArgs extends BaseRenderArgs<State, Event>,
	RuntimeView extends Record<string, unknown>,
	View,
> = {
	scope?: StateScope;
	eventTypes?: readonly string[];
	createAdditionalArgs?: (
		adapter: IgniteAdapter<State, Event>,
		host?: HTMLElement,
	) => AdditionalRenderArgs<State, Event, RenderArgs>;
	resolveView?: (adapter: IgniteAdapter<State, Event>) => RuntimeView;
	createRenderStrategy?: RenderStrategyFactory<View>;
	cleanup?: boolean;
};

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
		if (descriptor && "value" in descriptor && typeof descriptor.value === "function") {
			(element as unknown as Record<string, unknown>)[key] = descriptor.value;
		}
	}
}

export default function igniteElementFactory<
	State,
	Event,
	RenderArgs extends BaseRenderArgs<State, Event> = BaseRenderArgs<
		State,
		Event
	>,
	RuntimeView extends Record<string, unknown> = Record<never, never>,
	View = TemplateResult | IgniteJsxChild,
>(
	createAdapter: (host?: HTMLElement) => IgniteAdapter<State, Event>,
	options?: FactoryOptions<State, Event, RenderArgs, RuntimeView, View>,
): ComponentFactory<State, Event, RenderArgs, View> {
	let sharedAdapter: IgniteAdapter<State, Event> | null = null;
	let sharedAdditionalArgs = new WeakMap<
		IgniteElement<State, Event, View>,
		AdditionalRenderArgs<State, Event, RenderArgs>
	>();
	let sharedInstanceCount = 0;
	let sharedRuntimeActive = false;
	let runtimeAdapter: IgniteAdapter<State, Event> | null = null;
	let runtimeAdditionalArgs: AdditionalRenderArgs<
		State,
		Event,
		RenderArgs
	> | null = null;
	let runtimeHost: HTMLElement | null = null;
	let lifecycleSequence = 0;
	let lifecycleInstanceSequence = 0;
	const lifecycleObservers = new Set<
		(entry: IgniteStoryLifecycleEntry) => void
	>();

	const createAdditionalArgs: (
		adapter: IgniteAdapter<State, Event>,
		host?: HTMLElement,
	) => AdditionalRenderArgs<State, Event, RenderArgs> =
		options?.createAdditionalArgs ??
		((_) => ({}) as AdditionalRenderArgs<State, Event, RenderArgs>);

	const configuredFactory = resolveConfiguredRenderStrategy();
	const renderStrategyFactory: RenderStrategyFactory<View> =
		options?.createRenderStrategy ??
		(configuredFactory as RenderStrategyFactory<View>);
	const cleanupSharedLifecycle = options?.cleanup ?? true;
	const inferredScope =
		options?.scope ??
		(createAdapter as { scope?: StateScope }).scope ??
		StateScope.Isolated;
	const eventTypes = options?.eventTypes ?? [];
	const resolveView =
		options?.resolveView ?? ((_) => Object.create(null) as RuntimeView);
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

		sharedAdapter.stop();
		sharedAdapter = null;
		sharedAdditionalArgs = new WeakMap();
		sharedInstanceCount = 0;
	};

	const createRuntimeHost = () => document.createElement("div");

	const resolveRuntimeResources = () => {
		if (inferredScope === StateScope.Shared) {
			const { adapter } = resolveSharedResources();
			sharedRuntimeActive = true;

			if (!runtimeHost || !runtimeAdditionalArgs) {
				runtimeHost = createRuntimeHost();
				runtimeAdditionalArgs = createAdditionalArgs(adapter, runtimeHost);
			}

			return {
				adapter,
				additionalArgs: runtimeAdditionalArgs,
				host: runtimeHost,
			};
		}

		if (!runtimeAdapter) {
			runtimeAdapter = createAdapter();
			runtimeAdapter.scope ??= StateScope.Isolated;
		}

		if (!runtimeHost || !runtimeAdditionalArgs) {
			runtimeHost = createRuntimeHost();
			runtimeAdditionalArgs = createAdditionalArgs(runtimeAdapter, runtimeHost);
		}

		return {
			adapter: runtimeAdapter,
			additionalArgs: runtimeAdditionalArgs,
			host: runtimeHost,
		};
	};

	const register = (
		elementName: string,
		renderer: ComponentRenderer<RenderArgs, View>,
	) => {
		if (customElements.get(elementName)) {
			return;
		}

		const lifecycleScope = resolveLifecycleScope();

		if (inferredScope === StateScope.Shared) {
			const render = resolveRenderer(renderer);
			resolveSharedResources();

			class SharedIgniteComponent extends IgniteElement<State, Event, View> {
				private additionalArgs: AdditionalRenderArgs<State, Event, RenderArgs>;
				private readonly lifecycleHooks: IgniteElementLifecycleHooks;

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
					this.additionalArgs = resolveSharedAdditionalArgs(this);
					exposeCommands(this, this.additionalArgs as Record<string, unknown>);
					sharedInstanceCount += 1;
					super.connectedCallback();
				}

				disconnectedCallback(): void {
					super.disconnectedCallback();
					cleanupAdditionalArgs(this.additionalArgs);
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
					}
				}

				protected renderView(): View {
					return render({
						...this.additionalArgs,
						state: this.currentState,
						send: (event) => this.send(event),
					} as RenderArgs);
				}
			}

			customElements.define(elementName, SharedIgniteComponent);
			recordLifecycle("registered", elementName, lifecycleScope);
			return;
		}

		class IsolatedIgniteComponent extends IgniteElement<State, Event, View> {
			private additionalArgs:
				| AdditionalRenderArgs<State, Event, RenderArgs>
				| undefined;
			private adapterInstance: IgniteAdapter<State, Event> | undefined;
			private readonly lifecycleHooks: IgniteElementLifecycleHooks;
			private readonly renderImpl: (args: RenderArgs) => View;

			constructor() {
				const lifecycleHooks = createLifecycleHooks(
					elementName,
					lifecycleScope,
				);
				super(undefined, renderStrategyFactory(), lifecycleHooks);
				this.lifecycleHooks = lifecycleHooks;
				this.renderImpl = resolveRenderer(renderer);
			}

			connectedCallback(): void {
				if (!this.adapterInstance) {
					const adapter = createAdapter(this);
					adapter.scope ??= StateScope.Isolated;
					this.adapterInstance = adapter;
					this.additionalArgs = createAdditionalArgs(adapter, this);
					exposeCommands(this, this.additionalArgs as Record<string, unknown>);
					this.initializeAdapter(adapter);
				}

				super.connectedCallback();
			}

			disconnectedCallback(): void {
				cleanupAdditionalArgs(this.additionalArgs);
				this.additionalArgs = undefined;
				this.adapterInstance = undefined;
				recordLifecycle(
					"cleaned-up",
					elementName,
					lifecycleScope,
					this.lifecycleHooks.instanceId,
				);
				super.disconnectedCallback();
			}

			protected renderView(): View {
				if (!this.additionalArgs) {
					throw new Error(
						`[igniteElementFactory] Unable to render "${elementName}" before initialization.`,
					);
				}

				return this.renderImpl({
					...this.additionalArgs,
					state: this.currentState,
					send: (event) => this.send(event),
				} as RenderArgs);
			}
		}

		customElements.define(elementName, IsolatedIgniteComponent);
		recordLifecycle("registered", elementName, lifecycleScope);
	};

	Object.assign(
		register,
		createAgentRuntime<
			State,
			Event,
			RuntimeView,
			AdditionalRenderArgs<State, Event, RenderArgs>
		>({
			eventTypes,
			observeLifecycle,
			resolveRuntime: resolveRuntimeResources,
			resolveView,
		}),
	);

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

import type { IgniteAdapter } from "ignite-core";
import { facadeCleanupSymbol, StateScope } from "ignite-core";
import type { IgniteJsxChild, RenderStrategyFactory } from "ignite-renderer";
import type { TemplateResult } from "lit-html";
import IgniteElement from "./IgniteElement";
import "./renderers/ignite-jsx";
import { resolveConfiguredRenderStrategy } from "./renderers/resolveConfiguredRenderStrategy";
import { createAgentRuntime } from "./runtime/agent";

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
	View,
> = {
	scope?: StateScope;
	eventTypes?: readonly string[];
	createAdditionalArgs?: (
		adapter: IgniteAdapter<State, Event>,
		host?: HTMLElement,
	) => AdditionalRenderArgs<State, Event, RenderArgs>;
	createRenderStrategy?: RenderStrategyFactory<View>;
	cleanup?: boolean;
};

export default function igniteElementFactory<
	State,
	Event,
	RenderArgs extends BaseRenderArgs<State, Event> = BaseRenderArgs<
		State,
		Event
	>,
	View = TemplateResult | IgniteJsxChild,
>(
	createAdapter: () => IgniteAdapter<State, Event>,
	options?: FactoryOptions<State, Event, RenderArgs, View>,
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
			throw new Error(
				`[igniteElementFactory] Element "${elementName}" has already been defined.`,
			);
		}

		if (inferredScope === StateScope.Shared) {
			const render = resolveRenderer(renderer);
			resolveSharedResources();

			class SharedIgniteComponent extends IgniteElement<State, Event, View> {
				private additionalArgs: AdditionalRenderArgs<State, Event, RenderArgs>;

				constructor() {
					const { adapter } = resolveSharedResources();
					super(adapter, renderStrategyFactory());
					this.additionalArgs = resolveSharedAdditionalArgs(this);
				}

				connectedCallback(): void {
					this.additionalArgs = resolveSharedAdditionalArgs(this);
					sharedInstanceCount += 1;
					super.connectedCallback();
				}

				disconnectedCallback(): void {
					super.disconnectedCallback();
					cleanupAdditionalArgs(this.additionalArgs);
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
			return;
		}

		class IsolatedIgniteComponent extends IgniteElement<State, Event, View> {
			private readonly additionalArgs: AdditionalRenderArgs<
				State,
				Event,
				RenderArgs
			>;

			constructor() {
				const adapter = createAdapter();
				adapter.scope ??= StateScope.Isolated;
				super(adapter, renderStrategyFactory());
				this.additionalArgs = createAdditionalArgs(adapter, this);
				this.renderImpl = resolveRenderer(renderer);
			}

			private readonly renderImpl: (args: RenderArgs) => View;

			disconnectedCallback(): void {
				cleanupAdditionalArgs(this.additionalArgs);
				super.disconnectedCallback();
			}

			protected renderView(): View {
				return this.renderImpl({
					...this.additionalArgs,
					state: this.currentState,
					send: (event) => this.send(event),
				} as RenderArgs);
			}
		}

		customElements.define(elementName, IsolatedIgniteComponent);
	};

	Object.assign(
		register,
		createAgentRuntime<
			State,
			Event,
			AdditionalRenderArgs<State, Event, RenderArgs>
		>({
			eventTypes,
			resolveRuntime: resolveRuntimeResources,
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

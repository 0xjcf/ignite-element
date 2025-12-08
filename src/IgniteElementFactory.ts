import type { TemplateResult } from "lit-html";
import type IgniteAdapter from "./IgniteAdapter";
import { StateScope } from "./IgniteAdapter";
import IgniteElement from "./IgniteElement";
import type { IgniteJsxChild } from "./renderers/jsx/types";
import type { RenderStrategyFactory } from "./renderers/RenderStrategy";
import "./renderers/ignite-jsx";
import { resolveConfiguredRenderStrategy } from "./renderers/resolveConfiguredRenderStrategy";

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
	createAdditionalArgs?: (
		adapter: IgniteAdapter<State, Event>,
		host?: IgniteElement<State, Event, View>,
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

	const createAdditionalArgs: (
		adapter: IgniteAdapter<State, Event>,
		host?: IgniteElement<State, Event, View>,
	) => AdditionalRenderArgs<State, Event, RenderArgs> =
		options?.createAdditionalArgs ??
		((_) => ({}) as AdditionalRenderArgs<State, Event, RenderArgs>);

	const configuredFactory = resolveConfiguredRenderStrategy();
	const renderStrategyFactory: RenderStrategyFactory<View> =
		options?.createRenderStrategy ??
		(configuredFactory as RenderStrategyFactory<View>);
	const cleanupSharedLifecycle = options?.cleanup ?? true;

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

	return (elementName, renderer) => {
		if (customElements.get(elementName)) {
			throw new Error(
				`[igniteElementFactory] Element "${elementName}" has already been defined.`,
			);
		}

		const inferredScope =
			options?.scope ??
			(createAdapter as { scope?: StateScope }).scope ??
			StateScope.Isolated;

		if (inferredScope === StateScope.Shared) {
			const render = resolveRenderer(renderer);
			resolveSharedResources();

			class SharedIgniteComponent extends IgniteElement<State, Event, View> {
				private readonly additionalArgs: AdditionalRenderArgs<
					State,
					Event,
					RenderArgs
				>;

				constructor() {
					const { adapter } = resolveSharedResources();
					super(adapter, renderStrategyFactory());
					this.additionalArgs = resolveSharedAdditionalArgs(this);
				}

				connectedCallback(): void {
					sharedInstanceCount += 1;
					super.connectedCallback();
				}

				disconnectedCallback(): void {
					super.disconnectedCallback();

					if (sharedInstanceCount > 0) {
						sharedInstanceCount -= 1;
					}

					if (cleanupSharedLifecycle && sharedInstanceCount === 0) {
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

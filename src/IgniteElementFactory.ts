import type { TemplateResult } from "lit-html";
import type IgniteAdapter from "./IgniteAdapter";
import { StateScope } from "./IgniteAdapter";
import IgniteElement from "./IgniteElement";

export type BaseRenderArgs<State, Event> = {
	state: State;
	send: (event: Event) => void;
};

type AdditionalRenderArgs<
	State,
	Event,
	RenderArgs extends BaseRenderArgs<State, Event>,
> = Omit<RenderArgs, keyof BaseRenderArgs<State, Event>>;

type RendererObject<RenderArgs> = {
	render: (args: RenderArgs) => TemplateResult;
};

export type ComponentRenderer<RenderArgs> =
	| ((args: RenderArgs) => TemplateResult)
	| RendererObject<RenderArgs>
	| (new () => RendererObject<RenderArgs>);

export type ComponentFactory<
	State,
	Event,
	RenderArgs extends BaseRenderArgs<State, Event> = BaseRenderArgs<
		State,
		Event
	>,
> = (elementName: string, renderer: ComponentRenderer<RenderArgs>) => void;

export type AdapterPack<Factory> = Factory extends ComponentFactory<
	infer _State,
	infer _Event,
	infer RenderArgs
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
> = {
	scope?: StateScope;
	createAdditionalArgs?: (
		adapter: IgniteAdapter<State, Event>,
	) => AdditionalRenderArgs<State, Event, RenderArgs>;
};

export default function igniteElementFactory<
	State,
	Event,
	RenderArgs extends BaseRenderArgs<State, Event> = BaseRenderArgs<
		State,
		Event
	>,
>(
	createAdapter: () => IgniteAdapter<State, Event>,
	options?: FactoryOptions<State, Event, RenderArgs>,
): ComponentFactory<State, Event, RenderArgs> {
	let sharedAdapter: IgniteAdapter<State, Event> | null = null;

	const createAdditionalArgs =
		options?.createAdditionalArgs ??
		(() => ({}) as AdditionalRenderArgs<State, Event, RenderArgs>);

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
			if (!sharedAdapter) {
				sharedAdapter = createAdapter();
				sharedAdapter.scope = StateScope.Shared;
			}

			const adapter = sharedAdapter;
			const additionalArgs = createAdditionalArgs(adapter);
			const render = resolveRenderer(renderer);

			class SharedIgniteComponent extends IgniteElement<State, Event> {
				constructor() {
					super(adapter);
				}

				protected render(): TemplateResult {
					return render({
						...additionalArgs,
						state: this.currentState,
						send: (event) => this.send(event),
					} as RenderArgs);
				}
			}

			customElements.define(elementName, SharedIgniteComponent);
			return;
		}

		class IsolatedIgniteComponent extends IgniteElement<State, Event> {
			private readonly additionalArgs: AdditionalRenderArgs<
				State,
				Event,
				RenderArgs
			>;

			constructor() {
				const adapter = createAdapter();
				adapter.scope ??= StateScope.Isolated;
				super(adapter);
				this.additionalArgs = createAdditionalArgs(adapter);
				this.renderImpl = resolveRenderer(renderer);
			}

			private readonly renderImpl: (args: RenderArgs) => TemplateResult;

			protected render(): TemplateResult {
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
		renderer: ComponentRenderer<RenderArgs>,
	): (args: RenderArgs) => TemplateResult {
		if (typeof renderer === "function") {
			if (
				renderer.prototype &&
				typeof renderer.prototype.render === "function"
			) {
				const instance = new (
					renderer as new () => RendererObject<RenderArgs>
				)();
				return (args) => instance.render(args);
			}
			return renderer as (args: RenderArgs) => TemplateResult;
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

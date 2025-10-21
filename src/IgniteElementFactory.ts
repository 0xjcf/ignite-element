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

export type ComponentFactory<
	State,
	Event,
	RenderArgs extends BaseRenderArgs<State, Event> = BaseRenderArgs<
		State,
		Event
	>,
> = (
	elementName: string,
	renderFn: (args: RenderArgs) => TemplateResult,
) => void;

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

	return (elementName, renderFn) => {
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

			class SharedIgniteComponent extends IgniteElement<State, Event> {
				constructor() {
					super(adapter);
				}

				protected render(): TemplateResult {
					return renderFn({
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
			}

			protected render(): TemplateResult {
				return renderFn({
					...this.additionalArgs,
					state: this.currentState,
					send: (event) => this.send(event),
				} as RenderArgs);
			}
		}

		customElements.define(elementName, IsolatedIgniteComponent);
	};
}

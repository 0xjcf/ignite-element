import type { TemplateResult } from "lit-html";
import type IgniteAdapter from "./IgniteAdapter";
import { StateScope } from "./IgniteAdapter";
import IgniteElement from "./IgniteElement";

export interface IgniteElementConfig {
	styles?: { custom?: string; paths?: (string | StyleObject)[] };
}

export interface StyleObject {
	href: string;
	integrity?: string;
	crossorigin?: string;
}

export type RenderFnArgs<State, Event> = {
	state: State;
	send: (event: Event) => void;
};

export type ComponentFactory<State, Event> = (
	elementName: string,
	renderFn: (args: RenderFnArgs<State, Event>) => TemplateResult,
) => void;

type FactoryOptions = {
	scope?: StateScope;
};

export default function igniteElementFactory<State, Event>(
	createAdapter: () => IgniteAdapter<State, Event>,
	config?: IgniteElementConfig,
	options?: FactoryOptions,
): ComponentFactory<State, Event> {
	let sharedAdapter: IgniteAdapter<State, Event> | null = null;

	return (elementName, renderFn) => {
		if (customElements.get(elementName)) {
			throw new Error(
				`[igniteElementFactory] Element "${elementName}" has already been defined.`,
			);
		}

		const scope = options?.scope ?? StateScope.Isolated;

		if (scope === StateScope.Shared) {
			if (!sharedAdapter) {
				sharedAdapter = createAdapter();
				sharedAdapter.scope = StateScope.Shared;
			}

			class SharedIgniteComponent extends IgniteElement<State, Event> {
				constructor() {
					super(sharedAdapter!, config?.styles);
				}

				protected render(): TemplateResult {
					return renderFn({
						state: this.currentState,
						send: (event) => this.send(event),
					});
				}
			}

			customElements.define(elementName, SharedIgniteComponent);
			return;
		}

		class IsolatedIgniteComponent extends IgniteElement<State, Event> {
			constructor() {
				const adapter = createAdapter();
				adapter.scope = StateScope.Isolated;
				super(adapter, config?.styles);
			}

			protected render(): TemplateResult {
				return renderFn({
					state: this.currentState,
					send: (event) => this.send(event),
				});
			}
		}

		customElements.define(elementName, IsolatedIgniteComponent);
	};
}

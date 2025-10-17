import type { TemplateResult } from "lit-html";
import type IgniteAdapter from "./IgniteAdapter";
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

export default function igniteElementFactory<State, Event>(
	createAdapter: () => IgniteAdapter<State, Event>,
	config?: IgniteElementConfig,
): ComponentFactory<State, Event> {
	return (elementName, renderFn) => {
		if (customElements.get(elementName)) {
			throw new Error(
				`[igniteElementFactory] Element "${elementName}" has already been defined.`,
			);
		}

		class IgniteComponent extends IgniteElement<State, Event> {
			constructor() {
				const adapter = createAdapter();
				super(adapter, config?.styles);
			}

			protected render(): TemplateResult {
				return renderFn({
					state: this.currentState,
					send: (event) => this.send(event),
				});
			}
		}

		customElements.define(elementName, IgniteComponent);
	};
}

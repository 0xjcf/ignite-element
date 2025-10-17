import type { TemplateResult } from "lit-html";
import type IgniteAdapter from "./IgniteAdapter";
import IgniteElement from "./IgniteElement";

// Configuration for Ignite Elements
export interface IgniteElementConfig {
	styles?: { custom?: string; paths?: (string | StyleObject)[] };
}

export interface StyleObject {
	href: string;
	integrity?: string;
	crossorigin?: string;
}

// Render Function Arguments
export type RenderFnArgs<State, Event> = {
	state: State;
	send: (event: Event) => void;
};

// Core Interface for Ignite Factory
export interface IgniteCore<State, Event> {
	shared: (
		elementName: string,
		renderFn: (args: RenderFnArgs<State, Event>) => TemplateResult,
	) => void;

	isolated: (
		elementName: string,
		renderFn: (args: RenderFnArgs<State, Event>) => TemplateResult,
	) => void;

	Shared: (
		tagName: string,
	) => <ComponentCtor extends RenderableComponent<State, Event>>(
		componentCtor: ComponentCtor,
	) => void;

	Isolated: (
		tagName: string,
	) => <ComponentCtor extends RenderableComponent<State, Event>>(
		componentCtor: ComponentCtor,
	) => void;
}

// Enforce Component Structure
export interface RenderableComponent<State, Event> {
	new (): {
		render(props: RenderFnArgs<State, Event>): TemplateResult;
	};
}

// Factory Function
export default function igniteElementFactory<State, Event>(
	igniteAdapter: () => IgniteAdapter<State, Event>,
	config?: IgniteElementConfig,
): IgniteCore<State, Event> {
	let sharedAdapter: IgniteAdapter<State, Event> | null = null;

	function createSharedElement(
		elementName: string,
		renderFn: (args: RenderFnArgs<State, Event>) => TemplateResult,
	) {
		const adapter = sharedAdapter ?? igniteAdapter();
		sharedAdapter = adapter;

		class SharedElement extends IgniteElement<State, Event> {
			constructor() {
				super(adapter, config?.styles);
			}

			protected render(): TemplateResult {
				return renderFn({
					state: this.currentState,
					send: (event) => this.send(event),
				});
			}
		}

		customElements.define(elementName, SharedElement);
	}

	function createIsolatedElement(
		elementName: string,
		renderFn: (args: RenderFnArgs<State, Event>) => TemplateResult,
	) {
		class IsolatedElement extends IgniteElement<State, Event> {
			constructor() {
				const isolatedAdapter = igniteAdapter();
				super(isolatedAdapter, config?.styles);
			}

			protected render(): TemplateResult {
				return renderFn({
					state: this.currentState,
					send: (event) => this.send(event),
				});
			}
		}

		customElements.define(elementName, IsolatedElement);
	}

	// Shared Decorator
	function Shared(tagName: string) {
		return <T extends RenderableComponent<State, Event>>(componentCtor: T) => {
			createSharedElement(tagName, ({ state, send }) =>
				new componentCtor().render({ state, send }),
			);
		};
	}

	// Isolated Decorator
	function Isolated(tagName: string) {
		return <T extends RenderableComponent<State, Event>>(componentCtor: T) => {
			createIsolatedElement(tagName, ({ state, send }) =>
				new componentCtor().render({ state, send }),
			);
		};
	}

	return {
		shared: createSharedElement,
		isolated: createIsolatedElement,
		Shared,
		Isolated,
	};
}

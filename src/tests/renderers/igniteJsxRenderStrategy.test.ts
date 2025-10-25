import { afterEach, describe, expect, it, vi } from "vitest";
import igniteElementFactory from "../../IgniteElementFactory";
import * as injectStylesModule from "../../injectStyles";
import { createIgniteJsxRenderStrategy } from "../../renderers/jsx/IgniteJsxRenderStrategy";
import { Fragment, jsx, jsxs } from "../../renderers/jsx/jsx-runtime";
import { createDomNode } from "../../renderers/jsx/renderer";
import type { IgniteJsxChild } from "../../renderers/jsx/types";
import MockAdapter from "../MockAdapter";

const initialState = { count: 0 };
type State = typeof initialState;
type Event = { type: string };

describe("Ignite JSX render strategy", () => {
	afterEach(() => {
		document.body.innerHTML = "";
		vi.clearAllMocks();
	});

	it("renders initial state", () => {
		const { element } = mountIgniteJsxRenderer(({ state, send }) =>
			jsxs("div", {
				className: "counter",
				children: [
					xsxButton(() => send({ type: "increment" })),
					xsxDisplay(state?.count ?? 0),
				],
			}),
		);

		expect(element.shadowRoot?.textContent).toContain("Count: 0");
	});

	it("dispatches events through commands", () => {
		const { element, adapter } = mountIgniteJsxRenderer(({ send }) =>
			jsx("button", {
				onClick: () => send({ type: "increment" }),
				children: "+",
			}),
		);

		element.shadowRoot?.querySelector("button")?.click();
		expect(adapter.send).toHaveBeenCalledWith({ type: "increment" });
	});

	it("re-renders when state updates", () => {
		const { adapter, element } = mountIgniteJsxRenderer(({ state }) =>
			jsx("span", { children: `Count: ${state?.count ?? 0}` }),
		);

		const listener = adapter.subscribe.mock.calls[0]?.[0];
		listener?.({ count: 5 });
		expect(element.shadowRoot?.textContent).toContain("Count: 5");
	});

	it("supports object-based renderers", () => {
		const renderObject = {
			render: ({ state }: { state: State }) =>
				jsxs("p", {
					children: ["Object count: ", String(state.count)],
				}),
		};

		const { element } = mountIgniteJsxRenderer(renderObject);
		expect(element.shadowRoot?.textContent).toContain("Object count: 0");
	});

	it("supports class-based renderers", () => {
		class ClassRenderer {
			render({ state }: { state: State }) {
				return jsx("p", { children: `Class count: ${state.count}` });
			}
		}

		const renderSpy = vi.spyOn(ClassRenderer.prototype, "render");
		const { element } = mountIgniteJsxRenderer(ClassRenderer);
		expect(renderSpy).toHaveBeenCalled();
		expect(element.shadowRoot?.textContent).toContain("Class count: 0");
	});

	it("applies class, style, props, events, and attributes", () => {
		const onClick = vi.fn();
		const { element } = mountIgniteJsxRenderer(() =>
			jsx("input", {
				className: "foo",
				style: { color: "red", opacity: 0.5, unused: null },
				onClick,
				placeholder: "Hello",
				value: "abc",
				"data-id": "123",
				disabled: false,
			}),
		);

		const input = element.shadowRoot?.querySelector(
			"input",
		) as HTMLInputElement;
		expect(input.className).toBe("foo");
		expect(input.style.color).toBe("red");
		expect(input.style.opacity).toBe("0.5");
		expect(input.placeholder).toBe("Hello");
		expect(input.value).toBe("abc");
		expect(input.getAttribute("data-id")).toBe("123");
		expect(input.hasAttribute("disabled")).toBe(false);
		input.click();
		expect(onClick).toHaveBeenCalled();
	});

	it("ignores falsy className and removes attributes", () => {
		const { element } = mountIgniteJsxRenderer(() =>
			jsx("div", {
				className: null,
				hidden: false,
			}),
		);

		const div = element.shadowRoot?.querySelector("div") as HTMLDivElement;
		expect(div.className).toBe("");
		expect(div.hasAttribute("hidden")).toBe(false);
	});

	it("supports fragments and array children", () => {
		const { element } = mountIgniteJsxRenderer(() =>
			jsxs(Fragment, {
				children: [
					jsx("span", { children: "A" }),
					jsx("span", { children: "B" }),
				],
			}),
		);

		const spans = element.shadowRoot?.querySelectorAll("span");
		expect(spans?.length).toBe(2);
		expect(spans?.[0]?.textContent).toBe("A");
	});

	it("creates fallback comment nodes for null and unknown values", () => {
		const empty = createDomNode(null);
		const unknown = createDomNode({} as unknown as IgniteJsxChild);
		expect(empty.nodeType).toBe(Node.COMMENT_NODE);
		expect((empty as Comment).data).toBe("ignite-empty");
		expect(unknown.nodeType).toBe(Node.COMMENT_NODE);
		expect((unknown as Comment).data).toBe("ignite-unknown");
	});

	it("throws when render is called before attach", () => {
		const strategy = createIgniteJsxRenderStrategy();
		expect(() => strategy.render(jsx("div", {}))).toThrow(
			"[IgniteJsxRenderStrategy] Cannot render before attach has been invoked.",
		);
	});

	it("attaches, renders, and detaches cleanly", () => {
		const hostElement = document.createElement("div");
		hostElement.innerHTML = "";
		const shadow = hostElement.attachShadow({ mode: "open" });
		const injectSpy = vi.spyOn(injectStylesModule, "default");

		const strategy = createIgniteJsxRenderStrategy();
		strategy.attach(shadow);
		expect(injectSpy).toHaveBeenCalledWith(shadow);

		strategy.render(jsx("span", { children: "hello" }));
		expect(shadow.textContent).toBe("hello");

		strategy.detach();
		expect(() => strategy.render(jsx("span", { children: "fresh" }))).toThrow(
			"[IgniteJsxRenderStrategy] Cannot render before attach has been invoked.",
		);

		injectSpy.mockRestore();
	});
});

function mountIgniteJsxRenderer(
	renderer: (args: {
		state: { count: number };
		send: (event: Event) => void;
	}) => IgniteJsxChild,
): {
	element: HTMLElement & { shadowRoot: ShadowRoot };
	adapter: MockAdapter<State, Event>;
};
function mountIgniteJsxRenderer(
	renderer:
		| {
				render: (args: {
					state: { count: number };
					send: (event: Event) => void;
				}) => IgniteJsxChild;
		  }
		| (new () => {
				render: (args: {
					state: { count: number };
					send: (event: Event) => void;
				}) => IgniteJsxChild;
		  }),
): {
	element: HTMLElement & { shadowRoot: ShadowRoot };
	adapter: MockAdapter<State, Event>;
};
function mountIgniteJsxRenderer(
	renderer:
		| ((args: {
				state: { count: number };
				send: (event: Event) => void;
		  }) => IgniteJsxChild)
		| {
				render: (args: {
					state: { count: number };
					send: (event: Event) => void;
				}) => IgniteJsxChild;
		  }
		| (new () => {
				render: (args: {
					state: { count: number };
					send: (event: Event) => void;
				}) => IgniteJsxChild;
		  }),
) {
	const adapter = new MockAdapter(initialState);
	const component = igniteElementFactory(() => adapter, {
		createRenderStrategy: createIgniteJsxRenderStrategy,
	});
	const elementName = `ignite-jsx-${crypto.randomUUID()}`;
	component(elementName, renderer as never);

	const element = document.createElement(elementName) as HTMLElement & {
		shadowRoot: ShadowRoot;
	};
	document.body.appendChild(element);

	return { element, adapter };
}

function xsxButton(onClick: () => void) {
	return jsx("button", {
		onClick,
		children: "+",
	});
}

function xsxDisplay(count: number) {
	return jsx("span", {
		children: `Count: ${count}`,
	});
}

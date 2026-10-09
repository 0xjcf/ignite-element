import { afterEach, describe, expect, it, vi } from "vitest";
import igniteElementFactory from "../../IgniteElementFactory";
import { createIgniteJsxRenderStrategy } from "../../renderers/jsx/IgniteJsxRenderStrategy";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import * as renderer from "../../renderers/jsx/renderer";
import {
	mountIgniteJsx,
	type NormalizedNode,
	renderIgniteJsx,
} from "../../renderers/jsx/renderer";
import MockAdapter from "../MockAdapter";

type Ref = (element: Element | null) => void;

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
});

function flushDisconnect(): Promise<void> {
	return new Promise((resolve) => queueMicrotask(resolve));
}

function list(children: ReturnType<typeof jsx>[]) {
	return jsx("div", { children });
}

describe("keyed sibling reconciliation", () => {
	it("keeps node identity, focus, and input value when a keyed child is prepended", () => {
		const host = document.createElement("div");
		document.body.append(host);
		let tree = mountIgniteJsx(
			host,
			list([jsx("input", { "aria-label": "Existing" }, "existing")]),
		);
		const existing = host.querySelector("input") as HTMLInputElement;
		existing.value = "typed";
		existing.focus();

		tree = renderIgniteJsx(
			host,
			list([
				jsx("input", { "aria-label": "Added" }, "added"),
				jsx("input", { "aria-label": "Existing" }, "existing"),
			]),
			tree,
		);

		expect(host.querySelector('[aria-label="Existing"]')).toBe(existing);
		expect(existing.value).toBe("typed");
		expect(document.activeElement).toBe(existing);
		expect(
			Array.from(host.querySelectorAll("input")).map((node) =>
				node.getAttribute("aria-label"),
			),
		).toEqual(["Added", "Existing"]);
	});

	it("keeps node identity and input value when a keyed child is inserted", () => {
		const host = document.createElement("div");
		document.body.append(host);
		let tree = mountIgniteJsx(
			host,
			list([
				jsx("input", { "aria-label": "First" }, "first"),
				jsx("input", { "aria-label": "Last" }, "last"),
			]),
		);
		const first = host.querySelector(
			'[aria-label="First"]',
		) as HTMLInputElement;
		const last = host.querySelector('[aria-label="Last"]') as HTMLInputElement;
		first.value = "keep-first";
		last.value = "keep-last";
		first.focus();

		tree = renderIgniteJsx(
			host,
			list([
				jsx("input", { "aria-label": "First" }, "first"),
				jsx("input", { "aria-label": "Middle" }, "middle"),
				jsx("input", { "aria-label": "Last" }, "last"),
			]),
			tree,
		);

		expect(host.querySelector('[aria-label="First"]')).toBe(first);
		expect(host.querySelector('[aria-label="Last"]')).toBe(last);
		expect(first.value).toBe("keep-first");
		expect(last.value).toBe("keep-last");
		expect(document.activeElement).toBe(first);
		expect(host.querySelectorAll("input")).toHaveLength(3);
	});

	it("removes only the keyed child that left and keeps the others", () => {
		const host = document.createElement("div");
		document.body.append(host);
		const removed = vi.fn();
		let tree = mountIgniteJsx(
			host,
			list([
				jsx("input", { "aria-label": "First" }, "first"),
				jsx("input", { "aria-label": "Middle", ref: removed }, "middle"),
				jsx("input", { "aria-label": "Last" }, "last"),
			]),
		);
		const first = host.querySelector(
			'[aria-label="First"]',
		) as HTMLInputElement;
		const middle = host.querySelector(
			'[aria-label="Middle"]',
		) as HTMLInputElement;
		const last = host.querySelector('[aria-label="Last"]') as HTMLInputElement;
		middle.value = "stay";
		let parentWhenNull: ParentNode | null | undefined;
		removed.mockImplementation((element: Element | null) => {
			if (element === null) parentWhenNull = middle.parentNode;
		});

		tree = renderIgniteJsx(
			host,
			list([
				jsx("input", { "aria-label": "First" }, "first"),
				jsx("input", { "aria-label": "Last" }, "last"),
			]),
			tree,
		);

		expect(host.querySelector('[aria-label="First"]')).toBe(first);
		expect(host.querySelector('[aria-label="Last"]')).toBe(last);
		expect(host.querySelector('[aria-label="Middle"]')).toBeNull();
		expect(middle.value).toBe("stay");
		expect(removed).toHaveBeenCalledWith(null);
		expect(parentWhenNull).not.toBeNull();
		expect(host.querySelectorAll("input")).toHaveLength(2);
	});

	it("moves keyed children on reorder without recreating them", () => {
		const host = document.createElement("div");
		document.body.append(host);
		let tree = mountIgniteJsx(
			host,
			list([
				jsx("input", { "aria-label": "Alpha" }, "alpha"),
				jsx("input", { "aria-label": "Beta" }, "beta"),
			]),
		);
		const alpha = host.querySelector(
			'[aria-label="Alpha"]',
		) as HTMLInputElement;
		const beta = host.querySelector('[aria-label="Beta"]') as HTMLInputElement;
		alpha.value = "a-value";
		beta.value = "b-value";
		beta.focus();

		tree = renderIgniteJsx(
			host,
			list([
				jsx("input", { "aria-label": "Beta" }, "beta"),
				jsx("input", { "aria-label": "Alpha" }, "alpha"),
			]),
			tree,
		);

		expect(host.querySelector('[aria-label="Alpha"]')).toBe(alpha);
		expect(host.querySelector('[aria-label="Beta"]')).toBe(beta);
		expect(alpha.value).toBe("a-value");
		expect(beta.value).toBe("b-value");
		expect(document.activeElement).toBe(beta);
		expect(
			Array.from(host.querySelectorAll("input")).map((node) =>
				node.getAttribute("aria-label"),
			),
		).toEqual(["Beta", "Alpha"]);
	});

	it("keeps unkeyed children on positional matching", () => {
		const host = document.createElement("div");
		let tree = mountIgniteJsx(
			host,
			list([jsx("span", { children: "A" }), jsx("span", { children: "B" })]),
		);
		const [first, second] = Array.from(host.querySelectorAll("span"));

		tree = renderIgniteJsx(
			host,
			list([jsx("span", { children: "B" }), jsx("span", { children: "A" })]),
			tree,
		);

		const spans = Array.from(host.querySelectorAll("span"));
		expect(spans[0]).toBe(first);
		expect(spans[1]).toBe(second);
		expect(spans.map((node) => node.textContent)).toEqual(["B", "A"]);
	});

	it("warns in development when sibling keys are duplicated", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const host = document.createElement("div");
		mountIgniteJsx(
			host,
			list([
				jsx("span", { children: "one" }, "dup"),
				jsx("span", { children: "two" }, "dup"),
			]),
		);

		expect(warn).toHaveBeenCalledWith(
			'[ignite-jsx] Duplicate key "dup" among siblings. Keys must be unique.',
		);
	});

	it("does not warn about duplicate keys in production", () => {
		vi.stubEnv("NODE_ENV", "production");
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const host = document.createElement("div");
		mountIgniteJsx(
			host,
			list([jsx("span", {}, "dup"), jsx("span", {}, "dup")]),
		);
		expect(warn).not.toHaveBeenCalled();
	});
});

describe("ref lifecycle", () => {
	it("calls ref with the element on mount and not again on a later render", () => {
		const host = document.createElement("div");
		const ref = vi.fn<Ref>();
		let tree = mountIgniteJsx(
			host,
			jsx("input", { ref, "aria-label": "Name" }),
		);
		const input = host.querySelector("input");

		tree = renderIgniteJsx(
			host,
			jsx("input", { ref, "aria-label": "Name", class: "ready" }),
			tree,
		);

		expect(ref).toHaveBeenCalledTimes(1);
		expect(ref).toHaveBeenCalledWith(input);
		expect(input?.className).toBe("ready");
	});

	it("calls the previous ref with null and the next ref with the same element", () => {
		const host = document.createElement("div");
		const seen: Element[] = [];
		const order: string[] = [];
		const first: Ref = (element) => {
			order.push(element ? "first-element" : "first-null");
			if (element) seen.push(element);
		};
		const second: Ref = (element) => {
			order.push(element ? "second-element" : "second-null");
			if (element) seen.push(element);
		};
		let tree = mountIgniteJsx(host, jsx("input", { ref: first }));
		tree = renderIgniteJsx(host, jsx("input", { ref: second }), tree);

		expect(order).toEqual(["first-element", "first-null", "second-element"]);
		expect(seen[1]).toBe(seen[0]);
		expect(host.querySelector("input")).toBe(seen[0]);
	});

	it("calls ref with null once, before the node is detached, when it is removed", () => {
		const host = document.createElement("div");
		let parentWhenNull: ParentNode | null | undefined;
		const ref: Ref = (element) => {
			if (element === null) {
				parentWhenNull = input?.parentNode ?? null;
				calls.push(null);
				return;
			}
			calls.push(element);
		};
		const calls: Array<Element | null> = [];
		let tree = mountIgniteJsx(
			host,
			jsx("div", { children: jsx("input", { ref, "aria-label": "Temp" }) }),
		);
		const input = host.querySelector("input");

		tree = renderIgniteJsx(host, jsx("div", { children: [] }), tree);
		tree = renderIgniteJsx(host, jsx("div", { children: [] }), tree);

		expect(calls).toEqual([input, null]);
		expect(parentWhenNull).not.toBeNull();
		expect(host.querySelector("input")).toBeNull();
	});

	it("calls ref with null before detach, exactly once, when the strategy detaches", () => {
		const host = document.createElement("div");
		const shadow = host.attachShadow({ mode: "open" });
		document.body.append(host);
		const strategy = createIgniteJsxRenderStrategy();
		strategy.attach(shadow);
		let parentWhenNull: ParentNode | null | undefined;
		const ref: Ref = (element) => {
			if (element === null) parentWhenNull = input?.parentNode ?? null;
			calls.push(element);
		};
		const calls: Array<Element | null> = [];
		strategy.render(jsx("input", { ref, "aria-label": "Bound" }));
		const input = shadow.querySelector("input");

		strategy.detach();
		strategy.detach();

		expect(calls).toEqual([input, null]);
		expect(parentWhenNull).not.toBeNull();
	});

	it("calls ref with null on host disconnect and again with the element on reconnect", async () => {
		const ref = vi.fn<Ref>();
		const { element } = mountRenderer(() =>
			jsx("input", { ref, "aria-label": "Hosted" }),
		);
		const input = element.shadowRoot?.querySelector("input");
		expect(ref).toHaveBeenCalledTimes(1);
		expect(ref).toHaveBeenCalledWith(input);

		element.remove();
		await flushDisconnect();

		expect(ref).toHaveBeenCalledTimes(2);
		expect(ref).toHaveBeenLastCalledWith(null);
		expect(input?.parentNode).not.toBeNull();

		document.body.append(element);
		expect(ref).toHaveBeenCalledTimes(3);
		expect(ref).toHaveBeenLastCalledWith(input);
	});

	it("does not clear a ref when a disconnect is only a move", async () => {
		const ref = vi.fn<Ref>();
		const { element } = mountRenderer(() =>
			jsx("input", { ref, "aria-label": "Moved" }),
		);
		expect(ref).toHaveBeenCalledTimes(1);

		element.remove();
		document.body.append(element);
		await flushDisconnect();

		expect(ref).toHaveBeenCalledTimes(1);
		expect(ref).not.toHaveBeenCalledWith(null);
	});

	it("runs a shared unmount hook once, before detach, and not on an ordinary render", () => {
		const onIgniteUnmount = (
			renderer as unknown as {
				onIgniteUnmount?: (node: Node, hook: () => void) => void;
			}
		).onIgniteUnmount;
		expect(typeof onIgniteUnmount).toBe("function");
		if (!onIgniteUnmount) return;

		const host = document.createElement("div");
		const hook = vi.fn();
		let tree = mountIgniteJsx(
			host,
			jsx("div", { children: jsx("span", { children: "kept" }, "kept") }),
		);
		const span = host.querySelector("span");
		if (!span) throw new Error("expected span");
		let parentWhenRun: ParentNode | null = null;
		onIgniteUnmount(span, () => {
			parentWhenRun = span.parentNode;
			hook();
		});

		tree = renderIgniteJsx(
			host,
			jsx("div", {
				children: jsx("span", { children: "kept", class: "next" }, "kept"),
			}),
			tree,
		);
		expect(hook).not.toHaveBeenCalled();

		renderIgniteJsx(host, jsx("div", { children: [] }), tree);

		expect(hook).toHaveBeenCalledTimes(1);
		expect(parentWhenRun).not.toBeNull();
		renderIgniteJsx(host, jsx("div", { children: [] }), tree);
		expect(hook).toHaveBeenCalledTimes(1);
	});
});

describe("subtree ownership", () => {
	it("keeps externally injected children when innerHTML owns the subtree", () => {
		const host = document.createElement("div");
		let tree = mountIgniteJsx(
			host,
			jsx("div", {
				children: jsx("section", { innerHTML: "<p>owned</p>" }),
			}),
		);
		const section = host.querySelector("section");
		if (!section) throw new Error("expected section");
		const injected = document.createElement("span");
		injected.textContent = "external";
		section.append(injected);

		tree = renderIgniteJsx(
			host,
			jsx("div", {
				children: jsx("section", {
					innerHTML: "<p>owned</p>",
					id: "next",
				}),
			}),
			tree,
		);

		expect(section.id).toBe("next");
		expect(section.querySelector("p")?.textContent).toBe("owned");
		expect(section.querySelector("span")).toBe(injected);
	});

	it("does not diff children of an element that claims its subtree", () => {
		const claimSubtree = (
			renderer as unknown as {
				claimSubtree?: (element: Element) => void;
			}
		).claimSubtree;
		expect(typeof claimSubtree).toBe("function");
		if (!claimSubtree) return;

		const host = document.createElement("div");
		let tree = mountIgniteJsx(
			host,
			jsx("div", {
				children: jsx("section", {
					children: jsx("p", { children: "original" }),
				}),
			}),
		);
		const section = host.querySelector("section");
		if (!section) throw new Error("expected section");
		claimSubtree(section);
		const injected = document.createElement("em");
		injected.textContent = "external";
		section.append(injected);

		tree = renderIgniteJsx(
			host,
			jsx("div", {
				children: jsx("section", {
					children: jsx("p", { children: "replaced" }),
				}),
			}),
			tree,
		);

		expect(section.querySelector("p")?.textContent).toBe("original");
		expect(section.querySelector("em")).toBe(injected);
	});
});

describe("deprecated content props", () => {
	it("warns once in development that innerHTML and textContent are deprecated", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const host = document.createElement("div");
		let tree = mountIgniteJsx(host, jsx("div", { innerHTML: "<p>rich</p>" }));
		tree = renderIgniteJsx(
			host,
			jsx("div", { innerHTML: "<p>rich</p>" }),
			tree,
		);

		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn).toHaveBeenCalledWith(
			"[ignite-jsx] `innerHTML` is deprecated and will be removed in the next major release. Use JSX children for text, and hosts for trusted rich content.",
		);

		warn.mockClear();
		const textHost = document.createElement("div");
		mountIgniteJsx(textHost, jsx("div", { textContent: "plain" }));
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn).toHaveBeenCalledWith(
			"[ignite-jsx] `textContent` is deprecated and will be removed in the next major release. Use JSX children for text, and hosts for trusted rich content.",
		);
	});

	it("does not warn about innerHTML or textContent in production", () => {
		vi.stubEnv("NODE_ENV", "production");
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const host = document.createElement("div");
		mountIgniteJsx(host, jsx("div", { innerHTML: "<p>rich</p>" }));
		mountIgniteJsx(host, jsx("div", { textContent: "plain" }));
		expect(warn).not.toHaveBeenCalled();
	});
});

describe("already-stable renderer behavior", () => {
	it("patches class, style, and attributes in place", () => {
		const host = document.createElement("div");
		let tree = mountIgniteJsx(
			host,
			jsx("div", {
				class: "a",
				style: { color: "red" },
				title: "before",
			}),
		);
		const element = host.firstElementChild;

		tree = renderIgniteJsx(
			host,
			jsx("div", {
				class: "b",
				style: { color: "blue" },
				title: "after",
			}),
			tree,
		);

		expect(host.firstElementChild).toBe(element);
		expect(element?.getAttribute("class")).toBe("b");
		expect((element as HTMLElement).style.color).toBe("blue");
		expect(element?.getAttribute("title")).toBe("after");
	});

	it("replaces the element when the tag changes", () => {
		const host = document.createElement("div");
		let tree = mountIgniteJsx(host, jsx("p", { children: "copy" }));
		const paragraph = host.firstElementChild;

		tree = renderIgniteJsx(host, jsx("span", { children: "copy" }), tree);

		expect(host.firstElementChild).not.toBe(paragraph);
		expect(host.firstElementChild?.tagName).toBe("SPAN");
		expect(host.textContent).toBe("copy");
	});
});

describe("custom element slots", () => {
	it("projects JSX children into a custom element slot across parent re-renders", () => {
		const tag = `repro-slot-${crypto.randomUUID()}`;
		class SlotHost extends HTMLElement {
			constructor() {
				super();
				const root = this.attachShadow({ mode: "open" });
				root.innerHTML = "<slot></slot>";
			}
		}
		customElements.define(tag, SlotHost);

		const host = document.createElement("div");
		document.body.append(host);
		const view = () =>
			jsx("div", {
				children: jsx(tag, {
					children: jsx("span", { children: "slotted" }),
				}),
			});
		let tree: NormalizedNode[] | undefined = mountIgniteJsx(host, view());
		const custom = host.querySelector(tag);
		const span = custom?.querySelector("span");
		const slot = custom?.shadowRoot?.querySelector("slot");
		if (!custom || !span || !slot) throw new Error("slot projection missing");

		expect(slot.assignedNodes()).toContain(span);

		tree = renderIgniteJsx(host, view(), tree);
		const spanAfter = host.querySelector(`${tag} span`);
		expect(spanAfter).toBe(span);
		expect(slot.assignedNodes()).toContain(spanAfter);
	});
});

function mountRenderer(render: () => ReturnType<typeof jsx>) {
	const adapter = new MockAdapter({ count: 0 });
	const component = igniteElementFactory(() => adapter, {
		createRenderStrategy: createIgniteJsxRenderStrategy,
	});
	const elementName = `ignite-ref-${crypto.randomUUID()}`;
	component(elementName, render as never);
	const element = document.createElement(elementName) as HTMLElement & {
		shadowRoot: ShadowRoot;
	};
	document.body.append(element);
	return { element, adapter };
}

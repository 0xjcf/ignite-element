import { afterEach, describe, expect, it, vi } from "vitest";
import igniteElementFactory from "../../IgniteElementFactory";
import { createIgniteJsxRenderStrategy } from "../../renderers/jsx/IgniteJsxRenderStrategy";
import { Fragment, jsx } from "../../renderers/jsx/jsx-runtime";
import * as renderer from "../../renderers/jsx/renderer";
import {
	mountIgniteJsx,
	type NormalizedNode,
	renderIgniteJsx,
} from "../../renderers/jsx/renderer";
import type { IgniteJsxComponent } from "../../renderers/jsx/types";
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

	it("matches mixed keyed and unkeyed siblings by position and warns in development", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const host = document.createElement("div");
		let tree = mountIgniteJsx(
			host,
			list([
				jsx("span", { children: "keyed" }, "k"),
				jsx("span", { children: "plain" }),
			]),
		);
		const [first, second] = Array.from(host.querySelectorAll("span"));

		tree = renderIgniteJsx(
			host,
			list([
				jsx("span", { children: "plain" }),
				jsx("span", { children: "added" }),
				jsx("span", { children: "keyed" }, "k"),
			]),
			tree,
		);

		const spans = host.querySelectorAll("span");
		expect(spans[0]).toBe(first);
		expect(spans[0]?.textContent).toBe("plain");
		expect(spans[1]).toBe(second);
		expect(spans[1]?.textContent).toBe("added");
		expect(spans[2]?.textContent).toBe("keyed");
		expect(warn).toHaveBeenCalledWith(
			"[ignite-jsx] Mixed keyed and unkeyed siblings. The list will match by position.",
		);
	});

	it("replaces a keyed node when its tag changes", () => {
		const host = document.createElement("div");
		const ref = vi.fn<Ref>();
		let tree = mountIgniteJsx(
			host,
			list([jsx("span", { ref, children: "A" }, "a")]),
		);

		tree = renderIgniteJsx(
			host,
			list([jsx("em", { ref, children: "A" }, "a")]),
			tree,
		);

		expect(host.querySelector("span")).toBeNull();
		expect(host.querySelector("em")?.textContent).toBe("A");
		expect(ref).toHaveBeenCalledWith(null);
		expect(ref).toHaveBeenLastCalledWith(host.querySelector("em"));
	});

	it("leaves a node outside the keyed list in place", () => {
		const host = document.createElement("div");
		let tree = mountIgniteJsx(
			host,
			list([
				jsx("span", { children: "A" }, "a"),
				jsx("span", { children: "B" }, "b"),
			]),
		);
		const parent = host.querySelector("div");
		if (!parent) throw new Error("expected parent");
		const extra = document.createElement("em");
		extra.textContent = "extra";
		parent.append(extra);

		tree = renderIgniteJsx(
			host,
			list([
				jsx("span", { children: "B" }, "b"),
				jsx("span", { children: "A" }, "a"),
			]),
			tree,
		);

		expect(parent.lastElementChild).toBe(extra);
		expect(
			Array.from(parent.querySelectorAll("span")).map(
				(node) => node.textContent,
			),
		).toEqual(["B", "A"]);
	});

	it("rebuilds a keyed list when a managed DOM node is missing", () => {
		const host = document.createElement("div");
		let tree = mountIgniteJsx(
			host,
			list([
				jsx("span", { children: "A" }, "a"),
				jsx("span", { children: "B" }, "b"),
			]),
		);
		const parent = host.querySelector("div");
		parent?.firstChild?.remove();

		tree = renderIgniteJsx(
			host,
			list([
				jsx("span", { children: "A" }, "a"),
				jsx("span", { children: "B" }, "b"),
			]),
			tree,
		);

		expect(host.textContent).toBe("AB");
	});

	it("removes several trailing unkeyed children and keeps the first node", () => {
		const host = document.createElement("div");
		let tree = mountIgniteJsx(
			host,
			list([
				jsx("span", { children: "A" }),
				jsx("span", { children: "B" }),
				jsx("span", { children: "C" }),
			]),
		);
		const kept = host.querySelector("span");

		tree = renderIgniteJsx(host, list([jsx("span", { children: "A" })]), tree);

		expect(host.querySelectorAll("span")).toHaveLength(1);
		expect(host.querySelector("span")).toBe(kept);
		expect(host.textContent).toBe("A");
	});

	it("does not move a duplicate-keyed sibling when the texts swap", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const host = document.createElement("div");
		let tree = mountIgniteJsx(
			host,
			list([
				jsx("span", { children: "one" }, "dup"),
				jsx("span", { children: "two" }, "dup"),
			]),
		);
		const [first, second] = Array.from(host.querySelectorAll("span"));

		tree = renderIgniteJsx(
			host,
			list([
				jsx("span", { children: "two" }, "dup"),
				jsx("span", { children: "one" }, "dup"),
			]),
			tree,
		);

		const spans = host.querySelectorAll("span");
		expect(spans).toHaveLength(2);
		expect(spans[0]).toBe(first);
		expect(spans[1]).toBe(second);
		expect(spans[0]?.textContent).toBe("two");
		expect(spans[1]?.textContent).toBe("one");
		expect(warn).toHaveBeenCalledWith(
			'[ignite-jsx] Duplicate key "dup" among siblings. Keys must be unique.',
		);
	});

	it("repairs a comment when the DOM node was replaced", () => {
		const host = document.createElement("div");
		let tree = mountIgniteJsx(host, null);
		const comment = host.firstChild;
		if (!comment) throw new Error("expected comment");
		host.replaceChild(document.createElement("span"), comment);

		tree = renderIgniteJsx(host, null, tree);

		expect(host.firstChild?.nodeType).toBe(8);
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

	it("warns about duplicate keys even when NODE_ENV is production", () => {
		vi.stubEnv("NODE_ENV", "production");
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const host = document.createElement("div");
		mountIgniteJsx(
			host,
			list([jsx("span", {}, "dup"), jsx("span", {}, "dup")]),
		);
		expect(warn).toHaveBeenCalledWith(
			'[ignite-jsx] Duplicate key "dup" among siblings. Keys must be unique.',
		);
	});

	it("does not throw when process is missing and still warns", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const descriptor = Object.getOwnPropertyDescriptor(globalThis, "process");
		const host = document.createElement("div");
		Reflect.deleteProperty(globalThis, "process");
		try {
			mountIgniteJsx(
				host,
				list([
					jsx("span", { children: "one" }, "dup"),
					jsx("span", { children: "two" }, "dup"),
				]),
			);
			mountIgniteJsx(
				document.createElement("div"),
				jsx("div", { innerHTML: "<p>rich</p>" }),
			);
			mountIgniteJsx(
				document.createElement("div"),
				jsx("div", { textContent: "plain" }),
			);
		} finally {
			if (descriptor) {
				Object.defineProperty(globalThis, "process", descriptor);
			}
		}
		expect(warn).toHaveBeenCalled();
		expect(host.textContent).toBe("onetwo");
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

	it("ignores an unmount hook registered while unmount is already running", () => {
		const onIgniteUnmount = (
			renderer as unknown as {
				onIgniteUnmount?: (node: Node, hook: () => void) => void;
			}
		).onIgniteUnmount;
		expect(typeof onIgniteUnmount).toBe("function");
		if (!onIgniteUnmount) return;

		const host = document.createElement("div");
		const late = vi.fn();
		let tree = mountIgniteJsx(
			host,
			jsx("div", { children: jsx("span", { children: "gone" }) }),
		);
		const span = host.querySelector("span");
		if (!span) throw new Error("expected span");
		onIgniteUnmount(span, () => {
			onIgniteUnmount(span, late);
		});

		tree = renderIgniteJsx(host, jsx("div", { children: [] }), tree);
		expect(late).not.toHaveBeenCalled();
		expect(host.querySelector("span")).toBeNull();
	});

	it("treats releaseView before attach as a no-op", () => {
		const strategy = createIgniteJsxRenderStrategy();
		expect(() => strategy.releaseView()).not.toThrow();
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

	it("warns about innerHTML and textContent even when NODE_ENV is production", () => {
		vi.stubEnv("NODE_ENV", "production");
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const host = document.createElement("div");
		mountIgniteJsx(host, jsx("div", { innerHTML: "<p>rich</p>" }));
		mountIgniteJsx(host, jsx("div", { textContent: "plain" }));
		expect(warn).toHaveBeenCalledTimes(2);
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

describe("approved ref and key corrections", () => {
	it("calls a changed ref after the new children are in place", () => {
		const host = document.createElement("div");
		const seen: string[] = [];
		const first: Ref = (element) => {
			if (element) seen.push(`first:${element.textContent}`);
		};
		const second: Ref = (element) => {
			if (element) seen.push(`second:${element.textContent}`);
		};
		let tree = mountIgniteJsx(
			host,
			jsx("div", { ref: first, children: jsx("span", { children: "before" }) }),
		);
		tree = renderIgniteJsx(
			host,
			jsx("div", { ref: second, children: jsx("span", { children: "after" }) }),
			tree,
		);
		expect(seen).toEqual(["first:before", "second:after"]);
	});

	it("stores a returned disposer and does not also call ref(null)", () => {
		const host = document.createElement("div");
		const disposed = vi.fn();
		const ref = vi.fn((element: Element | null) => {
			if (element) return disposed;
			disposed();
		});
		let tree = mountIgniteJsx(host, jsx("input", { ref }));
		const input = host.querySelector("input");
		tree = renderIgniteJsx(host, jsx("div", {}), tree);
		expect(ref).toHaveBeenCalledTimes(1);
		expect(ref).toHaveBeenCalledWith(input);
		expect(disposed).toHaveBeenCalledTimes(1);
		expect(ref).not.toHaveBeenCalledWith(null);
	});

	it("calls ref(null) when the callback returns nothing", () => {
		const host = document.createElement("div");
		const ref = vi.fn<Ref>();
		let tree = mountIgniteJsx(host, jsx("input", { ref }));
		const input = host.querySelector("input");
		tree = renderIgniteJsx(host, jsx("div", {}), tree);
		expect(ref.mock.calls).toEqual([[input], [null]]);
	});

	it("runs the old disposer before acquiring a void ref", () => {
		const host = document.createElement("div");
		const order: string[] = [];
		const disposed = () => {
			order.push("dispose");
		};
		const first = () => {
			order.push("first");
			return disposed;
		};
		const second: Ref = (element) => {
			order.push(element ? "second" : "second-null");
		};
		let tree = mountIgniteJsx(host, jsx("input", { ref: first }));
		tree = renderIgniteJsx(host, jsx("input", { ref: second }), tree);
		tree = renderIgniteJsx(host, jsx("div", {}), tree);
		expect(order).toEqual(["first", "dispose", "second", "second-null"]);
	});

	it("calls ref(null) before acquiring a disposer ref", () => {
		const host = document.createElement("div");
		const order: string[] = [];
		const first: Ref = (element) => {
			order.push(element ? "first" : "first-null");
		};
		const second = (element: Element | null) => {
			order.push(element ? "second" : "second-null");
			if (element) {
				return () => {
					order.push("dispose");
				};
			}
		};
		let tree = mountIgniteJsx(host, jsx("input", { ref: first }));
		tree = renderIgniteJsx(host, jsx("input", { ref: second }), tree);
		tree = renderIgniteJsx(host, jsx("div", {}), tree);
		expect(order).toEqual(["first", "first-null", "second", "dispose"]);
		expect(order).not.toContain("second-null");
	});

	it("releases a child ref before innerHTML replaces the subtree", () => {
		const host = document.createElement("div");
		const order: string[] = [];
		const ref = (element: Element | null) => {
			if (!element) {
				order.push("null");
				return;
			}
			return () => {
				order.push(
					element.parentNode ? "dispose-connected" : "dispose-detached",
				);
			};
		};
		let tree = mountIgniteJsx(
			host,
			jsx("section", { children: jsx("input", { ref }) }),
		);
		tree = renderIgniteJsx(
			host,
			jsx("section", { innerHTML: "<p>owned</p>" }),
			tree,
		);
		expect(order).toEqual(["dispose-connected"]);
		expect(host.querySelector("input")).toBeNull();
		expect(host.querySelector("p")?.textContent).toBe("owned");
	});

	it("calls ref(null) before textContent replaces a void ref", () => {
		const host = document.createElement("div");
		let connected: boolean | undefined;
		const ref: Ref = (element) => {
			if (element === null) connected = Boolean(input?.parentNode);
		};
		let tree = mountIgniteJsx(
			host,
			jsx("section", { children: jsx("input", { ref }) }),
		);
		const input = host.querySelector("input");
		tree = renderIgniteJsx(
			host,
			jsx("section", { textContent: "plain" }),
			tree,
		);
		expect(connected).toBe(true);
		expect(host.querySelector("section")?.textContent).toBe("plain");
	});

	it("continues unmount when a hook and a ref cleanup throw", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const onIgniteUnmount = (
			renderer as unknown as {
				onIgniteUnmount?: (node: Node, hook: () => void) => void;
			}
		).onIgniteUnmount;
		expect(typeof onIgniteUnmount).toBe("function");
		if (!onIgniteUnmount) return;
		const host = document.createElement("div");
		const later = vi.fn();
		const ref = vi.fn<Ref>();
		let tree = mountIgniteJsx(
			host,
			jsx("div", {
				children: [
					jsx("span", { children: "a" }),
					jsx("em", { ref, children: "b" }),
				],
			}),
		);
		const span = host.querySelector("span");
		const em = host.querySelector("em");
		if (!span || !em) throw new Error("expected children");
		onIgniteUnmount(span, () => {
			throw new Error("hook failed");
		});
		onIgniteUnmount(em, later);
		tree = renderIgniteJsx(host, jsx("div", { children: [] }), tree);
		expect(later).toHaveBeenCalledTimes(1);
		expect(ref).toHaveBeenCalledWith(null);
		expect(host.querySelector("span")).toBeNull();
		expect(host.querySelector("em")).toBeNull();
		expect(error).toHaveBeenCalled();
	});

	it("still runs onTrueDisconnect when a ref cleanup throws", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const sibling = vi.fn<Ref>();
		const ref = () => () => {
			throw new Error("cleanup failed");
		};
		const { element } = mountRenderer(() =>
			jsx("div", {
				children: [
					jsx("input", { ref, "aria-label": "first" }),
					jsx("input", { ref: sibling, "aria-label": "second" }),
				],
			}),
		);
		const onTrueDisconnect = vi.fn();
		(
			element as HTMLElement & { onTrueDisconnect: () => void }
		).onTrueDisconnect = onTrueDisconnect;
		element.remove();
		await flushDisconnect();
		expect(sibling).toHaveBeenCalledWith(null);
		expect(onTrueDisconnect).toHaveBeenCalledTimes(1);
		expect(error).toHaveBeenCalled();
	});

	it("reports ref cleanup to handleError before onError and continues", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const sibling = vi.fn<Ref>();
		const failure = new Error("cleanup failed");
		const { element } = mountRenderer(() =>
			jsx("div", {
				children: [
					jsx("input", {
						ref: () => () => {
							throw failure;
						},
						"aria-label": "first",
					}),
					jsx("input", { ref: sibling, "aria-label": "second" }),
				],
			}),
		);
		const handleError = vi.fn();
		const onError = vi.fn();
		Object.assign(element, { handleError, onError });
		element.remove();
		await flushDisconnect();
		expect(handleError).toHaveBeenCalledWith(failure);
		expect(onError).not.toHaveBeenCalled();
		expect(sibling).toHaveBeenCalledWith(null);
		expect(error).not.toHaveBeenCalled();
	});

	it("uses onError when the host has no handleError", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const failure = new Error("cleanup failed");
		const { element } = mountRenderer(() =>
			jsx("input", {
				ref: () => () => {
					throw failure;
				},
			}),
		);
		const onError = vi.fn();
		Object.assign(element, { onError });
		element.remove();
		await flushDisconnect();
		expect(onError).toHaveBeenCalledWith(failure);
		expect(error).not.toHaveBeenCalled();
	});

	it("reports a throwing error handler and still finishes the callback report", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const failure = new Error("cleanup failed");
		const handlerFailure = new Error("handler failed");
		const { element } = mountRenderer(() =>
			jsx("input", {
				ref: () => () => {
					throw failure;
				},
			}),
		);
		Object.assign(element, {
			handleError: () => {
				throw handlerFailure;
			},
		});
		element.remove();
		await flushDisconnect();
		expect(error).toHaveBeenCalledWith(
			"[ignite-jsx] Error handler failed.",
			handlerFailure,
		);
		expect(error).toHaveBeenCalledWith(
			"[ignite-jsx] Callback failed.",
			failure,
		);
	});

	it("observes a rejected cleanup promise without blocking the next ref", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const sibling = vi.fn<Ref>();
		const failure = new Error("rejected cleanup");
		const host = document.createElement("div");
		let tree = mountIgniteJsx(
			host,
			jsx("div", {
				children: [
					jsx("input", {
						ref: () => () => Promise.reject(failure),
						"aria-label": "first",
					}),
					jsx("input", { ref: sibling, "aria-label": "second" }),
				],
			}),
		);
		tree = renderIgniteJsx(host, jsx("div", { children: [] }), tree);
		expect(sibling).toHaveBeenCalledWith(null);
		expect(error).not.toHaveBeenCalled();
		await flushDisconnect();
		expect(error).toHaveBeenCalledWith(
			"[ignite-jsx] Callback failed.",
			failure,
		);
	});

	it("continues sibling acquisition when a ref throws", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const sibling = vi.fn<Ref>();
		const failure = new Error("acquire failed");
		const host = document.createElement("div");
		mountIgniteJsx(
			host,
			jsx("div", {
				children: [
					jsx("input", {
						ref: () => {
							throw failure;
						},
						"aria-label": "first",
					}),
					jsx("input", { ref: sibling, "aria-label": "second" }),
				],
			}),
		);
		expect(sibling).toHaveBeenCalledWith(
			host.querySelector('[aria-label="second"]'),
		);
		expect(error).toHaveBeenCalledWith(
			"[ignite-jsx] Callback failed.",
			failure,
		);
	});

	it("does not store a rejected thenable as ref cleanup", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const calls: Array<Element | null> = [];
		const failure = new Error("thenable");
		const host = document.createElement("div");
		const ref = (element: Element | null) => {
			calls.push(element);
			if (element) return Promise.reject(failure);
		};
		let tree = mountIgniteJsx(host, jsx("input", { ref }));
		await flushDisconnect();
		expect(error).toHaveBeenCalledWith(
			"[ignite-jsx] Callback failed.",
			failure,
		);
		tree = renderIgniteJsx(host, jsx("div", {}), tree);
		expect(calls[calls.length - 1]).toBeNull();
	});

	it("does not connect or disconnect an unchanged keyed custom element", () => {
		const tag = `stay-put-${crypto.randomUUID()}`;
		let connects = 0;
		let disconnects = 0;
		class Stay extends HTMLElement {
			connectedCallback(): void {
				connects += 1;
			}
			disconnectedCallback(): void {
				disconnects += 1;
			}
		}
		customElements.define(tag, Stay);
		const host = document.createElement("div");
		document.body.append(host);
		let tree = mountIgniteJsx(
			host,
			list([
				jsx(tag, { children: "A" }, "a"),
				jsx(tag, { children: "B" }, "b"),
			]),
		);
		expect(connects).toBe(2);
		expect(disconnects).toBe(0);
		tree = renderIgniteJsx(
			host,
			list([
				jsx(tag, { children: "A", class: "next" }, "a"),
				jsx(tag, { children: "B" }, "b"),
			]),
			tree,
		);
		expect(connects).toBe(2);
		expect(disconnects).toBe(0);
		expect(host.querySelector(tag)?.className).toBe("next");
	});

	it("restores focus inside the shadow root after a keyed reorder", () => {
		const host = document.createElement("div");
		const shadow = host.attachShadow({ mode: "open" });
		document.body.append(host);
		let tree = mountIgniteJsx(
			shadow,
			list([
				jsx("input", { "aria-label": "Alpha" }, "alpha"),
				jsx("input", { "aria-label": "Beta" }, "beta"),
			]),
		);
		const beta = shadow.querySelector(
			'[aria-label="Beta"]',
		) as HTMLInputElement;
		beta.focus();
		expect(shadow.activeElement).toBe(beta);
		tree = renderIgniteJsx(
			shadow,
			list([
				jsx("input", { "aria-label": "Beta" }, "beta"),
				jsx("input", { "aria-label": "Alpha" }, "alpha"),
			]),
			tree,
		);
		expect(shadow.activeElement).toBe(beta);
		expect(document.activeElement).toBe(host);
	});

	it("keeps a key from a single-root function component and fragment", () => {
		const host = document.createElement("div");
		document.body.append(host);
		const Row: IgniteJsxComponent = (props) =>
			jsx("input", { "aria-label": props.label });
		let tree = mountIgniteJsx(
			host,
			list([
				jsx(Row, { label: "Alpha" }, "alpha"),
				jsx(
					Fragment,
					{ children: jsx("input", { "aria-label": "Beta" }) },
					"beta",
				),
			]),
		);
		const alpha = host.querySelector(
			'[aria-label="Alpha"]',
		) as HTMLInputElement;
		const beta = host.querySelector('[aria-label="Beta"]') as HTMLInputElement;
		alpha.value = "kept";
		beta.focus();
		tree = renderIgniteJsx(
			host,
			list([
				jsx(
					Fragment,
					{ children: jsx("input", { "aria-label": "Beta" }) },
					"beta",
				),
				jsx(Row, { label: "Alpha" }, "alpha"),
			]),
			tree,
		);
		expect(host.querySelector('[aria-label="Alpha"]')).toBe(alpha);
		expect(host.querySelector('[aria-label="Beta"]')).toBe(beta);
		expect(alpha.value).toBe("kept");
		expect(document.activeElement).toBe(beta);
	});

	it("warns when a keyed component returns more than one node", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const host = document.createElement("div");
		const Pair = () => [
			jsx("span", { children: "a" }),
			jsx("i", { children: "b" }),
		];
		mountIgniteJsx(host, list([jsx(Pair, {}, "pair")]));
		expect(host.querySelector("span")?.textContent).toBe("a");
		expect(host.querySelector("i")?.textContent).toBe("b");
		expect(warn).toHaveBeenCalledWith(
			'[ignite-jsx] Key "pair" requires a single element, but the component returned 2 nodes.',
		);
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

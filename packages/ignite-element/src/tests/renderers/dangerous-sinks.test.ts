import { afterEach, describe, expect, it, vi } from "vitest";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import {
	mountIgniteJsx,
	renderIgniteJsx,
	unmountIgniteSubtree,
} from "../../renderers/jsx/renderer";
import { unsupportedJsxProps } from "./unsupported-jsx-props";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

function mount(view: ReturnType<typeof jsx>) {
	const host = document.createElement("div");
	const tree = mountIgniteJsx(host, view);
	return { host, tree };
}

function withSetter(
	prototype: object,
	key: string,
	run: (assigned: unknown[]) => void,
) {
	const descriptor = Object.getOwnPropertyDescriptor(prototype, key);
	const set = descriptor?.set;
	const get = descriptor?.get;
	if (!descriptor || !set || !get) {
		throw new Error(`missing setter ${key}`);
	}
	const assigned: unknown[] = [];
	Object.defineProperty(prototype, key, {
		configurable: true,
		enumerable: descriptor.enumerable,
		get,
		set(value: unknown) {
			assigned.push(value);
			set.call(this, value);
		},
	});
	try {
		run(assigned);
	} finally {
		Object.defineProperty(prototype, key, descriptor);
	}
}

describe("blocked markup sinks", () => {
	it.each(["innerHTML", "INNERHTML", "outerHTML", "srcdoc", "SRCDOC"])(
		"does not apply %s",
		(key) => {
			const { host } = mount(
				jsx(
					"section",
					unsupportedJsxProps({
						id: "stay",
						[key]: "<p>injected</p><img src=x onerror=alert(1)>",
						children: "visible",
					}),
				),
			);
			const section = host.querySelector("section");

			expect(section?.id).toBe("stay");
			expect(section?.textContent).toBe("visible");
			expect(section?.querySelector("p")).toBeNull();
			expect(section?.querySelector("img")).toBeNull();
			expect(section?.getAttribute("srcdoc")).toBeNull();
			expect(host.querySelector("section")).toBe(section);
		},
	);

	it("does not apply srcdoc on an iframe", () => {
		const { host } = mount(
			jsx("iframe", {
				title: "preview",
				srcdoc: "<script>alert(1)</script>",
			}),
		);
		const frame = host.querySelector("iframe");

		expect(frame?.getAttribute("srcdoc")).toBeNull();
		expect(frame?.getAttribute("title")).toBe("preview");
	});

	it("keeps JSX children when an innerHTML prop is removed", () => {
		const { host, tree } = mount(
			jsx(
				"div",
				unsupportedJsxProps({
					innerHTML: "<p>no</p>",
					children: "kept",
				}),
			),
		);

		renderIgniteJsx(host, jsx("div", { children: "kept" }), tree);

		expect(host.textContent).toBe("kept");
		expect(host.querySelector("p")).toBeNull();
	});

	it("does not apply textContent and warns that it is ignored", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { host } = mount(
			jsx("div", unsupportedJsxProps({ textContent: "plain" })),
		);

		expect(host.querySelector("div")?.textContent).toBe("");
		expect(warn).toHaveBeenCalledWith(
			"[ignite-jsx] `textContent` is ignored and not applied. Use JSX children for text, and hosts for trusted rich content.",
		);
	});

	it("warns once in development for each blocked markup prop", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { host, tree } = mount(
			jsx(
				"div",
				unsupportedJsxProps({
					innerHTML: "<p>no</p>",
					outerHTML: "<p>no</p>",
					srcdoc: "<p>no</p>",
				}),
			),
		);

		expect(warn).toHaveBeenCalledWith(
			"[ignite-jsx] `innerHTML` is ignored and not applied. Use JSX children for text, and hosts for trusted rich content.",
		);
		expect(warn).toHaveBeenCalledWith(
			"[ignite-jsx] `outerHTML` is ignored and not applied. Use JSX children for text, and hosts for trusted rich content.",
		);
		expect(warn).toHaveBeenCalledWith(
			"[ignite-jsx] `srcdoc` is ignored and not applied. Use JSX children for text, and hosts for trusted rich content.",
		);
		expect(warn.mock.calls.flat().join("\n")).not.toContain("deprecated");

		warn.mockClear();
		renderIgniteJsx(
			host,
			jsx(
				"div",
				unsupportedJsxProps({
					innerHTML: "<p>no</p>",
					outerHTML: "<p>no</p>",
					srcdoc: "<p>no</p>",
				}),
			),
			tree,
		);
		expect(warn).not.toHaveBeenCalled();
	});
});

describe("URL scheme guard", () => {
	const blocked = [
		["href", "javascript:alert(1)"],
		["href", "\u0000 \tJaVa\nScRiPt\r:alert(1)\u007f "],
		["src", "\tvb\rscript\n:alert(1)"],
		["action", "data:text/html;charset=utf-8,<script>alert(1)</script>"],
		["formAction", " DATA:application/xhtml+xml;base64,PHhodG1sPg== "],
		["href", "data:\nimage/svg+xml;charset=utf-8,<svg></svg>"],
		["href", ["javascript:alert(1)"]],
		["src", [["\tJaVa\nScRiPt:alert(1)"]]],
		["action", ["vbscript:alert(1)", null]],
		["formaction", ["data:text/html,<script>alert(1)</script>", {}, true, 1]],
	] as const;

	it.each(blocked)("does not apply %s=%j", (key, value) => {
		const { host } = mount(jsx("a", { [key]: value, children: "link" }));
		const link = host.querySelector("a");

		expect(link?.getAttribute(key)).toBeNull();
		expect(link?.textContent).toBe("link");
	});

	it("does not apply a javascript src on an iframe or img", () => {
		const { host } = mount(
			jsx("div", {
				children: [
					jsx("iframe", { title: "frame", src: "javascript:alert(1)" }),
					jsx("img", { alt: "pixel", src: "javascript:alert(1)" }),
				],
			}),
		);

		expect(host.querySelector("iframe")?.getAttribute("src")).toBeNull();
		expect(host.querySelector("img")?.getAttribute("src")).toBeNull();
	});

	it("does not assign outerHTML", () => {
		const setter = vi.spyOn(Element.prototype, "outerHTML", "set");
		const { host } = mount(
			jsx(
				"section",
				unsupportedJsxProps({ id: "stay", outerHTML: "<p>injected</p>" }),
			),
		);

		expect(setter).not.toHaveBeenCalled();
		expect(host.querySelector("section")?.id).toBe("stay");
		expect(host.querySelector("p")).toBeNull();
	});

	it("does not apply an executable xlink:href", () => {
		const { host } = mount(
			jsx("svg", {
				children: jsx("use", { "xlink:href": "javascript:alert(1)" }),
			}),
		);
		const use = host.querySelector("use");

		expect(use?.namespaceURI).toBe(SVG_NAMESPACE);
		expect(use?.getAttribute("xlink:href")).toBeNull();
	});

	it("applies safe URL schemes", () => {
		const { host } = mount(
			jsx("div", {
				children: [
					jsx("a", { href: "https://example.com/path", children: "web" }),
					jsx("a", { href: "/relative", children: "rel" }),
					jsx("a", { href: "mailto:a@example.com", children: "mail" }),
					jsx("img", { alt: "pixel", src: "data:image/png;base64,aaaa" }),
					jsx("form", { action: "https://example.com/submit" }),
					jsx("button", { formAction: "https://example.com/go" }),
				],
			}),
		);

		expect(host.querySelectorAll("a")[0]?.getAttribute("href")).toContain(
			"https://example.com/path",
		);
		expect(host.querySelectorAll("a")[1]?.getAttribute("href")).toContain(
			"/relative",
		);
		expect(host.querySelectorAll("a")[2]?.getAttribute("href")).toContain(
			"mailto:a@example.com",
		);
		expect(host.querySelector("img")?.getAttribute("src")).toContain(
			"data:image/png",
		);
		expect(host.querySelector("form")?.getAttribute("action")).toContain(
			"https://example.com/submit",
		);
		expect(host.querySelector("button")?.getAttribute("formaction")).toContain(
			"https://example.com/go",
		);
	});

	it("does not apply non-string URL values", () => {
		const { host } = mount(
			jsx("a", { href: ["java", "script:alert(1)"], children: "split" }),
		);

		expect(host.querySelector("a")?.getAttribute("href")).toBeNull();
	});

	it("removes a safe URL when the next value is executable", () => {
		const { host, tree } = mount(
			jsx("a", { href: "https://example.com/ok", children: "go" }),
		);
		expect(host.querySelector("a")?.getAttribute("href")).toContain(
			"https://example.com/ok",
		);

		renderIgniteJsx(
			host,
			jsx("a", { href: "javascript:alert(1)", children: "go" }),
			tree,
		);

		const anchor = host.querySelector("a");
		expect(anchor?.getAttribute("href")).toBeNull();
		expect(anchor?.href ?? "").not.toContain("example.com/ok");
		expect(anchor?.href ?? "").not.toContain("javascript:");
		expect(anchor?.href ?? "").not.toContain("undefined");
	});

	it.each([
		["iframe", "src", HTMLIFrameElement],
		["object", "data", HTMLObjectElement],
		["embed", "src", HTMLEmbedElement],
	] as const)(
		"clears a reflected %s %s through the attribute",
		(tag, key, prototype) => {
			const descriptor = Object.getOwnPropertyDescriptor(
				prototype.prototype,
				key,
			);
			const set = descriptor?.set;
			const get = descriptor?.get;
			if (!descriptor || !set || !get) {
				throw new Error(`missing ${tag} ${key} setter`);
			}
			const assigned: unknown[] = [];
			Object.defineProperty(prototype.prototype, key, {
				configurable: true,
				enumerable: descriptor.enumerable,
				get,
				set(value: unknown) {
					assigned.push(value);
					set.call(this, value);
				},
			});

			try {
				const host = document.createElement("div");
				document.body.append(host);
				const tree = mountIgniteJsx(
					host,
					jsx(tag, { [key]: "https://example.com/ok" }),
				);
				assigned.length = 0;
				renderIgniteJsx(host, jsx(tag, { [key]: "javascript:alert(1)" }), tree);

				const element = host.querySelector(tag);
				const reflected = String(
					(element as unknown as Record<string, unknown> | null)?.[key] ?? "",
				);
				expect(element?.getAttribute(key)).toBeNull();
				expect(assigned).not.toContain(undefined);
				expect(reflected).not.toContain("undefined");
				expect(reflected).not.toContain("javascript:");
			} finally {
				Object.defineProperty(prototype.prototype, key, descriptor);
			}
		},
	);

	it("does not apply an executable data URL on object", () => {
		const { host } = mount(
			jsx("object", {
				data: "data:text/html,<script>alert(1)</script>",
				type: "text/html",
			}),
		);
		const object = host.querySelector("object");

		expect(object?.getAttribute("data")).toBeNull();
		expect(object?.data ?? "").not.toContain("text/html");
		expect(object?.getAttribute("type")).toBe("text/html");
	});

	it("still applies a document URL on object", () => {
		const { host } = mount(
			jsx("object", { data: "https://example.com/file.pdf" }),
		);

		expect(host.querySelector("object")?.getAttribute("data")).toContain(
			"https://example.com/file.pdf",
		);
	});

	it("still applies a data attribute on elements that are not object", () => {
		const { host } = mount(
			jsx("div", { data: "data:text/html,<p>not a document</p>" }),
		);

		expect(host.querySelector("div")?.getAttribute("data")).toBe(
			"data:text/html,<p>not a document</p>",
		);
	});

	it("clears a coerced checked property when the prop is removed", () => {
		const { host, tree } = mount(
			jsx("input", { type: "checkbox", checked: 1 }),
		);
		const input = host.querySelector("input");
		expect(input?.checked).toBe(true);

		renderIgniteJsx(host, jsx("input", { type: "checkbox" }), tree);

		expect(input?.checked).toBe(false);
	});

	it("resets checked to false instead of undefined", () => {
		const descriptor = Object.getOwnPropertyDescriptor(
			HTMLInputElement.prototype,
			"checked",
		);
		const set = descriptor?.set;
		const get = descriptor?.get;
		if (!descriptor || !set || !get) {
			throw new Error("missing checked setter");
		}
		const assigned: unknown[] = [];
		Object.defineProperty(HTMLInputElement.prototype, "checked", {
			configurable: true,
			enumerable: descriptor.enumerable,
			get,
			set(value: unknown) {
				assigned.push(value);
				set.call(this, value);
			},
		});

		try {
			const host = document.createElement("div");
			document.body.append(host);
			const tree = mountIgniteJsx(
				host,
				jsx("input", { type: "checkbox", checked: 1 }),
			);
			assigned.length = 0;
			renderIgniteJsx(host, jsx("input", { type: "checkbox" }), tree);

			expect(assigned).toContain(false);
			expect(assigned).not.toContain(undefined);
			expect(host.querySelector("input")?.checked).toBe(false);
		} finally {
			Object.defineProperty(HTMLInputElement.prototype, "checked", descriptor);
		}
	});

	it("resets a coerced value to an empty string", () => {
		const { host, tree } = mount(jsx("input", { value: 1 }));
		const input = host.querySelector("input");
		expect(input?.value).toBe("1");

		renderIgniteJsx(host, jsx("input", {}), tree);

		expect(input?.value).toBe("");
	});

	it("resets a string value to an empty string", () => {
		const { host, tree } = mount(jsx("input", { value: "hello" }));
		const input = host.querySelector("input");
		expect(input?.value).toBe("hello");

		renderIgniteJsx(host, jsx("input", {}), tree);

		expect(input?.value).toBe("");
	});

	it("restores a dropped checked from defaultChecked and keeps the attribute", () => {
		for (const type of ["checkbox", "radio"] as const) {
			const { host, tree } = mount(
				jsx("input", { type, defaultChecked: true, checked: true }),
			);
			const input = host.querySelector("input") as HTMLInputElement;
			expect(input.checked).toBe(true);
			expect(input.defaultChecked).toBe(true);
			expect(input.hasAttribute("checked")).toBe(true);

			input.checked = false;
			expect(input.checked).toBe(false);
			expect(input.defaultChecked).toBe(true);

			renderIgniteJsx(host, jsx("input", { type, defaultChecked: true }), tree);

			expect(input.checked).toBe(true);
			expect(input.defaultChecked).toBe(true);
			expect(input.hasAttribute("checked")).toBe(true);
		}
	});

	it("restores a dropped value from the defaultValue applied in the same render", () => {
		const { host, tree } = mount(
			jsx("input", { defaultValue: "foo", value: "bar" }),
		);
		const input = host.querySelector("input") as HTMLInputElement;

		renderIgniteJsx(host, jsx("input", { defaultValue: "baz" }), tree);

		expect(input.value).toBe("baz");
		expect(input.defaultValue).toBe("baz");
		expect(input.getAttribute("value")).toBe("baz");
	});

	it("resets a dropped value to the rendered defaultValue", () => {
		const { host, tree } = mount(
			jsx("input", { defaultValue: "foo", value: "bar" }),
		);
		const input = host.querySelector("input") as HTMLInputElement;
		expect(input.value).toBe("bar");
		expect(input.defaultValue).toBe("foo");
		expect(input.getAttribute("value")).toBe("foo");

		renderIgniteJsx(host, jsx("input", { defaultValue: "foo" }), tree);

		expect(input.value).toBe("foo");
		expect(input.defaultValue).toBe("foo");
		expect(input.getAttribute("value")).toBe("foo");
	});

	it("resets a dropped textarea value to its defaultValue", () => {
		const { host, tree } = mount(
			jsx("textarea", { defaultValue: "foo", value: "bar" }),
		);
		const area = host.querySelector("textarea") as HTMLTextAreaElement;
		expect(area.value).toBe("bar");
		expect(area.defaultValue).toBe("foo");

		renderIgniteJsx(host, jsx("textarea", { defaultValue: "foo" }), tree);

		expect(area.value).toBe("foo");
		expect(area.defaultValue).toBe("foo");
	});

	it("resets a dropped select value to the default-selected option", () => {
		const options = () => [
			jsx("option", { value: "a", children: "A" }),
			jsx("option", { value: "b", defaultSelected: true, children: "B" }),
		];
		const { host, tree } = mount(jsx("select", { children: options() }));
		const select = host.querySelector("select") as HTMLSelectElement;
		const selected = select.querySelector("option:last-child");
		expect(select.value).toBe("b");
		expect(selected?.hasAttribute("selected")).toBe(true);

		const chosen = renderIgniteJsx(
			host,
			jsx("select", { value: "a", children: options() }),
			tree,
		);
		expect(select.value).toBe("a");
		expect(selected?.hasAttribute("selected")).toBe(true);

		renderIgniteJsx(host, jsx("select", { children: options() }), chosen);

		expect(select.value).toBe("b");
		expect(selected?.hasAttribute("selected")).toBe(true);
	});

	it("restores every default selection when a multiple select drops value", () => {
		const options = () => [
			jsx("option", { value: "a", defaultSelected: true, children: "A" }),
			jsx("option", { value: "b", defaultSelected: true, children: "B" }),
			jsx("option", { value: "c", children: "C" }),
		];
		const { host, tree } = mount(
			jsx("select", { multiple: true, children: options() }),
		);
		const select = host.querySelector("select") as HTMLSelectElement;
		expect(
			Array.from(select.selectedOptions).map((option) => option.value),
		).toEqual(["a", "b"]);

		const chosen = renderIgniteJsx(
			host,
			jsx("select", { multiple: true, value: "c", children: options() }),
			tree,
		);
		expect(
			Array.from(select.selectedOptions).map((option) => option.value),
		).toEqual(["c"]);

		renderIgniteJsx(
			host,
			jsx("select", { multiple: true, children: options() }),
			chosen,
		);
		expect(
			Array.from(select.selectedOptions).map((option) => option.value),
		).toEqual(["a", "b"]);
	});

	it("leaves option nodes untouched when length is dropped", () => {
		let mounts = 0;
		let unmounts = 0;
		const ref = () => {
			mounts += 1;
			return () => {
				unmounts += 1;
			};
		};
		const options = () => [
			jsx("option", { ref, value: "a", children: "A" }),
			jsx("option", { ref, value: "b", children: "B" }),
		];
		const { host, tree } = mount(
			jsx("select", { length: 0, children: options() }),
		);
		const select = host.querySelector("select") as HTMLSelectElement;
		const first = select.options.item(0);
		const second = select.options.item(1);
		expect(select.options).toHaveLength(2);
		expect(mounts).toBe(2);

		renderIgniteJsx(host, jsx("select", { children: options() }), tree);

		expect(select.options).toHaveLength(2);
		expect(select.options.item(0)).toBe(first);
		expect(select.options.item(1)).toBe(second);
		expect(mounts).toBe(2);
		expect(unmounts).toBe(0);
	});

	it("mounts a child once when a content prop is dropped", () => {
		const previous = Object.getOwnPropertyDescriptor(
			HTMLElement.prototype,
			"innerText",
		);
		Object.defineProperty(HTMLElement.prototype, "innerText", {
			configurable: true,
			enumerable: true,
			get() {
				return this.textContent ?? "";
			},
			set(value: string) {
				this.textContent = value == null ? "" : String(value);
			},
		});
		try {
			let mounts = 0;
			let unmounts = 0;
			const ref = () => {
				mounts += 1;
				return () => {
					unmounts += 1;
				};
			};
			const child = () => jsx("span", { ref, children: "kept" });
			const { host, tree } = mount(
				jsx(
					"div",
					unsupportedJsxProps({ innerText: "gone", children: child() }),
				),
			);
			const span = host.querySelector("span");
			expect(span?.textContent).toBe("kept");
			expect(mounts).toBe(1);

			renderIgniteJsx(host, jsx("div", { children: child() }), tree);

			expect(host.querySelector("span")).toBe(span);
			expect(mounts).toBe(1);
			expect(unmounts).toBe(0);

			unmountIgniteSubtree(host);
			expect(mounts).toBe(1);
			expect(unmounts).toBe(1);
		} finally {
			if (previous) {
				Object.defineProperty(HTMLElement.prototype, "innerText", previous);
			} else {
				Reflect.deleteProperty(HTMLElement.prototype, "innerText");
			}
		}
	});

	it("resets a dropped prop as if it had never been set", () => {
		const card = "x-drop-card";
		const raw = "x-drop-raw";
		const inherit = "x-drop-inherit";
		const boom = "x-drop-boom";
		if (!customElements.get(card)) {
			class CardElement extends HTMLElement {
				hrefLog: unknown[] = [];
				codebaseLog: unknown[] = [];
				blankLog: unknown[] = [];
				#count: number | null = null;
				#flag: boolean | null = null;
				#label = "";
				#blank: string | null = null;
				#href = "";
				#codebase = "";
				get count() {
					return this.#count;
				}
				set count(value: unknown) {
					if (value == null) {
						this.#count = null;
						return;
					}
					this.#count = Number(value);
				}
				get flag() {
					return this.#flag;
				}
				set flag(value: unknown) {
					this.#flag = value == null ? null : Boolean(value);
				}
				get label() {
					return this.#label;
				}
				set label(value: unknown) {
					this.#label = value == null ? "" : String(value).trim();
				}
				get blank() {
					return this.#blank;
				}
				set blank(value: unknown) {
					this.blankLog.push(value);
					this.#blank = value == null ? null : String(value);
				}
				get href() {
					return this.#href;
				}
				set href(value: unknown) {
					this.hrefLog.push(value);
					if (value == null || value === "") {
						this.#href = "";
						return;
					}
					this.#href = new URL(String(value), location.href).href;
				}
				get codebase() {
					return this.#codebase;
				}
				set codebase(value: unknown) {
					this.codebaseLog.push(value);
					if (value == null || value === "") {
						this.#codebase = "";
						return;
					}
					this.#codebase = new URL(String(value), location.href).href;
				}
			}
			customElements.define(card, CardElement);
		}
		if (!customElements.get(raw)) {
			class RawUrlElement extends HTMLElement {
				hrefLog: unknown[] = [];
				#href = "";
				get href() {
					return this.#href;
				}
				set href(value: unknown) {
					this.hrefLog.push(value);
					this.#href = new URL(String(value), location.href).href;
				}
			}
			customElements.define(raw, RawUrlElement);
		}
		if (!customElements.get(inherit)) {
			customElements.define(inherit, class extends HTMLElement {});
		}
		if (!customElements.get(boom)) {
			class BoomElement extends HTMLElement {
				#count: number | null = null;
				get count() {
					return this.#count;
				}
				set count(value: unknown) {
					if (value == null) {
						this.#count = null;
						return;
					}
					this.#count = Number(value);
				}
				get locked() {
					return 4;
				}
				set boom(value: unknown) {
					if (value === undefined) throw new Error("boom");
				}
			}
			customElements.define(boom, BoomElement);
		}

		const read = (host: HTMLElement, tag: string) =>
			host.querySelector(tag) as HTMLElement & Record<string, unknown>;

		for (const value of [1, true] as const) {
			for (const row of [
				["input", "checked", HTMLInputElement.prototype, { type: "checkbox" }],
				["input", "disabled", HTMLInputElement.prototype, {}],
				["option", "selected", HTMLOptionElement.prototype, {}],
				["select", "multiple", HTMLSelectElement.prototype, {}],
				["div", "hidden", HTMLElement.prototype, {}],
			] as const) {
				const [tag, prop, prototype, extra] = row;
				withSetter(prototype, prop, (assigned) => {
					const { host, tree } = mount(jsx(tag, { ...extra, [prop]: value }));
					const element = read(host, tag);
					expect(element[prop], prop).toBe(true);
					assigned.length = 0;
					renderIgniteJsx(host, jsx(tag, { ...extra }), tree);
					expect(element[prop], `${prop} ${String(value)}`).toBe(false);
					expect(assigned, prop).toContain(false);
					expect(assigned, prop).not.toContain(undefined);
				});
			}
		}

		const strings = mount(
			jsx("div", { id: "keep", title: "named", lang: "en", slot: "body" }),
		);
		renderIgniteJsx(strings.host, jsx("div", {}), strings.tree);
		const named = read(strings.host, "div");
		for (const prop of ["id", "title", "lang", "slot"] as const) {
			expect(named[prop], prop).toBe("");
			expect(named.getAttribute(prop), prop).toBeNull();
			expect(named[prop], prop).not.toBe("undefined");
		}

		const classed = mount(jsx("div", { className: "on" }));
		renderIgniteJsx(classed.host, jsx("div", {}), classed.tree);
		const className = read(classed.host, "div");
		expect(className.className).toBe("");
		expect(className.getAttribute("class")).toBeNull();

		for (const value of ["hello", 1, ""] as const) {
			const viewed = mount(jsx("input", { value }));
			const input = read(viewed.host, "input");
			renderIgniteJsx(viewed.host, jsx("input", {}), viewed.tree);
			expect(input.value, `value ${String(value)}`).toBe("");
			expect(String(input.value)).not.toBe("undefined");
		}

		withSetter(HTMLInputElement.prototype, "value", (assigned) => {
			const viewed = mount(jsx("input", { type: "file", value: "" }));
			const input = viewed.host.querySelector("input");
			assigned.length = 0;
			renderIgniteJsx(viewed.host, jsx("input", { type: "file" }), viewed.tree);
			expect(input?.value).toBe("");
			expect(assigned).not.toContain(undefined);
		});

		for (const tag of ["div", inherit] as const) {
			const viewed = mount(jsx(tag, { tabIndex: 3 }));
			const element = read(viewed.host, tag);
			expect(element.tabIndex).toBe(3);
			renderIgniteJsx(viewed.host, jsx(tag, {}), viewed.tree);
			expect(element.tabIndex, tag).toBe(-1);
			expect(element.getAttribute("tabindex"), tag).toBeNull();
		}

		const scrolled = mount(
			jsx("div", {
				style: "height:40px;width:40px;overflow:auto",
				scrollTop: "10",
				scrollLeft: "8",
				children: jsx("div", { style: "height:400px;width:400px" }),
			}),
		);
		const box = read(scrolled.host, "div");
		expect(box.scrollTop).toBe(10);
		expect(box.scrollLeft).toBe(8);
		renderIgniteJsx(
			scrolled.host,
			jsx("div", {
				style: "height:40px;width:40px;overflow:auto",
				children: jsx("div", { style: "height:400px;width:400px" }),
			}),
			scrolled.tree,
		);
		expect(box.scrollTop).toBe(0);
		expect(box.scrollLeft).toBe(0);

		const zeroScroll = mount(jsx("div", { scrollTop: 0 }));
		renderIgniteJsx(zeroScroll.host, jsx("div", {}), zeroScroll.tree);
		expect(read(zeroScroll.host, "div").scrollTop).toBe(0);

		for (const count of ["1", true, "0", 0] as const) {
			const viewed = mount(jsx(card, { count }));
			const element = read(viewed.host, card);
			expect(element.count, `count ${String(count)}`).toBe(
				count === "0" || count === 0 ? 0 : 1,
			);
			renderIgniteJsx(viewed.host, jsx(card, {}), viewed.tree);
			expect(element.count, `count drop ${String(count)}`).toBeNull();
		}

		const flagged = mount(jsx(card, { flag: true }));
		const flag = read(flagged.host, card);
		expect(flag.flag).toBe(true);
		renderIgniteJsx(flagged.host, jsx(card, {}), flagged.tree);
		expect(flag.flag).toBeNull();

		const nan = mount(jsx(card, { count: "nope" }));
		const nanElement = read(nan.host, card);
		expect(Number.isNaN(nanElement.count)).toBe(true);
		renderIgniteJsx(nan.host, jsx(card, {}), nan.tree);
		expect(nanElement.count).toBeNull();

		const presentBlank = mount(jsx(card, { blank: "x" }));
		const present = read(presentBlank.host, card);
		(present.blankLog as unknown[]).length = 0;
		renderIgniteJsx(
			presentBlank.host,
			jsx(card, { blank: "" }),
			presentBlank.tree,
		);
		expect(present.blank).toBe("");
		expect(present.blankLog).toContain("");
		expect(present.blankLog).not.toContain(undefined);

		const droppedBlank = mount(jsx(card, { blank: "" }));
		const blank = read(droppedBlank.host, card);
		expect(blank.blank).toBe("");
		(blank.blankLog as unknown[]).length = 0;
		renderIgniteJsx(droppedBlank.host, jsx(card, {}), droppedBlank.tree);
		expect(blank.blank).toBeNull();
		expect(blank.blankLog).toContain(undefined);

		const trimmed = mount(jsx(card, { label: "  keep  " }));
		const label = read(trimmed.host, card);
		expect(label.label).toBe("keep");
		renderIgniteJsx(trimmed.host, jsx(card, {}), trimmed.tree);
		expect(label.label).toBe("");

		for (const key of ["href", "codebase"] as const) {
			const viewed = mount(jsx(card, { [key]: "/safe.txt" }));
			const element = read(viewed.host, card);
			const logKey = key === "href" ? "hrefLog" : "codebaseLog";
			expect(String(element[key])).toContain("/safe.txt");
			renderIgniteJsx(
				viewed.host,
				jsx(card, { [key]: "javascript:alert(1)" }),
				viewed.tree,
			);
			expect(element[key], key).toBe("");
			expect(element[logKey], key).toContain(undefined);
			expect(element[key], key).not.toBe(new URL("", location.href).href);
		}

		const unguarded = mount(jsx(raw, { href: "/safe.txt" }));
		const rawElement = read(unguarded.host, raw);
		renderIgniteJsx(
			unguarded.host,
			jsx(raw, { href: "javascript:alert(1)" }),
			unguarded.tree,
		);
		expect(String(rawElement.href)).toContain("/undefined");
		expect(rawElement.hrefLog).toContain(undefined);
		expect(rawElement.hrefLog).not.toContain("");

		withSetter(HTMLIFrameElement.prototype, "src", (assigned) => {
			const viewed = mount(jsx("iframe", { src: "/safe.txt" }));
			renderIgniteJsx(
				viewed.host,
				jsx("iframe", { src: "javascript:alert(1)" }),
				viewed.tree,
			);
			renderIgniteJsx(viewed.host, jsx("iframe", {}), viewed.tree);
			expect(
				assigned.some((value) => String(value).includes("/safe.txt")),
			).toBe(true);
			expect(assigned).not.toContain(undefined);
			expect(
				viewed.host.querySelector("iframe")?.getAttribute("src"),
			).toBeNull();
		});

		for (const row of [
			["a", "href"],
			["object", "data"],
			["embed", "src"],
		] as const) {
			const [tag, key] = row;
			const viewed = mount(jsx(tag, { [key]: "/safe.txt" }));
			renderIgniteJsx(
				viewed.host,
				jsx(tag, { [key]: "javascript:alert(1)" }),
				viewed.tree,
			);
			renderIgniteJsx(viewed.host, jsx(tag, {}), viewed.tree);
			const element = read(viewed.host, tag);
			expect(element.getAttribute(key), tag).toBeNull();
			expect(String(element[key] ?? ""), tag).not.toContain("undefined");
			expect(String(element[key] ?? ""), tag).not.toContain("javascript:");
			if (tag === "a") expect(element.href).toBe("");
		}

		const noted = mount(
			jsx("meta", { "data-equiv": "refresh", "data-note": "x", content: "0" }),
		);
		expect(noted.host.querySelector("meta")?.getAttribute("data-equiv")).toBe(
			"refresh",
		);
		renderIgniteJsx(noted.host, jsx("meta", { content: "0" }), noted.tree);
		expect(
			noted.host.querySelector("meta")?.getAttribute("data-equiv"),
		).toBeNull();
		expect(
			noted.host.querySelector("meta")?.getAttribute("data-note"),
		).toBeNull();

		const labelled = mount(jsx("div", { "aria-label": "x", "data-note": "x" }));
		renderIgniteJsx(labelled.host, jsx("div", {}), labelled.tree);
		expect(read(labelled.host, "div").getAttribute("aria-label")).toBeNull();
		expect(read(labelled.host, "div").getAttribute("data-note")).toBeNull();

		for (const key of [
			"http-equiv",
			"httpEquiv",
			"http-equiv ",
			" http-equiv",
			"http-equiv\0",
			"{http://www.w3.org/1999/xhtml}http-equiv",
		]) {
			const viewed = mount(
				jsx("meta", { [key]: "refresh", content: "0;url=https://example.com" }),
			);
			expect(
				viewed.host.querySelector("meta")?.getAttribute("http-equiv"),
				key,
			).toBeNull();
		}
		for (const httpEquiv of ["content-type", "Content-Type", "default-style"]) {
			const viewed = mount(jsx("meta", { httpEquiv, content: "text/html" }));
			expect(
				viewed.host.querySelector("meta")?.getAttribute("http-equiv"),
			).toBe(httpEquiv);
			renderIgniteJsx(
				viewed.host,
				jsx("meta", { content: "text/html" }),
				viewed.tree,
			);
			expect(
				viewed.host.querySelector("meta")?.getAttribute("http-equiv"),
				httpEquiv,
			).toBeNull();
		}

		const renamedMeta = mount(jsx("meta", { httpEquiv: "content-type" }));
		renderIgniteJsx(
			renamedMeta.host,
			jsx("meta", { "http-equiv": "default-style" }),
			renamedMeta.tree,
		);
		expect(
			renamedMeta.host.querySelector("meta")?.getAttribute("http-equiv"),
		).toBe("default-style");

		const renamed = mount(jsx("div", { scrollTop: "10", id: "a" }));
		renderIgniteJsx(renamed.host, jsx("div", { id: "b" }), renamed.tree);
		const renamedElement = read(renamed.host, "div");
		expect(renamedElement.scrollTop).toBe(0);
		expect(renamedElement.id).toBe("b");

		const spreadDrop = mount(jsx(card, { ...{ scrollTop: "10", count: "1" } }));
		renderIgniteJsx(spreadDrop.host, jsx(card, { ...{} }), spreadDrop.tree);
		const spread = read(spreadDrop.host, card);
		expect(spread.scrollTop).toBe(0);
		expect(spread.count).toBeNull();

		const spreadKeep = mount(jsx("div", { ...{ id: "a", scrollTop: "10" } }));
		renderIgniteJsx(
			spreadKeep.host,
			jsx("div", { ...{ id: "a" } }),
			spreadKeep.tree,
		);
		const kept = read(spreadKeep.host, "div");
		expect(kept.id).toBe("a");
		expect(kept.scrollTop).toBe(0);

		const rejected = mount(jsx("iframe", { src: "javascript:alert(1)" }));
		renderIgniteJsx(rejected.host, jsx("iframe", {}), rejected.tree);
		expect(
			rejected.host.querySelector("iframe")?.getAttribute("src"),
		).toBeNull();
		expect(String(read(rejected.host, "iframe").src ?? "")).not.toContain(
			"undefined",
		);

		const inherited = mount(
			jsx(inherit, {
				id: "keep",
				title: "named",
				tabIndex: 3,
				className: "on",
			}),
		);
		const custom = read(inherited.host, inherit);
		expect(custom.id).toBe("keep");
		expect(custom.title).toBe("named");
		expect(custom.tabIndex).toBe(3);
		renderIgniteJsx(inherited.host, jsx(inherit, {}), inherited.tree);
		expect(custom.id).toBe("");
		expect(custom.title).toBe("");
		expect(custom.getAttribute("id")).toBeNull();
		expect(custom.getAttribute("title")).toBeNull();
		expect(custom.tabIndex).toBe(-1);
		expect(custom.getAttribute("tabindex")).toBeNull();
		expect(custom.className).toBe("");
		expect(custom.getAttribute("class")).toBeNull();

		const media = mount(
			jsx("audio", {
				id: "clip",
				currentTime: 4,
				volume: 0.25,
				playbackRate: 0,
			}),
		);
		const audio = read(media.host, "audio");
		renderIgniteJsx(media.host, jsx("audio", {}), media.tree);
		expect(audio.currentTime).toBe(0);
		expect(audio.volume).toBe(1);
		expect(audio.playbackRate).toBe(1);
		expect(audio.id).toBe("");
		expect(audio.getAttribute("id")).toBeNull();

		const thrown = mount(jsx(boom, { boom: 1, count: "1", locked: 9 }));
		const thrownElement = read(thrown.host, boom);
		expect(thrownElement.count).toBe(1);
		expect(thrownElement.locked).toBe(4);
		renderIgniteJsx(thrown.host, jsx(boom, {}), thrown.tree);
		expect(thrownElement.count).toBeNull();
		expect(thrownElement.locked).toBe(4);
	});

	it.each(["href", "src", "action", "formAction"] as const)(
		"clears a non-reflected %s property when a later value is executable",
		(key) => {
			const tag = `x-url-${key.toLowerCase()}`;
			if (!customElements.get(tag)) {
				class UrlElement extends HTMLElement {
					href = "";
					src = "";
					action = "";
					formAction = "";
				}
				customElements.define(tag, UrlElement);
			}

			const { host, tree } = mount(
				jsx(tag, { [key]: "https://safe.example/keep" }),
			);
			const element = host.querySelector(tag) as HTMLElement &
				Record<typeof key, string>;
			expect(element[key]).toBe("https://safe.example/keep");

			renderIgniteJsx(host, jsx(tag, { [key]: "javascript:alert(1)" }), tree);

			expect(element[key] ?? "").not.toBe("https://safe.example/keep");
			expect(String(element[key] ?? "")).not.toContain("javascript:");
		},
	);

	it.each(["href", "codebase"] as const)(
		"clears a custom %s setter that stored an absolute URL",
		(key) => {
			const tag = `x-abs-${key}`;
			if (!customElements.get(tag)) {
				class UrlElement extends HTMLElement {
					#value = "";
					get [key]() {
						return this.#value;
					}
					set [key](value: unknown) {
						// null and "" must not reach new URL. undefined becomes the
						// relative URL "undefined", and "" becomes the document URL.
						if (value == null || value === "") {
							this.#value = "";
							return;
						}
						this.#value = new URL(String(value), location.href).href;
					}
				}
				customElements.define(tag, UrlElement);
			}

			const { host, tree } = mount(jsx(tag, { [key]: "/safe.txt" }));
			const element = host.querySelector(tag) as HTMLElement &
				Record<typeof key, string>;
			expect(element[key]).toContain("/safe.txt");
			expect(element[key].startsWith("http")).toBe(true);
			expect(element.getAttribute(key)).toBeNull();

			renderIgniteJsx(host, jsx(tag, { [key]: "javascript:alert(1)" }), tree);

			expect(element[key]).toBe("");
			expect(element.getAttribute(key)).toBeNull();
		},
	);

	it("clears a custom property whose setter coerced the value", () => {
		const tag = "x-count-coerced";
		if (!customElements.get(tag)) {
			class CountElement extends HTMLElement {
				#count: number | null = null;
				get count() {
					return this.#count;
				}
				set count(value: unknown) {
					// null and undefined are empty. Number(undefined) is NaN.
					if (value == null) {
						this.#count = null;
						return;
					}
					this.#count = Number(value);
				}
			}
			customElements.define(tag, CountElement);
		}

		for (const count of ["1", true, "0"] as const) {
			const { host, tree } = mount(jsx(tag, { count }));
			const element = host.querySelector(tag) as HTMLElement & {
				count: number | null;
			};
			expect(element.count).toBe(count === "0" ? 0 : 1);

			renderIgniteJsx(host, jsx(tag, {}), tree);

			expect(element.count).toBeNull();
		}
	});

	it("assigns undefined when a custom setter overrides an inherited name", () => {
		const tag = "x-id-override";
		if (!customElements.get(tag)) {
			class IdOverride extends HTMLElement {
				idLog: unknown[] = [];
				#id = "";
				get id() {
					return this.#id;
				}
				set id(value: string) {
					this.idLog.push(value);
					// undefined is the drop signal. "" is the native reset.
					this.#id =
						(value as unknown) === undefined
							? "from-undefined"
							: String(value ?? "");
				}
			}
			customElements.define(tag, IdOverride);
		}

		const { host, tree } = mount(jsx(tag, { id: "keep" }));
		const element = host.querySelector(tag) as HTMLElement & {
			idLog: unknown[];
		};
		expect(element.id).toBe("keep");
		element.idLog.length = 0;

		renderIgniteJsx(host, jsx(tag, {}), tree);

		expect(element.idLog).toContain(undefined);
		expect(element.id).toBe("from-undefined");
		expect(element.id).not.toBe("");
	});

	it("does not construct a custom element to read a native default", () => {
		const tag = "x-no-construct";
		let constructed = 0;
		if (!customElements.get(tag)) {
			class NoConstruct extends HTMLElement {
				constructor() {
					super();
					constructed += 1;
				}
			}
			customElements.define(tag, NoConstruct);
		}
		constructed = 0;

		const { host, tree } = mount(jsx(tag, { title: "named", scrollTop: 4 }));
		const element = host.querySelector(tag) as HTMLElement;
		expect(constructed).toBe(1);
		expect(element.title).toBe("named");
		expect(element.scrollTop).toBe(4);

		renderIgniteJsx(host, jsx(tag, {}), tree);

		expect(constructed).toBe(1);
		expect(element.title).toBe("");
		expect(element.getAttribute("title")).toBeNull();
		expect(element.scrollTop).toBe(0);
	});

	it("does not assign a blank width when a loaded image drops width", () => {
		const descriptor = Object.getOwnPropertyDescriptor(
			HTMLImageElement.prototype,
			"width",
		);
		if (!descriptor?.get || !descriptor.set) {
			throw new Error("missing width setter");
		}
		const assigned: unknown[] = [];
		Object.defineProperty(HTMLImageElement.prototype, "width", {
			configurable: true,
			enumerable: descriptor.enumerable,
			get() {
				const attr = this.getAttribute("width");
				if (attr != null) return Number(attr);
				return this.dataset.loaded === "1" ? 48 : 0;
			},
			set(value: unknown) {
				assigned.push(value);
				const next = Number(value);
				if (!next) this.removeAttribute("width");
				else this.setAttribute("width", String(next));
			},
		});

		try {
			const { host, tree } = mount(jsx("img", { width: 40 }));
			const image = host.querySelector("img") as HTMLImageElement;
			image.dataset.loaded = "1";
			expect(image.width).toBe(40);
			assigned.length = 0;

			renderIgniteJsx(host, jsx("img", {}), tree);

			expect(assigned).not.toContain(0);
			expect(image.getAttribute("width")).toBeNull();
			expect(image.width).toBe(48);

			assigned.length = 0;
			const matched = mount(jsx("img", { width: 48 }));
			const matchedImage = matched.host.querySelector(
				"img",
			) as HTMLImageElement;
			matchedImage.dataset.loaded = "1";
			expect(matchedImage.width).toBe(48);
			assigned.length = 0;
			renderIgniteJsx(matched.host, jsx("img", {}), matched.tree);
			expect(assigned).not.toContain(0);
			expect(matchedImage.getAttribute("width")).toBeNull();
			expect(matchedImage.width).toBe(48);
		} finally {
			Object.defineProperty(HTMLImageElement.prototype, "width", descriptor);
		}
	});

	it("still resets scrollTop and checked while width stays natural", () => {
		const { host, tree } = mount(
			jsx("div", {
				scrollTop: 6,
				children: jsx("input", { type: "checkbox", checked: true }),
			}),
		);
		const box = host.querySelector("div") as HTMLElement;
		const input = host.querySelector("input") as HTMLInputElement;
		expect(box.scrollTop).toBe(6);
		expect(input.checked).toBe(true);

		renderIgniteJsx(
			host,
			jsx("div", { children: jsx("input", { type: "checkbox" }) }),
			tree,
		);

		expect(box.scrollTop).toBe(0);
		expect(input.checked).toBe(false);
	});

	it("clears a later prop when a custom URL setter throws", () => {
		const tag = "x-href-throws";
		if (!customElements.get(tag)) {
			class HrefThrows extends HTMLElement {
				hrefLog: unknown[] = [];
				#count: number | null = null;
				#href = "";
				get count() {
					return this.#count;
				}
				set count(value: unknown) {
					this.#count = value == null ? null : Number(value);
				}
				get href() {
					return this.#href;
				}
				set href(value: unknown) {
					this.hrefLog.push(value);
					if (value === undefined) throw new Error("href boom");
					this.#href = String(value ?? "");
				}
			}
			customElements.define(tag, HrefThrows);
		}

		const { host, tree } = mount(jsx(tag, { href: "/safe.txt", count: "1" }));
		const element = host.querySelector(tag) as HTMLElement & {
			count: number | null;
			hrefLog: unknown[];
		};
		expect(element.count).toBe(1);
		element.hrefLog.length = 0;

		expect(() => renderIgniteJsx(host, jsx(tag, {}), tree)).not.toThrow();

		expect(element.hrefLog).toContain(undefined);
		expect(element.count).toBeNull();
	});

	it("resets inherited custom id and title by attribute removal", () => {
		const tag = "x-id-reflected";
		if (!customElements.get(tag)) {
			customElements.define(tag, class extends HTMLElement {});
		}

		const { host, tree } = mount(
			jsx(tag, { id: "keep", title: "named", tabIndex: 3, className: "on" }),
		);
		const element = host.querySelector(tag) as HTMLElement;
		expect(element.id).toBe("keep");
		expect(element.title).toBe("named");
		expect(element.tabIndex).toBe(3);
		expect(element.className).toBe("on");

		renderIgniteJsx(host, jsx(tag, {}), tree);

		expect(element.id).toBe("");
		expect(element.title).toBe("");
		expect(element.getAttribute("id")).toBeNull();
		expect(element.getAttribute("title")).toBeNull();
		expect(element.tabIndex).toBe(-1);
		expect(element.getAttribute("tabindex")).toBeNull();
		expect(element.className).toBe("");
	});

	it("clears a custom string setter that trimmed the value", () => {
		const tag = "x-label-trimmed";
		if (!customElements.get(tag)) {
			class LabelElement extends HTMLElement {
				#label = "";
				get label() {
					return this.#label;
				}
				set label(value: unknown) {
					this.#label = value == null ? "" : String(value).trim();
				}
			}
			customElements.define(tag, LabelElement);
		}

		const { host, tree } = mount(jsx(tag, { label: "  keep  " }));
		const element = host.querySelector(tag) as HTMLElement & { label: string };
		expect(element.label).toBe("keep");

		renderIgniteJsx(host, jsx(tag, {}), tree);

		expect(element.label).toBe("");
	});

	it("applies a safe URL after an executable one was rejected", () => {
		const { host, tree } = mount(
			jsx("a", { href: "javascript:alert(1)", children: "go" }),
		);
		expect(host.querySelector("a")?.getAttribute("href")).toBeNull();

		renderIgniteJsx(
			host,
			jsx("a", { href: "https://example.com/later", children: "go" }),
			tree,
		);

		expect(host.querySelector("a")?.getAttribute("href")).toContain(
			"https://example.com/later",
		);
	});

	it.each([
		"data:text/javascript,alert(1)",
		"data:application/javascript,alert(1)",
		"data:text/ecmascript,alert(1)",
		"data:application/ecmascript,alert(1)",
		"data:\ntext/javascript,alert(1)",
	])("does not apply %s on script", (src) => {
		const { host } = mount(jsx("script", { src }));

		expect(host.querySelector("script")?.getAttribute("src")).toBeNull();
	});

	it("still applies a network script src", () => {
		const { host } = mount(
			jsx("script", { src: "https://example.com/app.js" }),
		);

		expect(host.querySelector("script")?.getAttribute("src")).toContain(
			"https://example.com/app.js",
		);
	});

	it.each(["iframe", "frame", "embed"] as const)(
		"does not apply any data URL on %s",
		(tag) => {
			const { host } = mount(
				jsx("div", {
					children: [
						jsx(tag, { src: "data:,<script>alert(1)</script>" }),
						jsx(tag, { src: "data:text/html,<script>alert(1)</script>" }),
						jsx(tag, { src: "data:image/png;base64,aaaa" }),
					],
				}),
			);

			for (const element of host.querySelectorAll(tag)) {
				expect(element.getAttribute("src")).toBeNull();
			}
		},
	);

	it("does not apply any data URL on object", () => {
		const { host } = mount(
			jsx("object", { data: "data:image/png;base64,aaaa" }),
		);

		expect(host.querySelector("object")?.getAttribute("data")).toBeNull();
		expect(host.querySelector("object")?.data ?? "").not.toContain("image/png");
	});

	it.each(["DATA", "Data"] as const)(
		"does not apply an executable %s URL on object",
		(key) => {
			const { host } = mount(
				jsx("object", {
					[key]: "data:text/html,<script>alert(1)</script>",
					type: "text/html",
				}),
			);
			const object = host.querySelector("object");

			expect(object?.getAttribute("data")).toBeNull();
			expect(object?.data ?? "").not.toContain("text/html");
			expect(object?.getAttribute("type")).toBe("text/html");
		},
	);

	it("still applies a safe object DATA url", () => {
		const { host } = mount(
			jsx("object", { DATA: "https://example.com/file.pdf" }),
		);

		expect(host.querySelector("object")?.getAttribute("data")).toContain(
			"https://example.com/file.pdf",
		);
	});

	it.each([
		["div", "ONCLICK"],
		["button", "OnClick"],
		["img", "ONERROR"],
		["div", "ONLOAD"],
		["button", "OnFocus"],
	] as const)(
		"does not set a %s %s string as an event-handler attribute",
		(tag, key) => {
			const { host } = mount(
				jsx(tag, {
					[key]: "alert(1)",
					src: tag === "img" ? "https://example.com/pixel.png" : undefined,
					children: tag === "img" ? undefined : "click",
				}),
			);
			const element = host.querySelector(tag);

			expect(element?.getAttribute(key.toLowerCase())).toBeNull();
			expect(element?.getAttribute(key)).toBeNull();
			if (tag === "img") {
				expect(element?.getAttribute("src")).toContain("example.com/pixel.png");
			}
		},
	);

	it("does not set an xlink:onclick string", () => {
		const { host } = mount(
			jsx("svg", {
				children: jsx("a", {
					"xlink:onclick": "alert(1)",
					"xlink:href": "https://example.com/ok",
					children: "go",
				}),
			}),
		);
		const anchor = host.querySelector("a");

		expect(anchor?.getAttribute("xlink:onclick")).toBeNull();
		expect(anchor?.getAttribute("onclick")).toBeNull();
		expect(anchor?.getAttribute("xlink:href")).toContain(
			"https://example.com/ok",
		);
	});

	it("still binds a function onClick without an onclick attribute", () => {
		const onClick = vi.fn();
		const { host } = mount(jsx("button", { onClick, children: "click" }));
		const button = host.querySelector("button");

		expect(button?.getAttribute("onclick")).toBeNull();
		button?.click();
		expect(onClick).toHaveBeenCalledOnce();
	});

	it("still applies a data image srcset on img and source", () => {
		const { host } = mount(
			jsx("div", {
				children: [
					jsx("img", {
						alt: "pixel",
						srcset: "data:image/png;base64,aaaa 1x",
					}),
					jsx("source", { srcset: "data:image/png;base64,bbbb 1x" }),
				],
			}),
		);

		expect(host.querySelector("img")?.getAttribute("srcset")).toContain(
			"data:image/png",
		);
		expect(host.querySelector("source")?.getAttribute("srcset")).toContain(
			"data:image/png",
		);
	});

	it("does not apply an executable codebase", () => {
		const { host } = mount(jsx("object", { codebase: "javascript:alert(1)" }));

		expect(host.querySelector("object")?.getAttribute("codebase")).toBeNull();
	});

	it.each([
		"javascript:alert(1)",
		"vbscript:msgbox(1)",
		"data:text/javascript,alert(1)",
		"data:",
		"data:image/png;base64,aaaa",
	])("does not apply object codebase %s", (codebase) => {
		const { host } = mount(jsx("object", { codebase }));

		expect(host.querySelector("object")?.getAttribute("codebase")).toBeNull();
	});

	it.each([
		"javascript:alert(1)",
		"vbscript:msgbox(1)",
		"data:text/javascript,alert(1)",
		"data:",
		"data:image/png;base64,aaaa",
	])("does not apply applet codebase %s", (codebase) => {
		const { host } = mount(jsx("applet", { codebase }));

		expect(host.querySelector("applet")?.getAttribute("codebase")).toBeNull();
	});

	it.each(["https://example.com/lib", "packages/app"])(
		"still applies applet codebase %s",
		(codebase) => {
			const { host } = mount(jsx("applet", { codebase }));

			expect(host.querySelector("applet")?.getAttribute("codebase")).toBe(
				codebase,
			);
		},
	);

	it("still applies a non-href SVG animate value on attributeName", () => {
		const { host } = mount(
			jsx("svg", {
				children: jsx("animate", {
					attributeName: "width",
					to: "100%",
				}),
			}),
		);
		const animate = host.querySelector("animate");

		expect(animate?.getAttribute("attributeName")).toBe("width");
		expect(animate?.getAttribute("attribute-name")).toBeNull();
		expect(animate?.getAttribute("to")).toBe("100%");
	});

	it.each([
		[
			"set",
			"to",
			{ attributeName: "href", to: "javascript:alert(1)", begin: "0s" },
		],
		[
			"animate",
			"values",
			{
				attributeName: "href",
				values: "javascript:alert(1)",
				begin: "0s",
			},
		],
		[
			"animate",
			"to",
			{ attributeName: "href", to: "javascript:alert(1)", begin: "0s" },
		],
		[
			"animate",
			"to",
			{
				attributeName: "xlink:href",
				to: "javascript:alert(1)",
				begin: "0s",
			},
		],
		["animate", "by", { attributeName: "href", by: "javascript:alert(1)" }],
		["set", "from", { attributeName: "href", from: "javascript:alert(1)" }],
		[
			"animate",
			"values",
			{
				attributeName: "href",
				values: "https://example.com/ok;javascript:alert(1)",
			},
		],
	] as const)(
		"does not apply an executable %s %s when attributeName targets href",
		(tag, blockedKey, props) => {
			const { host } = mount(
				jsx("svg", {
					children: jsx("a", {
						href: "https://example.com/ok",
						children: jsx(tag, props),
					}),
				}),
			);
			const animated = host.querySelector(tag);

			expect(animated?.getAttribute("attributeName")).toBe(props.attributeName);
			expect(animated?.getAttribute("attribute-name")).toBeNull();
			expect(animated?.getAttribute(blockedKey) ?? "").not.toContain(
				"javascript:",
			);
		},
	);

	it("does not apply animate from or to when attributeName targets href", () => {
		const { host } = mount(
			jsx("svg", {
				children: jsx("animate", {
					attributeName: "href",
					from: "javascript:alert(1)",
					to: "https://example.com/next",
				}),
			}),
		);
		const animate = host.querySelector("animate");

		expect(animate?.getAttribute("attributeName")).toBe("href");
		expect(animate?.getAttribute("from")).toBeNull();
		expect(animate?.getAttribute("to")).toBeNull();
	});

	it("does not apply an array animate from when attributeName targets href", () => {
		const { host } = mount(
			jsx("svg", {
				children: jsx("animate", {
					attributeName: "href",
					from: ["javascript:alert(1)"],
					to: "https://example.com/next",
				}),
			}),
		);
		const animate = host.querySelector("animate");

		expect(animate?.getAttribute("from")).toBeNull();
		expect(animate?.getAttribute("to")).toBeNull();
	});

	it("does not apply a non-string set to when attributeName targets href", () => {
		const { host } = mount(
			jsx("svg", {
				children: jsx("set", {
					attributeName: "href",
					to: ["javascript:alert(1)"],
				}),
			}),
		);

		expect(host.querySelector("set")?.getAttribute("to")).toBeNull();
	});

	it("does not apply a non-string animate values when attributeName targets href", () => {
		const toValues = {
			toString() {
				return "javascript:alert(1)";
			},
		};
		const { host } = mount(
			jsx("svg", {
				children: jsx("animate", {
					attributeName: "href",
					values: toValues,
				}),
			}),
		);

		expect(host.querySelector("animate")?.getAttribute("values")).toBeNull();
	});

	it("does not apply animate values when a javascript token is in the middle", () => {
		const { host } = mount(
			jsx("svg", {
				children: jsx("animate", {
					attributeName: "href",
					values:
						"https://example.com/a;javascript:alert(1);https://example.com/b",
				}),
			}),
		);

		expect(host.querySelector("animate")?.getAttribute("values")).toBeNull();
	});

	it("does not apply animate by when attributeName targets href", () => {
		const { host } = mount(
			jsx("svg", {
				children: jsx("animate", {
					attributeName: "href",
					by: "javascript:alert(1)",
				}),
			}),
		);

		expect(host.querySelector("animate")?.getAttribute("by")).toBeNull();
	});

	it("does not apply animateMotion from or to when attributeName targets href", () => {
		const { host } = mount(
			jsx("svg", {
				children: jsx("animateMotion", {
					attributeName: "href",
					from: "javascript:alert(1)",
					to: "javascript:alert(1)",
				}),
			}),
		);
		const motion = host.querySelector("animateMotion");

		expect(motion?.getAttribute("attributeName")).toBe("href");
		expect(motion?.getAttribute("from")).toBeNull();
		expect(motion?.getAttribute("to")).toBeNull();
	});

	it("does not apply animate to when attributeName is xlink:href", () => {
		const { host } = mount(
			jsx("svg", {
				children: jsx("animate", {
					attributeName: "xlink:href",
					to: "javascript:alert(1)",
				}),
			}),
		);
		const animate = host.querySelector("animate");

		expect(animate?.getAttribute("attributeName")).toBe("xlink:href");
		expect(animate?.getAttribute("to")).toBeNull();
	});

	it("does not apply animate to when attributeName is HREF", () => {
		const { host } = mount(
			jsx("svg", {
				children: jsx("animate", {
					attributeName: "HREF",
					to: "javascript:alert(1)",
				}),
			}),
		);
		const animate = host.querySelector("animate");

		expect(animate?.getAttribute("attributeName")).toBe("HREF");
		expect(animate?.getAttribute("to")).toBeNull();
	});

	it.each([" href", "href ", "{http://www.w3.org/1999/xlink}href", "href\0"])(
		"does not apply animate from or to when attributeName is %j",
		(attributeName) => {
			const { host } = mount(
				jsx("svg", {
					children: jsx("animate", {
						attributeName,
						from: "javascript:alert(1)",
						to: "https://example.com/next",
					}),
				}),
			);
			const animate = host.querySelector("animate");

			expect(animate?.getAttribute("from")).toBeNull();
			expect(animate?.getAttribute("to")).toBeNull();
		},
	);

	it("does not apply an object attributeName before an executable set to", () => {
		let calls = 0;
		const attributeName = {
			[Symbol.toPrimitive]() {
				calls += 1;
				return calls === 1 ? "width" : "href";
			},
		};
		const { host } = mount(
			jsx("svg", {
				children: jsx("set", {
					attributeName,
					to: "javascript:alert(1)",
				}),
			}),
		);
		const setNode = host.querySelector("set");

		expect(calls).toBe(0);
		expect(setNode?.getAttribute("attributeName")).toBeNull();
		expect(setNode?.getAttribute("attribute-name")).toBeNull();
		expect(setNode?.getAttribute("to")).toBeNull();
	});

	it("does not apply an object attributeName after an executable set to", () => {
		let calls = 0;
		const attributeName = {
			[Symbol.toPrimitive]() {
				calls += 1;
				return calls === 1 ? "width" : "href";
			},
		};
		const { host } = mount(
			jsx("svg", {
				children: jsx("set", {
					to: "javascript:alert(1)",
					attributeName,
				}),
			}),
		);
		const setNode = host.querySelector("set");

		expect(calls).toBe(0);
		expect(setNode?.getAttribute("attributeName")).toBeNull();
		expect(setNode?.getAttribute("attribute-name")).toBeNull();
		expect(setNode?.getAttribute("to")).toBeNull();
	});

	it("drops animate to when attributeName is not a primitive", () => {
		let calls = 0;
		const attributeName = {
			[Symbol.toPrimitive]() {
				calls += 1;
				return "href";
			},
		};
		const { host } = mount(
			jsx("animate", {
				attributeName,
				to: "javascript:alert(1)",
			}),
		);
		const animate = host.querySelector("animate");

		expect(calls).toBe(0);
		expect(animate?.getAttribute("attributeName")).toBeNull();
		expect(animate?.getAttribute("to")).toBeNull();

		const symbolHost = mount(
			jsx("animate", {
				attributeName: Symbol("href"),
				to: "javascript:alert(1)",
				from: "javascript:alert(2)",
				by: "javascript:alert(3)",
				values: "javascript:alert(4)",
			}),
		).host;
		const symbolAnimate = symbolHost.querySelector("animate");
		expect(symbolAnimate?.getAttribute("to")).toBeNull();
		expect(symbolAnimate?.getAttribute("from")).toBeNull();
		expect(symbolAnimate?.getAttribute("by")).toBeNull();
		expect(symbolAnimate?.getAttribute("values")).toBeNull();
	});

	it("still applies data-equiv on meta", () => {
		const { host } = mount(
			jsx("meta", { "data-equiv": "refresh", content: "0" }),
		);
		const meta = host.querySelector("meta");

		expect(meta?.getAttribute("data-equiv")).toBe("refresh");
		expect(meta?.getAttribute("content")).toBe("0");
	});

	it("still applies a content-type http-equiv", () => {
		for (const httpEquiv of ["content-type", "Content-Type", "default-style"]) {
			const { host } = mount(jsx("meta", { httpEquiv, content: "text/html" }));
			const meta = host.querySelector("meta");

			expect(meta?.getAttribute("http-equiv")).toBe(httpEquiv);
			expect(meta?.getAttribute("content")).toBe("text/html");
		}
	});

	it("treats a spaced or NUL meta key as http-equiv", () => {
		const keys = [
			"http-equiv ",
			"http-equiv\0",
			" http-equiv",
			"{http://www.w3.org/1999/xhtml}http-equiv",
		];
		for (const key of keys) {
			const { host } = mount(
				jsx("meta", {
					[key]: "refresh",
					content: "0;url=https://example.com/next",
				}),
			);
			const meta = host.querySelector("meta");

			expect(meta?.getAttribute("http-equiv")).toBeNull();
			expect(meta?.httpEquiv ?? "").not.toMatch(/refresh/i);
		}
	});

	it("applies content-type when the meta key has a trailing space", () => {
		const { host } = mount(
			jsx("meta", {
				"http-equiv ": "content-type",
				content: "text/html",
			}),
		);
		const meta = host.querySelector("meta");

		expect(meta?.getAttribute("http-equiv")).toBe("content-type");
		expect(meta?.getAttribute("content")).toBe("text/html");
	});

	it("does not apply a meta http-equiv refresh", () => {
		const { host } = mount(
			jsx("div", {
				children: [
					jsx("meta", {
						httpEquiv: "refresh",
						content: "0;url=https://example.com/next",
					}),
					jsx("meta", { name: "viewport", content: "width=device-width" }),
				],
			}),
		);
		const metas = host.querySelectorAll("meta");

		expect(metas[0]?.getAttribute("http-equiv")).toBeNull();
		expect(metas[0]?.httpEquiv ?? "").not.toMatch(/refresh/i);
		expect(metas[1]?.getAttribute("content")).toBe("width=device-width");
	});

	it("does not apply a non-string meta http-equiv refresh", () => {
		const { host } = mount(
			jsx("meta", {
				httpEquiv: ["refresh"],
				content: "0;url=https://example.com/next",
			}),
		);
		const meta = host.querySelector("meta");

		expect(meta?.getAttribute("http-equiv")).toBeNull();
		expect(String(meta?.httpEquiv ?? "")).not.toMatch(/refresh/i);
	});

	it("does not apply a boxed-string meta http-equiv refresh", () => {
		const { host } = mount(
			jsx("meta", {
				httpEquiv: new String("refresh"),
				content: "0;url=https://example.com/next",
			}),
		);
		const meta = host.querySelector("meta");

		expect(meta?.getAttribute("http-equiv")).toBeNull();
		expect(String(meta?.httpEquiv ?? "")).not.toMatch(/refresh/i);
	});

	it("does not apply a toString meta http-equiv refresh", () => {
		let calls = 0;
		const { host } = mount(
			jsx("meta", {
				httpEquiv: {
					toString() {
						calls += 1;
						return "refresh";
					},
					valueOf() {
						calls += 1;
						return "refresh";
					},
					[Symbol.toPrimitive]() {
						calls += 1;
						return "refresh";
					},
				},
				content: "0;url=https://example.com/next",
			}),
		);

		expect(calls).toBe(0);
		expect(host.querySelector("meta")?.getAttribute("http-equiv")).toBeNull();
	});

	it("does not apply an HTTP-EQUIV array refresh", () => {
		const { host } = mount(
			jsx("meta", {
				"HTTP-EQUIV": ["Refresh"],
				content: "0;url=https://example.com/next",
			}),
		);

		expect(host.querySelector("meta")?.getAttribute("http-equiv")).toBeNull();
	});

	it("does not apply a padded meta http-equiv refresh", () => {
		const { host } = mount(
			jsx("meta", {
				httpEquiv: " refresh ",
				content: "0;url=https://example.com/next",
			}),
		);

		expect(host.querySelector("meta")?.getAttribute("http-equiv")).toBeNull();
	});

	it("does not apply a NUL-terminated meta http-equiv refresh", () => {
		const { host } = mount(
			jsx("meta", {
				httpEquiv: "refresh\0",
				content: "0;url=https://example.com/next",
			}),
		);

		expect(host.querySelector("meta")?.getAttribute("http-equiv")).toBeNull();
	});

	it("does not apply a non-string meta http-equiv that is not refresh", () => {
		const { host } = mount(
			jsx("meta", { httpEquiv: ["content-type"], content: "text/html" }),
		);
		const meta = host.querySelector("meta");

		expect(meta?.getAttribute("http-equiv")).toBeNull();
		expect(meta?.getAttribute("content")).toBe("text/html");
	});

	it("does not apply base href", () => {
		const { host } = mount(jsx("base", { href: "https://evil.example/base/" }));

		expect(host.querySelector("base")?.getAttribute("href")).toBeNull();
	});

	it("warns once when a URL scheme is rejected", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { host, tree } = mount(
			jsx("a", { href: "javascript:alert(1)", children: "go" }),
		);

		expect(warn).toHaveBeenCalledWith(
			"[ignite-jsx] `href` was not applied because its URL scheme is not allowed.",
		);
		warn.mockClear();
		renderIgniteJsx(
			host,
			jsx("a", { href: "javascript:alert(1)", children: "go" }),
			tree,
		);
		expect(warn).not.toHaveBeenCalled();
	});
});

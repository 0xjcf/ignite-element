import { afterEach, describe, expect, it, vi } from "vitest";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import { mountIgniteJsx, renderIgniteJsx } from "../../renderers/jsx/renderer";

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

describe("blocked markup sinks", () => {
	it.each(["innerHTML", "INNERHTML", "outerHTML", "srcdoc", "SRCDOC"])(
		"does not apply %s",
		(key) => {
			const { host } = mount(
				jsx("section", {
					id: "stay",
					[key]: "<p>injected</p><img src=x onerror=alert(1)>",
					children: "visible",
				}),
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
			jsx("div", {
				innerHTML: "<p>no</p>",
				children: "kept",
			}),
		);

		renderIgniteJsx(host, jsx("div", { children: "kept" }), tree);

		expect(host.textContent).toBe("kept");
		expect(host.querySelector("p")).toBeNull();
	});

	it("still applies textContent and warns that it is deprecated", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { host } = mount(jsx("div", { textContent: "plain" }));

		expect(host.querySelector("div")?.textContent).toBe("plain");
		expect(warn).toHaveBeenCalledWith(
			"[ignite-jsx] `textContent` is deprecated and will be removed in the next major release. Use JSX children for text, and hosts for trusted rich content.",
		);
	});

	it("warns once in development for each blocked markup prop", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { host, tree } = mount(
			jsx("div", {
				innerHTML: "<p>no</p>",
				outerHTML: "<p>no</p>",
				srcdoc: "<p>no</p>",
			}),
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
			jsx("div", {
				innerHTML: "<p>no</p>",
				outerHTML: "<p>no</p>",
				srcdoc: "<p>no</p>",
			}),
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
			jsx("section", { id: "stay", outerHTML: "<p>injected</p>" }),
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

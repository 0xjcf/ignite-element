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

	it("still applies textContent", () => {
		const { host } = mount(jsx("div", { textContent: "plain" }));

		expect(host.querySelector("div")?.textContent).toBe("plain");
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
			"[ignite-jsx] `innerHTML` is deprecated and will be removed in the next major release. Use JSX children for text, and hosts for trusted rich content.",
		);
		expect(warn).toHaveBeenCalledWith(
			"[ignite-jsx] `outerHTML` is deprecated and will be removed in the next major release. Use JSX children for text, and hosts for trusted rich content.",
		);
		expect(warn).toHaveBeenCalledWith(
			"[ignite-jsx] `srcdoc` is deprecated and will be removed in the next major release. Use JSX children for text, and hosts for trusted rich content.",
		);

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
	});

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

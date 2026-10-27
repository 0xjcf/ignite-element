import { afterEach, describe, expect, it } from "vitest";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import { mountIgniteJsx, renderIgniteJsx } from "../../renderers/jsx/renderer";

const STYLE_VALUE_WARNING =
	"[ignite-jsx] a style value dropped url(). Put a color, length, or keyword in a CSS variable, and keep url() in the static style sheet.";
const STYLE_SCHEME_WARNING =
	"[ignite-jsx] `style` was not applied because its URL scheme is not allowed.";
const HREF_SCHEME_WARNING =
	"[ignite-jsx] `href` was not applied because its URL scheme is not allowed.";
const BACKGROUND_SCHEME_WARNING =
	"[ignite-jsx] `background` was not applied because its URL scheme is not allowed.";
const WIDTH_SCHEME_WARNING =
	"[ignite-jsx] `width` was not applied because its URL scheme is not allowed.";

const MARKUP_PROPS = [
	"innerhtml",
	"outerhtml",
	"innertext",
	"outertext",
	"textcontent",
	"srcdoc",
	"length",
	"options",
	"selectedoptions",
] as const;

afterEach(() => {
	document.body.replaceChildren();
});

function mount(tag: string, props: Record<string, unknown>) {
	const host = document.createElement("div");
	document.body.append(host);
	const tree = mountIgniteJsx(host, jsx(tag, props));
	return { host, tree };
}

function withWarnings(run: () => void): string[] {
	const warnings: string[] = [];
	const previous = console.warn;
	console.warn = (...args: unknown[]) => {
		warnings.push(args.map((part) => String(part)).join(" "));
	};
	try {
		run();
	} finally {
		console.warn = previous;
	}
	return warnings;
}

describe("renderer mutation kills", () => {
	it("keeps a safe style child when a style element is rewritten", () => {
		const { host } = mount("style", {
			children: ".a{color:rebeccapurple}",
		});
		expect(host.querySelector("style")?.textContent).toContain("rebeccapurple");
	});

	it("warns when a script or a stylesheet link is not created", () => {
		const scriptWarnings = withWarnings(() => {
			const { host } = mount("script", {
				src: "https://evil.example/a.js",
			});
			expect(host.querySelector("script")).toBeNull();
		});
		expect(scriptWarnings).toContain("[ignite-jsx] `script` was not created.");

		const linkWarnings = withWarnings(() => {
			const { host } = mount("link", {
				rel: "stylesheet",
				href: "https://evil.example/a.css",
			});
			expect(host.querySelector("link")).toBeNull();
		});
		expect(linkWarnings).toContain("[ignite-jsx] `link` was not created.");
	});

	it("does not apply markup sink props", () => {
		for (const key of MARKUP_PROPS) {
			const { host } = mount("div", {
				[key]: "<img src=x>",
				children: "stay",
			});
			const el = host.querySelector("div");
			expect(el, key).not.toBeNull();
			expect(el?.getAttribute(key), key).toBeNull();
			expect(el?.querySelector("img"), key).toBeNull();
			expect(el?.textContent, key).toBe("stay");
		}
		const { host } = mount("iframe", { srcdoc: "<img src=x>" });
		expect(host.querySelector("iframe")?.getAttribute("srcdoc")).toBeNull();
		expect(
			(host.querySelector("iframe") as HTMLIFrameElement | null)?.srcdoc ?? "",
		).toBe("");
	});

	it("treats null and false hrefs as drops and a boolean true as a blocked url", () => {
		const dropped = withWarnings(() => {
			for (const href of [null, false]) {
				const { host } = mount("a", { href, children: "x" });
				expect(host.querySelector("a")?.hasAttribute("href")).toBe(false);
			}
		});
		expect(dropped.join("\n")).not.toContain("URL scheme is not allowed");

		const blocked = withWarnings(() => {
			const { host } = mount("a", { href: true, children: "x" });
			expect(host.querySelector("a")?.hasAttribute("href")).toBe(false);
		});
		expect(blocked).toContain(HREF_SCHEME_WARNING);
	});

	it("drops an old id and leaves rel alone when relList leaves the props", () => {
		const host = document.createElement("div");
		document.body.append(host);
		const first = renderIgniteJsx(
			host,
			jsx("a", {
				id: "gone",
				rel: "nofollow",
				relList: "noopener",
				href: "https://example.com/a",
			}),
		);
		expect(host.querySelector("a")?.getAttribute("id")).toBe("gone");
		expect(host.querySelector("a")?.getAttribute("rel")).toBe("nofollow");
		renderIgniteJsx(
			host,
			jsx("a", { rel: "nofollow", href: "https://example.com/a" }),
			first,
		);
		expect(host.querySelector("a")?.getAttribute("id")).toBeNull();
		expect(host.querySelector("a")?.getAttribute("rel")).toBe("nofollow");
		expect(host.querySelector("a")?.getAttribute("href")).toContain(
			"example.com/a",
		);
	});

	it("does not call setProperty again when a style declaration is unchanged", () => {
		const host = document.createElement("div");
		document.body.append(host);
		const first = renderIgniteJsx(
			host,
			jsx("div", { style: { color: "red" } }),
		);
		let sets = 0;
		const original = CSSStyleDeclaration.prototype.setProperty;
		CSSStyleDeclaration.prototype.setProperty = function (
			this: CSSStyleDeclaration,
			property: string,
			value: string,
			priority?: string,
		) {
			sets += 1;
			return original.call(this, property, value, priority);
		};
		try {
			renderIgniteJsx(host, jsx("div", { style: { color: "red" } }), first);
			expect(sets).toBe(0);
		} finally {
			CSSStyleDeclaration.prototype.setProperty = original;
		}
	});

	it("uses the remote sentence for url() and the scheme sentence otherwise", () => {
		const remote = withWarnings(() => {
			const { host } = mount("div", {
				style: { backgroundImage: "url(https://evil.example/a.png)" },
			});
			expect(
				(host.querySelector("div") as HTMLElement).style.backgroundImage,
			).toBe("");
		});
		expect(remote).toContain(STYLE_VALUE_WARNING);

		const scheme = withWarnings(() => {
			const { host } = mount("div", {
				style: {
					background: "expression(alert(1))",
					width: " (//evil)",
				},
			});
			const el = host.querySelector("div") as HTMLElement;
			expect(el.style.background).toBe("");
			expect(el.style.width).toBe("");
		});
		expect(scheme).toContain(BACKGROUND_SCHEME_WARNING);
		expect(scheme).toContain(WIDTH_SCHEME_WARNING);
		expect(scheme.join("\n")).not.toContain("dropped url()");

		const safe = withWarnings(() => {
			const mounted = mount("div", { style: "color:red" });
			expect(
				(mounted.host.querySelector("div") as HTMLElement).style.color,
			).toBe("red");
		});
		expect(safe).toEqual([]);

		const loaded = withWarnings(() => {
			const mounted = mount("div", {
				style: "color:red;background:url(https://evil.example/a.png)",
			});
			expect(
				(mounted.host.querySelector("div") as HTMLElement).style.cssText,
			).not.toContain("evil.example");
		});
		expect(loaded).toContain(STYLE_VALUE_WARNING);

		const scriptable = withWarnings(() => {
			const mounted = mount("div", { style: "expression(alert(1))" });
			expect(
				(mounted.host.querySelector("div") as HTMLElement).style.cssText,
			).not.toContain("expression");
		});
		expect(scriptable).toContain(STYLE_SCHEME_WARNING);
		expect(scriptable.join("\n")).not.toContain("dropped url()");
	});
});

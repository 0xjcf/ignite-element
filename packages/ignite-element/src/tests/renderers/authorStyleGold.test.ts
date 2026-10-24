import * as rendererJsx from "@ignite-element/renderer/jsx";
import * as rendererJsxIndex from "@ignite-element/renderer/jsx/index";
import * as elementJsx from "ignite-element/jsx";
import * as elementAuthor from "ignite-element/jsx/author-style";
import { describe, expect, it } from "vitest";
import { igniteAuthorStyle } from "../../../../ignite-renderer/src/renderers/jsx/authorStyle";
import {
	cssTextWithoutUrls,
	cssValueForStyle,
	styleSheetFromChildren,
} from "../../../../ignite-renderer/src/renderers/jsx/xssGuard";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import { mountIgniteJsx } from "../../renderers/jsx/renderer";

const STYLE_ELEMENT_WARNING =
	"[ignite-jsx] a style element dropped url() or @import. If that CSS is a static string in this file, is the ignite plugin on?";
const STYLE_VALUE_WARNING =
	"[ignite-jsx] a style value dropped url(). Put a color, length, or keyword in a CSS variable, and keep url() in the static style sheet.";

const BANNED = ["trustedStyle", "safeUrl", "safeSpread", "igniteAuthorStyle"];

function mount(tag: string, props: Record<string, unknown>) {
	const host = document.createElement("div");
	document.body.append(host);
	mountIgniteJsx(host, jsx(tag, props));
	return host;
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

describe("option C gold rules", () => {
	it("app entries export none of trustedStyle, safeUrl, safeSpread, or igniteAuthorStyle", () => {
		for (const entry of [elementJsx, rendererJsx, rendererJsxIndex]) {
			for (const name of BANNED) {
				expect(Object.keys(entry)).not.toContain(name);
			}
		}
		expect(Object.keys(elementAuthor)).toEqual(["igniteAuthorStyle"]);
		expect(typeof elementAuthor.igniteAuthorStyle).toBe("function");
	});

	it("string handlers die and a function inside a spread still runs", () => {
		let clicks = 0;
		const spread = {
			onclick: "alert(1)",
			onClick: () => {
				clicks += 1;
			},
		};
		const host = mount("div", { ...spread, id: "spread" });
		const el = host.querySelector("div");
		expect(el?.getAttribute("onclick")).toBeNull();
		el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(clicks).toBe(1);

		const direct = mount("button", {
			onClick: () => {
				clicks += 1;
			},
		});
		direct
			.querySelector("button")
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(clicks).toBe(2);
	});

	it("text is not applied on a div or a script", () => {
		const div = mount("div", { text: "x" }).querySelector("div");
		expect(div?.getAttribute("text")).toBeNull();
		expect(div?.textContent ?? "").not.toContain("x");
		const script = mount("script", { text: "x" }).querySelector("script");
		expect(script?.text ?? "").not.toContain("x");
		expect(script?.textContent ?? "").not.toContain("x");
	});

	it("relList is not applied on a div and a stylesheet link is still omitted", () => {
		const div = mount("div", { relList: "stylesheet" }).querySelector("div");
		expect(div?.getAttribute("rellist")).toBeNull();
		expect(div?.getAttribute("relList")).toBeNull();
		expect(
			mount("link", {
				rel: "stylesheet",
				href: "https://evil.example/a.css",
			}).querySelector("link"),
		).toBeNull();
	});

	it("untrusted style drops loaders and scriptable tokens", () => {
		const dropped = [
			"url(https://evil.example/a.png)",
			"@import 'https://evil.example/a.css'",
			"image-set(url(https://evil.example/a) 1x)",
			"expression(alert(1))",
			"behavior:url(#x)",
			"-moz-binding:url(#x)",
			"u\\72l(https://evil.example/a)",
		];
		for (const value of dropped) {
			expect(cssValueForStyle(value, "background"), value).toBe(false);
			const host = mount("div", {
				style: { color: "red", background: value },
			});
			const el = host.querySelector("div") as HTMLElement;
			expect(el.style.color, value).toBe("red");
			expect(el.style.cssText, value).not.toContain("evil.example");
		}
		const range = "@media (width < 600px){.a{color:red}}";
		expect(styleSheetFromChildren([{ kind: "text", value: range }]).css).toBe(
			range,
		);
		expect(cssValueForStyle(" (//evil)", "width")).toBe(false);
		expect(cssTextWithoutUrls({ width: " (//evil)", color: "red" })).toEqual({
			color: "red",
		});
		expect(cssValueForStyle("red", "color")).toBe("red");
	});

	it("unmarked style drops url and import and warns that the plugin may be off", () => {
		const url = "https://evil.example/sheet.png";
		const warnings = withWarnings(() => {
			const host = mount("style", {
				children: `.a{background:url(${url})} @import 'https://evil.example/a.css';`,
			});
			const text = host.querySelector("style")?.textContent ?? "";
			expect(text.toLowerCase()).not.toContain("url(");
			expect(text.toLowerCase()).not.toContain("@import");
			expect(text).not.toContain(url);
		});
		expect(warnings).toContain(STYLE_ELEMENT_WARNING);
		expect(warnings.join("\n")).not.toContain("evil.example");
	});

	it("interpolated url is dropped and dev warns to use a css variable", () => {
		const image = "https://evil.example/photo.png";
		const warnings = withWarnings(() => {
			const el = mount("div", {
				style: { backgroundImage: `url(${image})` },
			}).querySelector("div") as HTMLElement;
			expect(el.style.backgroundImage).toBe("");
			expect(el.style.cssText).not.toContain(image);
		});
		expect(warnings).toContain(STYLE_VALUE_WARNING);
		expect(warnings.join("\n")).not.toContain(image);
	});

	it("a custom property carries data not a load", () => {
		const warnings = withWarnings(() => {
			const el = mount("div", {
				style: {
					"--accent": "rebeccapurple",
					"--bg": "url(https://evil.example/bg.png)",
				},
			}).querySelector("div") as HTMLElement;
			expect(el.style.getPropertyValue("--accent")).toBe("rebeccapurple");
			expect(el.style.getPropertyValue("--bg")).toBe("");
		});
		expect(warnings).toContain(STYLE_VALUE_WARNING);
		expect(warnings.join("\n")).not.toContain("evil.example");

		const marked = igniteAuthorStyle(".a{background:url(var(--bg))}");
		const host = mount("style", { children: marked });
		expect(host.querySelector("style")?.textContent).toContain(
			"url(var(--bg))",
		);
	});

	it("a mark does not keep script or breakout", () => {
		const sheet = igniteAuthorStyle(
			".a{background:url(https://cdn.example/a.png);width:expression(1);behavior:url(#x);-moz-binding:url(#y)} .b{color:red}",
		);
		const css = styleSheetFromChildren([
			{ kind: "text", value: igniteAuthorStyle.read(sheet), author: true },
		]).css;
		expect(css).toContain("https://cdn.example/a.png");
		expect(css.toLowerCase()).not.toContain("expression");
		expect(css.toLowerCase()).not.toContain("behavior:url");
		expect(css.toLowerCase()).not.toContain("moz-binding");
		const broken = igniteAuthorStyle(
			".a{background:url(https://cdn.example/a.png)}</style>",
		);
		expect(
			styleSheetFromChildren([
				{ kind: "text", value: igniteAuthorStyle.read(broken), author: true },
			]).css,
		).toBe("");
		const comment = igniteAuthorStyle(".a{color:red}<!DOCTYPE html>");
		expect(
			styleSheetFromChildren([
				{
					kind: "text",
					value: igniteAuthorStyle.read(comment),
					author: true,
				},
			]).css,
		).toBe("");
	});

	it("a forged brand and a second copy fail closed", async () => {
		const forged = Object.freeze({
			[Symbol.for("ignite-element.authorStyle")]:
				"body{background:url(https://evil.example/forged.png)}",
		});
		expect(igniteAuthorStyle.read(forged)).toBeUndefined();
		expect(igniteAuthorStyle.read(null)).toBeUndefined();
		expect(igniteAuthorStyle.read(undefined)).toBeUndefined();
		expect(igniteAuthorStyle.read(0)).toBeUndefined();
		expect(igniteAuthorStyle.read("")).toBeUndefined();
		expect(igniteAuthorStyle.read(false)).toBeUndefined();
		expect(
			igniteAuthorStyle.read(
				"body{background:url(https://evil.example/x.png)}",
			),
		).toBeUndefined();
		const realForSymbol = igniteAuthorStyle(".a{color:red}");
		const ownSymbol = Object.getOwnPropertySymbols(realForSymbol)[0];
		expect(ownSymbol).toBeDefined();
		const stolen = {
			[ownSymbol]: "body{background:url(https://evil.example/stolen.png)}",
		};
		expect(igniteAuthorStyle.read(stolen)).toBeUndefined();
		const outsider = new Proxy(
			{},
			{
				get() {
					throw new TypeError("outsider");
				},
			},
		);
		expect(igniteAuthorStyle.read(outsider)).toBeUndefined();
		const forgedHost = mount("style", { children: forged });
		expect(forgedHost.querySelector("style")?.textContent ?? "").not.toContain(
			"evil.example",
		);

		const second = (await import(
			// @ts-expect-error a query loads a second copy of this module
			"../../../../ignite-renderer/src/renderers/jsx/authorStyle.ts?copy=second"
		)) as typeof import("../../../../ignite-renderer/src/renderers/jsx/authorStyle.ts");
		const other = second.igniteAuthorStyle(
			"body{background:url(https://cdn.example/other.png)}",
		);
		expect(igniteAuthorStyle.read(other)).toBeUndefined();
		const otherHost = mount("style", { children: other });
		expect(otherHost.querySelector("style")?.textContent ?? "").not.toContain(
			"cdn.example",
		);

		const real = igniteAuthorStyle(
			"body{background:url(https://cdn.example/real.png)}",
		);
		const lying = new Proxy(real, {
			get() {
				throw new TypeError("lying style");
			},
		});
		expect(() => mount("style", { children: lying })).not.toThrow();
		const lyingHost = mount("div", { style: lying });
		expect(
			lyingHost.querySelector("div")?.getAttribute("style") ?? "",
		).not.toContain("cdn.example");
	});
});

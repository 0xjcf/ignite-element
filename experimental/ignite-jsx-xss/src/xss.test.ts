import { afterEach, describe, expect, it } from "vitest";
import { jsx } from "../../../packages/ignite-element/src/renderers/jsx/jsx-runtime";
import { mountIgniteJsx } from "../../../packages/ignite-element/src/renderers/jsx/renderer";

afterEach(() => {
	document.body.replaceChildren();
});

function mount(tag: string, props: Record<string, unknown>) {
	const host = document.createElement("div");
	document.body.append(host);
	mountIgniteJsx(host, jsx(tag, props));
	return host;
}

describe("text expressions", () => {
	it("renders markup strings and nested arrays as text, and plain objects as comments", () => {
		const markup = "<img src=x onerror=alert(1)>";
		const host = document.createElement("div");
		document.body.append(host);
		mountIgniteJsx(
			host,
			jsx("div", {
				children: [markup, ["nested", [markup]], { toString: () => markup }],
			}),
		);
		const root = host.firstElementChild;
		expect(root?.querySelector("img")).toBeNull();
		expect(root?.textContent).toBe(`${markup}nested${markup}`);
		const nodes = root ? [...root.childNodes] : [];
		expect(nodes.map((node) => node.nodeType)).toEqual([3, 3, 3, 8]);
	});
});

describe("url attributes that are guarded", () => {
	const blocked = [
		"javascript:alert(1)",
		"JAVASCRIPT:alert(1)",
		" java\tscript:alert(1)",
		"java\nscript:alert(1)",
		"\u0000javascript:alert(1)",
		"vbscript:alert(1)",
		"VbScript:alert(1)",
		"data:text/html,<script>alert(1)</script>",
		"data:text/html;charset=utf-8,hi",
		"data:image/svg+xml,<svg></svg>",
	];

	it.each(blocked)("drops href %j", (value) => {
		const anchor = mount("a", { href: value, children: "x" }).querySelector(
			"a",
		) as HTMLAnchorElement;
		expect(anchor.getAttribute("href")).toBeNull();
		expect(anchor.href).not.toMatch(/^javascript:/i);
		expect(anchor.href).not.toMatch(/^vbscript:/i);
		expect(anchor.href).not.toMatch(/^data:text\/html/i);
	});

	it("drops javascript and data urls on src, action, formaction, object data, and xlink:href", () => {
		expect(
			mount("img", { src: "javascript:alert(1)" })
				.querySelector("img")
				?.getAttribute("src"),
		).toBeNull();
		expect(
			mount("form", { action: "javascript:alert(1)" })
				.querySelector("form")
				?.getAttribute("action"),
		).toBeNull();
		expect(
			mount("button", { formAction: " \tVbScript:alert(1)" })
				.querySelector("button")
				?.getAttribute("formaction"),
		).toBeNull();
		expect(
			mount("iframe", { src: "data:text/html,hi" })
				.querySelector("iframe")
				?.getAttribute("src"),
		).toBeNull();
		expect(
			mount("object", { data: "javascript:alert(1)" })
				.querySelector("object")
				?.getAttribute("data"),
		).toBeNull();
		const host = document.createElement("div");
		document.body.append(host);
		mountIgniteJsx(
			host,
			jsx("svg", {
				children: jsx("a", {
					"xlink:href": "javascript:alert(1)",
					children: "x",
				}),
			}),
		);
		expect(host.querySelector("a")?.getAttribute("xlink:href")).toBeNull();
	});

	it("does not treat an entity-encoded scheme as a script url", () => {
		const anchor = mount("a", {
			href: "&#106;avascript:alert(1)",
			children: "x",
		}).querySelector("a") as HTMLAnchorElement;
		expect(anchor.href.startsWith("javascript:")).toBe(false);
		expect(anchor.href.startsWith("vbscript:")).toBe(false);
	});
});

describe("handlers and srcdoc", () => {
	it.each(["onclick", "onClick", "ONERROR", "onfocus", "xlink:onclick"])(
		"does not apply string handler %s",
		(key) => {
			const el = mount("div", { [key]: "alert(1)", id: "stay" }).querySelector(
				"div",
			);
			expect(el?.id).toBe("stay");
			expect(el?.getAttribute(key)).toBeNull();
			expect(
				el
					?.getAttributeNames()
					.some((name) => name.toLowerCase().startsWith("on")),
			).toBe(false);
		},
	);

	it("does not apply srcdoc", () => {
		const frame = mount("iframe", {
			srcdoc: "<script>alert(1)</script>",
			title: "preview",
		}).querySelector("iframe");
		expect(frame?.getAttribute("title")).toBe("preview");
		expect(frame?.getAttribute("srcdoc")).toBeNull();
	});
});

describe("spread of filtered keys", () => {
	it("drops a javascript href, a string handler, and srcdoc from one object", () => {
		const untrusted = {
			href: "javascript:alert(1)",
			onclick: "alert(1)",
			srcdoc: "<p>x</p>",
			id: "stay",
			children: "ok",
		};
		const anchor = mount("a", untrusted).querySelector("a");
		expect(anchor?.id).toBe("stay");
		expect(anchor?.textContent).toBe("ok");
		expect(anchor?.getAttribute("href")).toBeNull();
		expect(anchor?.getAttribute("onclick")).toBeNull();
		expect(anchor?.getAttribute("srcdoc")).toBeNull();
	});
});

describe("style values the css parser drops", () => {
	it("does not keep url(javascript:) or expression() on a style string or object", () => {
		const fromString = mount("div", {
			style:
				'color: red; background-image: url(javascript:alert(1)); width: expression(alert(1)); height: url("javascript:alert(1)")',
		}).querySelector("div") as HTMLElement;
		expect(fromString.style.cssText.toLowerCase()).not.toContain("javascript:");
		expect(fromString.style.cssText.toLowerCase()).not.toContain("expression(");
		expect(fromString.getAttribute("style")?.toLowerCase() ?? "").not.toContain(
			"javascript:",
		);

		const fromObject = mount("div", {
			style: {
				backgroundImage: "url(javascript:alert(1))",
				width: "expression(alert(1))",
			},
		}).querySelector("div") as HTMLElement;
		expect(fromObject.style.backgroundImage).toBe("");
		expect(fromObject.style.width).toBe("");
	});
});

describe("gaps", () => {
	it("srcset does not keep a javascript or data:text/html url", () => {
		const javascript = mount("img", {
			srcset: "javascript:alert(1) 1x",
		}).querySelector("img");
		const data = mount("img", {
			srcset: "data:text/html,hi 1x",
		}).querySelector("img");
		expect(javascript?.getAttribute("srcset")).toBeNull();
		expect(data?.getAttribute("srcset")).toBeNull();
	});

	it("poster does not keep a javascript or data:text/html url", () => {
		const el = mount("video", {
			poster: "javascript:alert(1)",
		}).querySelector("video");
		expect(el?.getAttribute("poster")).toBeNull();
	});

	it("background does not keep a javascript url", () => {
		const el = mount("body", {
			background: "javascript:alert(1)",
		}).querySelector("body");
		expect(el?.getAttribute("background")).toBeNull();
	});

	it("cite does not keep a javascript url", () => {
		const el = mount("blockquote", {
			cite: "javascript:alert(1)",
		}).querySelector("blockquote");
		expect(el?.getAttribute("cite")).toBeNull();
	});

	it("ping does not keep a javascript url", () => {
		const el = mount("a", {
			href: "https://example.com",
			ping: "javascript:alert(1)",
			children: "x",
		}).querySelector("a");
		expect(el?.getAttribute("ping")).toBeNull();
	});

	it("a spread __proto__ key does not throw or replace the element prototype", () => {
		const payload = JSON.parse(
			'{"__proto__": {"polluted": true}, "href": "javascript:alert(1)"}',
		) as Record<string, unknown>;
		const host = document.createElement("div");
		document.body.append(host);
		expect(() => {
			mountIgniteJsx(host, jsx("a", { ...payload, children: "x" }));
		}).not.toThrow();
		const anchor = host.querySelector("a");
		expect(anchor).not.toBeNull();
		expect(Object.getPrototypeOf(anchor)).toBe(HTMLAnchorElement.prototype);
		expect(anchor?.getAttribute("href")).toBeNull();
		expect(
			(Object.prototype as { polluted?: boolean }).polluted,
		).toBeUndefined();
	});

	it("a direct onClick still runs; safeSpread is what refuses a spread handler", () => {
		let ran = false;
		const host = mount("button", {
			onClick: () => {
				ran = true;
			},
			children: "go",
		});
		host
			.querySelector("button")
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(ran).toBe(true);
	});

	it("an untrusted style string cannot set a remote url", () => {
		const el = mount("div", {
			style: "background-image: url(https://evil.example/leak)",
		}).querySelector("div") as HTMLElement;
		expect(el.style.backgroundImage).toBe("");
	});

	it("an untrusted style object cannot set a remote url", () => {
		const el = mount("div", {
			style: { backgroundImage: "url(https://evil.example/leak)" },
		}).querySelector("div") as HTMLElement;
		expect(el.style.backgroundImage).toBe("");
	});

	it("does not parse style text as html", () => {
		const host = document.createElement("div");
		document.body.append(host);
		mountIgniteJsx(
			host,
			jsx("div", {
				children: jsx("style", {
					children: "</style><img src=x onerror=alert(1)>",
				}),
			}),
		);
		expect(host.querySelector("img")).toBeNull();
		expect(host.querySelector("style")?.textContent).toContain("</style>");
	});

	it("a style element keeps component css and drops a url()", () => {
		const host = document.createElement("div");
		document.body.append(host);
		mountIgniteJsx(
			host,
			jsx("div", {
				children: jsx("style", {
					children:
						".leak{color:rgb(1, 2, 3);background:url(https://evil.example/x)}",
				}),
			}),
		);
		const text = host.querySelector("style")?.textContent ?? "";
		expect(host.querySelector("style")).not.toBeNull();
		expect(text).toContain("rgb(1, 2, 3)");
		expect(text.toLowerCase()).not.toContain("url(");
	});

	it("a script element is not created for a string child", () => {
		const host = document.createElement("div");
		document.body.append(host);
		mountIgniteJsx(
			host,
			jsx("div", {
				children: jsx("script", { children: "window.__igniteRan = 1" }),
			}),
		);
		expect(host.querySelector("script")).toBeNull();
	});
});

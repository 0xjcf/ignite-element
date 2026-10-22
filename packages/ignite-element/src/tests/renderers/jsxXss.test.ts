import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import { mountIgniteJsx } from "../../renderers/jsx/renderer";

afterEach(() => {
	document.body.replaceChildren();
	delete (Object.prototype as { polluted?: boolean }).polluted;
});

function mount(tag: string, props: Record<string, unknown>) {
	const host = document.createElement("div");
	document.body.append(host);
	mountIgniteJsx(host, jsx(tag, props));
	return host;
}

function ownKey(key: string, value: unknown): Record<string, unknown> {
	const props: Record<string, unknown> = { id: "stay", children: "x" };
	Object.defineProperty(props, key, {
		configurable: true,
		enumerable: true,
		value,
		writable: true,
	});
	return props;
}

const noise = fc.constantFrom("", " ", "\t", "\n", "\r", "\u0000", "\u007f");

function noisy(source: string) {
	return fc
		.array(noise, {
			minLength: source.length + 1,
			maxLength: source.length + 1,
		})
		.map((gaps) => {
			let out = "";
			for (let index = 0; index < source.length; index += 1) {
				out += (gaps[index] ?? "") + source[index];
			}
			return out + (gaps[source.length] ?? "");
		});
}

const dangerousUrl = fc
	.constantFrom("javascript", "vbscript", "data:text/html")
	.chain((scheme) =>
		noisy(scheme).map((value) =>
			scheme.startsWith("data:") ? `${value},hi` : `${value}:alert(1)`,
		),
	);

type SafeSpread = (
	props: object,
	options?: { handlers?: readonly string[] },
) => Record<string, unknown>;

type SafeUrl = (value: string) => string | null;

type TrustedStyle = (css: string) => unknown;

async function loadHelpers() {
	const imported = await import("@ignite-element/renderer/jsx");
	const helpers = imported as {
		safeSpread?: SafeSpread;
		safeUrl?: SafeUrl;
		trustedStyle?: TrustedStyle;
	};
	return helpers;
}

describe("locks that already hold", () => {
	it("still runs a direct onClick function", () => {
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

	it("still creates a script that has a network src and no text", () => {
		const host = mount("script", { src: "https://example.com/app.js" });
		expect(host.querySelector("script")?.getAttribute("src")).toContain(
			"https://example.com/app.js",
		);
	});

	it("keeps an https poster, cite, background, ping, and a png srcset", () => {
		expect(
			mount("video", { poster: "https://cdn.example/poster.png" })
				.querySelector("video")
				?.getAttribute("poster"),
		).toContain("https://cdn.example/poster.png");
		expect(
			mount("blockquote", { cite: "https://example.com/post" })
				.querySelector("blockquote")
				?.getAttribute("cite"),
		).toContain("https://example.com/post");
		expect(
			mount("body", { background: "https://cdn.example/bg.png" })
				.querySelector("body")
				?.getAttribute("background"),
		).toContain("https://cdn.example/bg.png");
		expect(
			mount("a", {
				href: "https://example.com",
				ping: "https://example.com/ping",
				children: "x",
			})
				.querySelector("a")
				?.getAttribute("ping"),
		).toContain("https://example.com/ping");
		expect(
			mount("img", { srcset: "data:image/png;base64,aaaa 1x, /b.png 2x" })
				.querySelector("img")
				?.getAttribute("srcset"),
		).toContain("data:image/png;base64,aaaa");
	});

	it("keeps an empty style element and drops url(javascript:) that CSSOM already rejects", () => {
		const empty = document.createElement("div");
		document.body.append(empty);
		mountIgniteJsx(empty, jsx("div", { children: jsx("style", {}) }));
		expect(empty.querySelector("style")).not.toBeNull();

		const styled = mount("div", {
			style:
				"color: red; background-image: url(javascript:alert(1)); width: expression(alert(1))",
		}).querySelector("div") as HTMLElement;
		expect(styled.style.color).toBe("red");
		expect(styled.style.cssText.toLowerCase()).not.toContain("javascript:");
		expect(styled.style.cssText.toLowerCase()).not.toContain("expression(");
	});
});

describe("URL scheme obfuscation", () => {
	it("drops obfuscated javascript, vbscript, and data:text/html on href", () => {
		fc.assert(
			fc.property(dangerousUrl, (value) => {
				const anchor = mount("a", { href: value, children: "x" }).querySelector(
					"a",
				);
				expect(anchor?.getAttribute("href")).toBeNull();
			}),
			{ numRuns: 24, seed: 1 },
		);
	});

	it("drops obfuscated schemes on poster, background, cite, and ping", () => {
		fc.assert(
			fc.property(
				dangerousUrl,
				fc.constantFrom(
					["video", "poster"],
					["body", "background"],
					["blockquote", "cite"],
					["q", "cite"],
					["del", "cite"],
					["ins", "cite"],
					["a", "ping"],
					["area", "ping"],
				),
				(value, [tag, key]) => {
					const props: Record<string, unknown> = { [key]: value };
					if (tag === "a" || tag === "area") props.href = "https://example.com";
					const el = mount(tag, props).querySelector(tag);
					expect(el?.getAttribute(key)).toBeNull();
				},
			),
			{ numRuns: 24, seed: 1 },
		);
	});

	it("drops a srcset when any candidate is an obfuscated dangerous URL", () => {
		fc.assert(
			fc.property(
				dangerousUrl,
				fc.array(fc.integer({ min: 1, max: 4 }), {
					minLength: 0,
					maxLength: 2,
				}),
				fc.constantFrom("img", "source"),
				(bad, extras, tag) => {
					const candidates = [
						...extras.map((item) => `https://cdn.example/${item}.png ${item}x`),
						`${bad} 9x`,
					];
					const el = mount(tag, {
						srcset: candidates.join(", "),
					}).querySelector(tag);
					expect(el?.getAttribute("srcset")).toBeNull();
				},
			),
			{ numRuns: 24, seed: 1 },
		);
	});
});

describe("gaps", () => {
	it("srcset does not keep a javascript or data:text/html url", () => {
		expect(
			mount("img", { srcset: "javascript:alert(1) 1x" })
				.querySelector("img")
				?.getAttribute("srcset"),
		).toBeNull();
		expect(
			mount("img", { srcset: "data:text/html,hi 1x" })
				.querySelector("img")
				?.getAttribute("srcset"),
		).toBeNull();
		expect(
			mount("img", {
				srcSet: "https://cdn.example/a.png 1x, javascript:alert(1) 2x",
			})
				.querySelector("img")
				?.getAttribute("srcset"),
		).toBeNull();
	});

	it("poster does not keep a javascript or data:text/html url", () => {
		const warnings: string[] = [];
		const previous = console.warn;
		console.warn = (...args: unknown[]) => {
			warnings.push(args.map((part) => String(part)).join(" "));
		};
		try {
			const el = mount("video", {
				poster: "javascript:alert(1)",
			}).querySelector("video");
			expect(el?.getAttribute("poster")).toBeNull();
			expect(
				mount("video", { poster: "data:text/html,hi" })
					.querySelector("video")
					?.getAttribute("poster"),
			).toBeNull();
			expect(warnings.join("\n")).not.toContain("javascript:alert(1)");
		} finally {
			console.warn = previous;
		}
	});

	it("background does not keep a javascript url", () => {
		expect(
			mount("body", { background: "javascript:alert(1)" })
				.querySelector("body")
				?.getAttribute("background"),
		).toBeNull();
	});

	it("cite does not keep a javascript url", () => {
		expect(
			mount("blockquote", { cite: "javascript:alert(1)" })
				.querySelector("blockquote")
				?.getAttribute("cite"),
		).toBeNull();
	});

	it("ping does not keep a javascript url", () => {
		expect(
			mount("a", {
				href: "https://example.com",
				ping: "javascript:alert(1)",
				children: "x",
			})
				.querySelector("a")
				?.getAttribute("ping"),
		).toBeNull();
		expect(
			mount("a", {
				href: "https://example.com",
				ping: "https://ok.example/a javascript:alert(1)",
				children: "x",
			})
				.querySelector("a")
				?.getAttribute("ping"),
		).toBeNull();
	});

	it.each(["__proto__", "constructor", "prototype"])(
		"a spread %s key does not throw or replace the element prototype",
		(key) => {
			const props = ownKey(key, {
				polluted: true,
				prototype: { polluted: true },
			});
			props.href = "javascript:alert(1)";
			const host = document.createElement("div");
			document.body.append(host);
			expect(() => {
				mountIgniteJsx(host, jsx("a", props));
			}).not.toThrow();
			const anchor = host.querySelector("a");
			expect(anchor).not.toBeNull();
			expect(Object.getPrototypeOf(anchor)).toBe(HTMLAnchorElement.prototype);
			expect(anchor?.id).toBe("stay");
			expect(anchor?.getAttribute("href")).toBeNull();
			expect(anchor?.getAttribute(key)).toBeNull();
			expect(Object.hasOwn(anchor, key)).toBe(false);
			expect(
				(Object.prototype as { polluted?: boolean }).polluted,
			).toBeUndefined();
		},
	);

	it("forbidden keys stay dropped across fast-check values", () => {
		fc.assert(
			fc.property(
				fc.constantFrom("__proto__", "constructor", "prototype"),
				fc.string(),
				(key, title) => {
					const props = ownKey(key, { polluted: true });
					props.title = title;
					const host = document.createElement("div");
					document.body.append(host);
					expect(() => {
						mountIgniteJsx(host, jsx("div", props));
					}).not.toThrow();
					const el = host.querySelector("div");
					expect(Object.getPrototypeOf(el)).toBe(HTMLDivElement.prototype);
					expect(el?.id).toBe("stay");
					expect(el?.getAttribute("title")).toBe(title);
					expect(
						(Object.prototype as { polluted?: boolean }).polluted,
					).toBeUndefined();
				},
			),
			{ numRuns: 20, seed: 1 },
		);
	});

	it("safeSpread refuses spread on* functions unless explicitly allowed", async () => {
		const { safeSpread } = await loadHelpers();
		expect(typeof safeSpread).toBe("function");
		if (typeof safeSpread !== "function") return;

		let ran = false;
		const blocked = mount(
			"button",
			safeSpread({
				onClick: () => {
					ran = true;
				},
				id: "stay",
				children: "go",
			}),
		);
		blocked
			.querySelector("button")
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(ran).toBe(false);
		expect(blocked.querySelector("button")?.id).toBe("stay");

		let allowed = false;
		const kept = mount(
			"button",
			safeSpread(
				{
					onClick: () => {
						allowed = true;
					},
					children: "go",
				},
				{ handlers: ["onClick"] },
			),
		);
		kept
			.querySelector("button")
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(allowed).toBe(true);

		const namedString = mount(
			"div",
			safeSpread({ onclick: "alert(1)", id: "x" }, { handlers: ["onclick"] }),
		);
		expect(
			namedString.querySelector("div")?.getAttribute("onclick"),
		).toBeNull();
		expect(namedString.querySelector("div")?.id).toBe("x");

		const proto = safeSpread(ownKey("__proto__", { polluted: true }));
		expect(Object.keys(proto)).not.toContain("__proto__");
		expect(Object.keys(safeSpread(ownKey("constructor", {})))).not.toContain(
			"constructor",
		);
		expect(Object.keys(safeSpread(ownKey("prototype", {})))).not.toContain(
			"prototype",
		);
	});

	it("an untrusted style string cannot set a remote url", () => {
		const el = mount("div", {
			style: "color: red; background-image: url(https://evil.example/leak)",
		}).querySelector("div") as HTMLElement;
		expect(el.style.color).toBe("red");
		expect(el.style.backgroundImage).toBe("");
	});

	it("an untrusted style object cannot set a remote url", () => {
		const el = mount("div", {
			style: {
				color: "red",
				backgroundImage: "url(https://evil.example/leak)",
			},
		}).querySelector("div") as HTMLElement;
		expect(el.style.color).toBe("red");
		expect(el.style.backgroundImage).toBe("");
	});

	it("a style element does not keep untrusted css text", () => {
		const host = document.createElement("div");
		document.body.append(host);
		mountIgniteJsx(
			host,
			jsx("div", {
				children: jsx("style", {
					children:
						".leak{color:rgb(1, 2, 3)}</style><img src=x onerror=alert(1)>",
				}),
			}),
		);
		expect(host.querySelector("style")).toBeNull();
		expect(host.querySelector("img")).toBeNull();
	});

	it("a script element is not created for a string or number child", () => {
		const host = document.createElement("div");
		document.body.append(host);
		mountIgniteJsx(
			host,
			jsx("div", {
				children: [
					jsx("script", { children: "window.__igniteRan = 1" }),
					jsx("script", { children: 1 }),
					jsx("SCRIPT", { children: "alert(1)" }),
					jsx("script", {
						src: "https://example.com/app.js",
						children: "alert(1)",
					}),
				],
			}),
		);
		expect(host.querySelector("script")).toBeNull();
	});
});

describe("deny-by-default helpers", () => {
	it("safeUrl allows only http, https, mailto, tel, and relative urls", async () => {
		const { safeUrl } = await loadHelpers();
		expect(typeof safeUrl).toBe("function");
		if (typeof safeUrl !== "function") return;

		expect(safeUrl("https://example.com/a")).toBe("https://example.com/a");
		expect(safeUrl("http://example.com")).toBe("http://example.com");
		expect(safeUrl("mailto:a@example.com")).toBe("mailto:a@example.com");
		expect(safeUrl("tel:+15551212")).toBe("tel:+15551212");
		expect(safeUrl("/relative")).toBe("/relative");
		expect(safeUrl("./a")).toBe("./a");
		expect(safeUrl("../a")).toBe("../a");
		expect(safeUrl("?q=1")).toBe("?q=1");
		expect(safeUrl("#hash")).toBe("#hash");
		expect(safeUrl("//cdn.example/a")).toBe("//cdn.example/a");
		expect(safeUrl("javascript:alert(1)")).toBeNull();
		expect(safeUrl("java\nscript:alert(1)")).toBeNull();
		expect(safeUrl(" \tVbScript:alert(1)")).toBeNull();
		expect(safeUrl("data:text/html,hi")).toBeNull();
		expect(safeUrl("blob:https://example.com/id")).toBeNull();
		expect(safeUrl("ftp://example.com")).toBeNull();
		expect(safeUrl("")).toBeNull();

		fc.assert(
			fc.property(dangerousUrl, (value) => {
				expect(safeUrl(value)).toBeNull();
			}),
			{ numRuns: 24, seed: 1 },
		);
		fc.assert(
			fc.property(
				fc.constantFrom("http", "https", "mailto", "tel"),
				fc.constantFrom("", " ", "\t", "\n", "\u0000"),
				(scheme, gap) => {
					const value = `${gap}${scheme}${gap}:ok`;
					expect(safeUrl(value)).toBe(value);
				},
			),
			{ numRuns: 16, seed: 1 },
		);
	});

	it("trustedStyle is the only way to keep url() in style", async () => {
		const { trustedStyle } = await loadHelpers();
		expect(typeof trustedStyle).toBe("function");
		if (typeof trustedStyle !== "function") return;

		const css = "background-image: url(https://cdn.example/a.png)";
		const fromString = mount("div", { style: trustedStyle(css) }).querySelector(
			"div",
		) as HTMLElement;
		expect(fromString.style.backgroundImage).toContain(
			"https://cdn.example/a.png",
		);

		const fromObject = mount("div", {
			style: { backgroundImage: trustedStyle(css), color: "red" },
		}).querySelector("div") as HTMLElement;
		expect(fromObject.style.backgroundImage).toContain(
			"https://cdn.example/a.png",
		);
		expect(fromObject.style.color).toBe("red");

		const host = document.createElement("div");
		document.body.append(host);
		mountIgniteJsx(
			host,
			jsx("div", {
				children: jsx("style", { children: trustedStyle(".a{color:red}") }),
			}),
		);
		expect(host.querySelector("style")?.textContent).toContain(".a{color:red}");
		expect(host.querySelector("img")).toBeNull();

		expect(() => trustedStyle(1 as unknown as string)).toThrow(TypeError);
	});
});

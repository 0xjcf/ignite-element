import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import {
	cssTextWithoutUrls,
	cssValueForStyle,
	decorativeUrlBlocked,
	isHandlerKey,
	linkReflectsBlocked,
	readTrustedStyle,
	safeSpread,
	srcsetCandidates,
	styleSheetFromChildren,
	trustedStyle,
	urlValueBlocked,
} from "../../../../ignite-renderer/src/renderers/jsx/xssGuard";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import { mountIgniteJsx, renderIgniteJsx } from "../../renderers/jsx/renderer";

afterEach(() => {
	document.body.replaceChildren();
	delete (Object.prototype as { polluted?: boolean }).polluted;
});

const styleSeen: unknown[] = [];
const styleCaseSeen: unknown[] = [];
const titleSeen: unknown[] = [];

class StyleSinkElement extends HTMLElement {}

if (!customElements.get("x-style-sink")) {
	// Installed on the prototype so the class stays a valid HTMLElement.
	// The setters record the raw argument, including a string or style object.
	Object.defineProperty(StyleSinkElement.prototype, "style", {
		configurable: true,
		set(value: unknown) {
			styleSeen.push(value);
			const decl = Object.getOwnPropertyDescriptor(
				HTMLElement.prototype,
				"style",
			)?.get?.call(this) as CSSStyleDeclaration | undefined;
			if (!decl) return;
			if (typeof value === "string") {
				decl.cssText = value;
				return;
			}
			decl.cssText = "";
			if (!value || typeof value !== "object") return;
			// A custom setter that walks the prototype and stringifies each value.
			for (const key in value as Record<string, unknown>) {
				decl.setProperty(key, String((value as Record<string, unknown>)[key]));
			}
		},
	});
	Object.defineProperty(StyleSinkElement.prototype, "Style", {
		configurable: true,
		set(value: unknown) {
			styleCaseSeen.push(value);
		},
	});
	Object.defineProperty(StyleSinkElement.prototype, "title", {
		configurable: true,
		set(value: unknown) {
			titleSeen.push(value);
		},
	});
	customElements.define("x-style-sink", StyleSinkElement);
}

const REMOTE_LOADER =
	/(?:@import\b|(?:-webkit-)?image-set\s*\(|\bsrc\s*\(|\burl\s*\(|expression\s*\(|-moz-binding|(?:^|[^-\w])behavior\b)/i;

function styleAsCss(value: unknown): string {
	if (typeof value === "string") return value;
	if (!value || typeof value !== "object") return "";
	let css = "";
	for (const key in value as Record<string, unknown>) {
		css += `${key}:${String((value as Record<string, unknown>)[key])};`;
	}
	return css;
}

function nativeStyle(element: HTMLElement): string {
	const decl = Object.getOwnPropertyDescriptor(
		HTMLElement.prototype,
		"style",
	)?.get?.call(element) as CSSStyleDeclaration | undefined;
	return decl?.cssText ?? "";
}

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

	it("omits a script that has a src and no text", () => {
		const host = mount("script", { src: "https://example.com/app.js" });
		expect(host.querySelector("script")).toBeNull();
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
			mount("img", { srcset: "https://cdn.example/a.png 1x, /b.png 2x" })
				.querySelector("img")
				?.getAttribute("srcset"),
		).toContain("https://cdn.example/a.png");
		expect(
			mount("img", { srcset: "data:image/png;base64,aaaa 1x, /b.png 2x" })
				.querySelector("img")
				?.getAttribute("srcset"),
		).toContain("data:image/png");
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
		expect(
			mount("img", { srcset: "https://cdn.example/a.png,javascript:alert(1)" })
				.querySelector("img")
				?.getAttribute("srcset"),
		).toBe("https://cdn.example/a.png,javascript:alert(1)");
		expect(
			mount("script", { src: "data:text/javascript,alert(1)" }).querySelector(
				"script",
			),
		).toBeNull();
		expect(
			mount("iframe", { src: "data:application/octet-stream,hi" })
				.querySelector("iframe")
				?.getAttribute("src"),
		).toBeNull();
		expect(
			mount("script", {
				src: "https://example.com/app.js",
				children: null,
			}).querySelector("script"),
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
			// poster is one URL. A space is not a second candidate, which is
			// the ping rule. Tokenizing here would drop a harmless poster.
			expect(
				mount("video", {
					poster: "https://cdn.example/a.png javascript:alert(1)",
				})
					.querySelector("video")
					?.getAttribute("poster"),
			).toBe("https://cdn.example/a.png javascript:alert(1)");
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
			// biome-ignore lint/suspicious/noPrototypeBuiltins: test tsconfig lib predates Object.hasOwn
			expect(Object.prototype.hasOwnProperty.call(anchor ?? {}, key)).toBe(
				false,
			);
			expect(
				(Object.prototype as { polluted?: boolean }).polluted,
			).toBeUndefined();
		},
	);

	it("forbidden keys stay dropped across fast-check values", () => {
		fc.assert(
			fc.property(
				fc.constantFrom("__proto__", "constructor", "prototype"),
				fc.string({ minLength: 1, maxLength: 12 }),
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

		const named = safeSpread(
			{ onclick: "alert(1)", id: "x", title: "stay", on: "nope" },
			{ handlers: ["onclick"] },
		);
		expect(named.onclick).toBeUndefined();
		expect(named.title).toBe("stay");
		expect(named.on).toBe("nope");
		expect(safeSpread(null as unknown as object)).toEqual({});
		expect(safeSpread(1 as unknown as object)).toEqual({});
		expect(safeSpread("ab" as unknown as object)).toEqual({});
		const namedString = mount("div", named);
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

		const spaced = mount("div", {
			style: "color: red; background-image: uRl (https://evil.example/leak)",
		}).querySelector("div") as HTMLElement;
		expect(spaced.style.color).toBe("red");
		expect(spaced.style.backgroundImage).toBe("");
	});

	it("an untrusted style object cannot set a remote url", () => {
		const calls: string[] = [];
		const set = CSSStyleDeclaration.prototype.setProperty;
		const remove = CSSStyleDeclaration.prototype.removeProperty;
		CSSStyleDeclaration.prototype.setProperty = function (
			name: string,
			value: string,
			priority?: string,
		) {
			calls.push(`set:${name}:${String(value)}`);
			return set.call(this, name, value, priority);
		};
		CSSStyleDeclaration.prototype.removeProperty = function (name: string) {
			calls.push(`remove:${name}`);
			return remove.call(this, name);
		};
		try {
			const el = mount("div", {
				style: {
					color: "red",
					backgroundImage: "url(https://evil.example/leak)",
					opacity: null,
				},
			}).querySelector("div") as HTMLElement;
			expect(el.style.color).toBe("red");
			expect(el.style.backgroundImage).toBe("");
			expect(el.style.opacity).not.toBe("null");
			expect(calls.some((call) => call.startsWith("set:opacity:"))).toBe(false);
			expect(calls).toContain("remove:background-image");
			expect(
				calls.some((call) => call.startsWith("set:background-image:")),
			).toBe(false);
		} finally {
			CSSStyleDeclaration.prototype.setProperty = set;
			CSSStyleDeclaration.prototype.removeProperty = remove;
		}

		const fake = {
			[Symbol.for("ignite-element.trustedStyle")]: 1,
		};
		expect(readTrustedStyle(fake)).toBeUndefined();
		expect(readTrustedStyle(Symbol("style"))).toBeUndefined();
		expect(readTrustedStyle("color: red")).toBeUndefined();
		const brandedFn = (() => {}) as unknown as Record<symbol, string>;
		brandedFn[Symbol.for("ignite-element.trustedStyle")] = "color: red";
		expect(readTrustedStyle(brandedFn)).toBeUndefined();
		const branded = mount("div", { style: fake }).querySelector(
			"div",
		) as HTMLElement;
		expect(branded.style.cssText).not.toBe("1");
	});

	it("a style element keeps component css, drops url(), and does not parse html", async () => {
		const component = document.createElement("div");
		document.body.append(component);
		mountIgniteJsx(
			component,
			jsx("div", {
				children: jsx("style", {
					children: ".count { color: rebeccapurple; }",
				}),
			}),
		);
		expect(component.querySelector("style")?.textContent).toContain(
			"rebeccapurple",
		);

		const leaked = document.createElement("div");
		document.body.append(leaked);
		mountIgniteJsx(
			leaked,
			jsx("div", {
				children: jsx("style", {
					children:
						".ok{color:red}; .leak{background:url(https://evil.example/x)}",
				}),
			}),
		);
		const leakedText = leaked.querySelector("style")?.textContent ?? "";
		expect(leakedText).toBe(".ok{color:red} .leak{}");
		expect(leakedText.toLowerCase()).not.toContain("url(");

		const onlyUrl = document.createElement("div");
		document.body.append(onlyUrl);
		mountIgniteJsx(
			onlyUrl,
			jsx("div", {
				children: jsx("style", {
					children: "a{background:url(https://evil.example/x)}",
				}),
			}),
		);
		expect(onlyUrl.querySelector("style")?.textContent).toBe("a{}");

		const breakout = document.createElement("div");
		document.body.append(breakout);
		mountIgniteJsx(
			breakout,
			jsx("div", {
				children: jsx("style", {
					children: "</style><img src=x onerror=alert(1)>",
				}),
			}),
		);
		expect(breakout.querySelector("img")).toBeNull();
		expect(breakout.querySelector("style")?.textContent).toContain("</style>");

		const split = document.createElement("div");
		document.body.append(split);
		mountIgniteJsx(
			split,
			jsx("div", {
				children: jsx("style", {
					children: ["body{background:url", null, "(https://evil.example/x)}"],
				}),
			}),
		);
		expect(
			split.querySelector("style")?.textContent?.toLowerCase() ?? "",
		).not.toContain("url(");

		const { trustedStyle: trust } = await loadHelpers();
		expect(typeof trust).toBe("function");
		if (typeof trust !== "function") return;
		const mixed = document.createElement("div");
		document.body.append(mixed);
		mountIgniteJsx(
			mixed,
			jsx("div", {
				children: jsx("style", {
					children: [
						trust(".a{background:url(https://cdn.example/a.png)};"),
						"body{background:url",
						"(https://evil.example/x)}",
						trust("url("),
						"https://evil.example/y)",
					],
				}),
			}),
		);
		const mixedText = mixed.querySelector("style")?.textContent ?? "";
		expect(mixedText).toContain("https://cdn.example/a.png");
		expect(mixedText.toLowerCase()).not.toContain("evil.example");

		const paired = document.createElement("div");
		document.body.append(paired);
		mountIgniteJsx(
			paired,
			jsx("div", {
				children: jsx("style", {
					children: trust(
						".ok{color:red};.a{background:url(https://cdn.example/a.png)}",
					),
				}),
			}),
		);
		expect(paired.querySelector("style")?.textContent).toContain(
			"https://cdn.example/a.png",
		);

		const afterSafe = document.createElement("div");
		document.body.append(afterSafe);
		mountIgniteJsx(
			afterSafe,
			jsx("div", {
				children: jsx("style", {
					children: [
						".ok{color:red};",
						trust(".a{background:url(https://cdn.example/a.png)}"),
					],
				}),
			}),
		);
		expect(afterSafe.querySelector("style")?.textContent).toContain(
			"https://cdn.example/a.png",
		);

		const tail = document.createElement("div");
		document.body.append(tail);
		mountIgniteJsx(
			tail,
			jsx("div", {
				children: jsx("style", {
					children: [
						trust(".a{background:url(https://cdn.example/a.png)"),
						"}",
					],
				}),
			}),
		);
		expect(tail.querySelector("style")?.textContent ?? "").not.toContain(
			"cdn.example",
		);

		const warnings: string[] = [];
		const previous = console.warn;
		console.warn = (...args: unknown[]) => {
			warnings.push(args.map((part) => String(part)).join(" "));
		};
		try {
			mount("style", { children: ".count { color: rebeccapurple; }" });
			expect(warnings.join("\n")).not.toContain("dropped a url");
			warnings.length = 0;
			mount("style", {
				children:
					".ok{color:red}; .leak{background:url(https://evil.example/x)}",
			});
			const warningText = warnings.join("\n");
			expect(warningText).toContain("dropped a url");
			expect(warningText).not.toContain("evil.example");
		} finally {
			console.warn = previous;
		}

		expect(
			styleSheetFromChildren([
				{
					kind: "comment",
					value: "a{background:url(https://evil.example/z)}",
				},
				{ kind: "text", value: ".ok{color:red}" },
			]),
		).toEqual({ css: ".ok{color:red}", droppedUrl: false });
		expect(styleSheetFromChildren([{ kind: "text" }])).toEqual({
			css: "",
			droppedUrl: false,
		});
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

		const empty = mount("script", { children: "" });
		expect(empty.querySelector("script")).toBeNull();

		const fromComponent = () => "alert(1)";
		const componentHost = mount("div", {
			children: jsx("script", { children: jsx(fromComponent, {}) }),
		});
		expect(componentHost.querySelector("script")).toBeNull();

		// A comment child is not text. A src still omits the element.
		expect(
			mount("script", {
				src: "https://example.com/app.js",
				children: true,
			}).querySelector("script"),
		).toBeNull();
	});
});

describe("security review", () => {
	it("drops import, image-set, and src() from untrusted style", async () => {
		const sheet = (css: unknown) => {
			const host = document.createElement("div");
			document.body.append(host);
			mountIgniteJsx(
				host,
				jsx("div", { children: jsx("style", { children: css }) }),
			);
			return host.querySelector("style")?.textContent ?? "";
		};

		const imported = sheet(
			"@import 'https://evil.example/x.css'; .ok{color:red}",
		);
		expect(imported.toLowerCase()).not.toContain("@import");
		expect(imported).not.toContain("evil.example");
		expect(imported).toContain(".ok{color:red}");

		const imageSet = sheet(
			".a{background:image-set('https://evil.example/x' 1x)}; .ok{color:red}",
		);
		expect(imageSet.toLowerCase()).not.toContain("image-set");
		expect(imageSet).not.toContain("evil.example");
		expect(imageSet).toContain(".ok{color:red}");

		const webkit = sheet(
			".a{background:-webkit-image-set('https://evil.example/x' 1x)}; .ok{color:red}",
		);
		expect(webkit.toLowerCase()).not.toContain("image-set");
		expect(webkit).not.toContain("evil.example");
		expect(webkit).toContain(".ok{color:red}");

		const srcFn = sheet(
			".a{background:src('https://evil.example/x')}; .ok{color:red}",
		);
		expect(srcFn.toLowerCase()).not.toContain("src(");
		expect(srcFn).not.toContain("evil.example");
		expect(srcFn).toContain(".ok{color:red}");

		const attr = mount("div", {
			style:
				"color: red; background-image: image-set('https://evil.example/x' 1x)",
		}).querySelector("div") as HTMLElement;
		expect(attr.style.color).toBe("red");
		expect(attr.style.cssText.toLowerCase()).not.toContain("image-set");
		expect(attr.style.cssText).not.toContain("evil.example");

		const atRule = mount("div", {
			style: "@import 'https://evil.example/a.css'; color: red",
		}).querySelector("div") as HTMLElement;
		expect(atRule.style.color).toBe("red");
		expect(atRule.style.cssText.toLowerCase()).not.toContain("import");

		const fromObject = mount("div", {
			style: {
				color: "red",
				backgroundImage: "image-set('https://evil.example/x' 1x)",
				content: "src('https://evil.example/y')",
			},
		}).querySelector("div") as HTMLElement;
		expect(fromObject.style.color).toBe("red");
		expect(fromObject.style.backgroundImage).toBe("");
		expect(fromObject.style.content).not.toContain("evil.example");

		const webkitObject = mount("div", {
			style: {
				backgroundImage: "-webkit-image-set('https://evil.example/x' 1x)",
			},
		}).querySelector("div") as HTMLElement;
		expect(webkitObject.style.backgroundImage).toBe("");

		const { trustedStyle } = await loadHelpers();
		expect(typeof trustedStyle).toBe("function");
		if (typeof trustedStyle !== "function") return;
		const trusted = sheet(
			trustedStyle("@import 'https://cdn.example/a.css'; .ok{color:red}"),
		);
		expect(trusted).toContain("@import");
		expect(trusted).toContain("https://cdn.example/a.css");
	});

	it("does not split a style declaration on a semicolon inside a string or comment", () => {
		const host = document.createElement("div");
		document.body.append(host);
		mountIgniteJsx(
			host,
			jsx("div", {
				children: jsx("style", {
					children:
						".ok{color:red}; a{background:url('https://evil.example/x/;y')}; .also{color:blue}",
				}),
			}),
		);
		const quoted = host.querySelector("style")?.textContent ?? "";
		expect(quoted).toContain(".ok{color:red}");
		expect(quoted).toContain(".also{color:blue}");
		expect(quoted).not.toContain("evil.example");
		expect(quoted).not.toContain("y')");

		const commented = document.createElement("div");
		document.body.append(commented);
		mountIgniteJsx(
			commented,
			jsx("div", {
				children: jsx("style", {
					children:
						".safe{color:red}; a{background:url(https://evil.example/x) /* comment ; still */}; .also{color:blue}",
				}),
			}),
		);
		const text = commented.querySelector("style")?.textContent ?? "";
		expect(text).toContain(".safe{color:red}");
		expect(text).toContain(".also{color:blue}");
		expect(text).not.toContain("still");
		expect(text).not.toContain("evil.example");
	});

	it("keeps safeSpread data keys that are not event handlers", async () => {
		const { safeSpread } = await loadHelpers();
		expect(typeof safeSpread).toBe("function");
		if (typeof safeSpread !== "function") return;
		const onClick = () => {};
		const onError = () => {};
		const data = safeSpread({
			one: "yes",
			online: "yes",
			onlyIcon: "yes",
			onclick: "alert(1)",
			onClick,
			ONERROR: onError,
			ononline: "alert(1)",
			onrepeat: "alert(1)",
		});
		expect(data.one).toBe("yes");
		expect(data.online).toBe("yes");
		expect(data.onlyIcon).toBe("yes");
		expect(data.onclick).toBeUndefined();
		expect(data.onClick).toBeUndefined();
		expect(data.ONERROR).toBeUndefined();
		expect(data.ononline).toBeUndefined();
		expect(data.onrepeat).toBeUndefined();

		const host = mount("div", safeSpread({ one: "yes", id: "s" }));
		expect(host.querySelector("div")?.getAttribute("one")).toBe("yes");
		expect(host.querySelector("div")?.id).toBe("s");
	});

	it("omits a script whose children are elements", () => {
		const host = mount("div", {
			children: jsx("script", {
				src: "https://example.com/app.js",
				children: jsx("span", { children: "alert(1)" }),
			}),
		});
		expect(host.querySelector("script")).toBeNull();
		expect(host.querySelector("span")).toBeNull();

		const Icon = () => jsx("span", { children: "x" });
		const fromComponent = mount("div", {
			children: jsx("script", { children: jsx(Icon, {}) }),
		});
		expect(fromComponent.querySelector("script")).toBeNull();
		expect(fromComponent.querySelector("span")).toBeNull();
	});

	it("treats every html space and a trailing comma run as srcset syntax", () => {
		expect(srcsetCandidates(" \t\n\f\r,https://cdn.example/a.png 1x")).toEqual([
			"https://cdn.example/a.png 1x",
		]);
		expect(srcsetCandidates("https://cdn.example/a,,png,")).toEqual([
			"https://cdn.example/a,,png",
		]);
		expect(
			styleSheetFromChildren([
				{
					kind: "text",
					value: ".ok{color:red} /* star * still */; .keep{color:blue}",
				},
			]).css,
		).toContain("still");
		expect(
			styleSheetFromChildren([
				{
					kind: "text",
					value: ".ok{content:'a\\\\;b'}; .keep{color:blue}",
				},
			]).css,
		).toContain(".keep{color:blue}");
	});

	it("parses srcset candidates without splitting a data url on its comma", () => {
		expect(
			mount("img", {
				srcset: "data:image/png;base64,javascript:alert(1) 1x",
			})
				.querySelector("img")
				?.getAttribute("srcset"),
		).toContain("data:image/png");
		expect(
			mount("img", {
				srcset: "https://cdn.example/a.png, javascript:alert(1)",
			})
				.querySelector("img")
				?.getAttribute("srcset"),
		).toBeNull();
	});

	it("drops data xml urls on href", () => {
		for (const href of [
			"data:text/xml,<x/>",
			"data:application/xml,<x/>",
			"data:application/mathml+xml,<math/>",
		]) {
			expect(
				mount("a", { href, children: "x" })
					.querySelector("a")
					?.getAttribute("href"),
			).toBeNull();
		}
	});

	it("drops dangerouslySetInnerHTML and guards xlinkHref like xlink:href", () => {
		const injected = mount("div", {
			dangerouslySetInnerHTML: { __html: "<img src=x>" },
		});
		expect(injected.querySelector("img")).toBeNull();
		expect(
			injected.querySelector("div")?.getAttribute("dangerouslysetinnerhtml"),
		).toBeNull();
		expect(injected.querySelector("div")?.innerHTML).toBe("");

		const blocked = mount("svg", {
			children: jsx("use", { xlinkHref: "javascript:alert(1)" }),
		});
		expect(blocked.querySelector("use")?.getAttribute("xlink:href")).toBeNull();
		expect(blocked.querySelector("use")?.getAttribute("xlinkhref")).toBeNull();

		const kept = mount("svg", {
			children: jsx("use", { xlinkHref: "https://example.com/a.svg#i" }),
		});
		expect(kept.querySelector("use")?.getAttribute("xlink:href")).toContain(
			"https://example.com/a.svg",
		);
		expect(kept.querySelector("use")?.getAttribute("xlinkhref")).toBeNull();
	});

	it("does not apply a script text prop on mount or update", async () => {
		const host = document.createElement("div");
		document.body.append(host);
		mountIgniteJsx(host, jsx("script", { src: "https://example.com/app.js" }));
		expect(host.querySelector("script")).toBeNull();
		mountIgniteJsx(
			host,
			jsx("script", {
				src: "https://example.com/app.js",
				text: "window.__igniteScriptText = 1",
			}),
		);
		expect(host.querySelector("script")).toBeNull();
		expect(
			(globalThis as { __igniteScriptText?: number }).__igniteScriptText,
		).toBeUndefined();

		const mounted = mount("script", { text: "window.__igniteScriptText = 2" });
		const created = mounted.querySelector("script") as HTMLScriptElement | null;
		expect(created?.text ?? "").not.toContain("__igniteScriptText");
		expect(created?.textContent ?? "").not.toContain("__igniteScriptText");

		const { safeSpread } = await loadHelpers();
		expect(typeof safeSpread).toBe("function");
		if (typeof safeSpread !== "function") return;
		const spread = safeSpread({
			text: "alert(1)",
			textContent: "alert(1)",
			innerText: "alert(1)",
			id: "stay",
		});
		expect(spread.text).toBeUndefined();
		expect(spread.textContent).toBeUndefined();
		expect(spread.innerText).toBeUndefined();
		expect(spread.id).toBe("stay");
	});

	it("guards prefixed script and style tags by local name", () => {
		const host = document.createElement("div");
		document.body.append(host);
		mountIgniteJsx(
			host,
			jsx("svg", {
				children: [
					jsx("x:script", { children: "window.__ignitePrefixed = 1" }),
					jsx("X:STYLE", {
						children:
							".a{background:url(https://evil.example/x)}; .ok{color:red}",
					}),
				],
			}),
		);
		expect(host.querySelector("script")).toBeNull();
		expect(
			(globalThis as { __ignitePrefixed?: number }).__ignitePrefixed,
		).toBeUndefined();
		const sheet =
			[...host.querySelectorAll("*")].find(
				(element) => element.localName.toLowerCase() === "style",
			)?.textContent ?? "";
		expect(sheet.toLowerCase()).not.toContain("url(");
		expect(sheet).not.toContain("evil.example");
		expect(sheet).toContain(".ok{color:red}");
	});

	it("filters every casing of the style prop and css escapes", async () => {
		const styled = mount("div", {
			STYLE:
				"color: red; background: u\\72l(https://evil.example/x); background: url(https://evil.example/y)",
		}).querySelector("div") as HTMLElement;
		expect(styled.style.color).toBe("red");
		expect(styled.style.cssText.toLowerCase()).not.toContain("url(");
		expect(styled.style.cssText).not.toContain("evil.example");

		const objectCase = mount("div", {
			Style: { backgroundImage: "u\\72l(https://evil.example/z)" },
		}).querySelector("div") as HTMLElement;
		expect(objectCase.style.backgroundImage).toBe("");

		const sheetHost = document.createElement("div");
		document.body.append(sheetHost);
		mountIgniteJsx(
			sheetHost,
			jsx("style", {
				children:
					".a{background:u\\72l(https://evil.example/x)}; .ok{color:red}",
			}),
		);
		const sheet = sheetHost.querySelector("style")?.textContent ?? "";
		expect(sheet).not.toContain("evil.example");
		expect(sheet.toLowerCase()).not.toContain("url(");
		expect(sheet).toContain(".ok{color:red}");

		const { trustedStyle } = await loadHelpers();
		expect(typeof trustedStyle).toBe("function");
		if (typeof trustedStyle !== "function") return;
		const token = trustedStyle(
			"color: red; background:u\\72l(https://cdn.example/a.png)",
		);
		expect(
			styleSheetFromChildren([
				{
					kind: "text",
					value: readTrustedStyle(token),
					trusted: true,
				},
			]).css,
		).toContain("cdn.example");
		const trusted = mount("div", { style: token }).querySelector(
			"div",
		) as HTMLElement;
		expect(trusted.style.color).toBe("red");
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
		expect(safeUrl("//cdn.example/a")).toBeNull();
		expect(safeUrl("\\\\cdn.example\\a")).toBeNull();
		expect(safeUrl("/\\cdn.example\\a")).toBeNull();
		expect(safeUrl("\\/cdn.example/a")).toBeNull();
		expect(safeUrl(" \t//cdn.example/a")).toBeNull();
		expect(safeUrl("javascript:alert(1)")).toBeNull();
		expect(safeUrl("java\nscript:alert(1)")).toBeNull();
		expect(safeUrl(" \tVbScript:alert(1)")).toBeNull();
		expect(safeUrl("data:text/html,hi")).toBeNull();
		expect(safeUrl("blob:https://example.com/id")).toBeNull();
		expect(safeUrl("ftp://example.com")).toBeNull();
		expect(safeUrl("")).toBeNull();
		expect(safeUrl(1 as unknown as string)).toBeNull();

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
			style: {
				backgroundImage: trustedStyle("url(https://cdn.example/a.png)"),
				color: "red",
			},
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
				children: jsx("style", {
					children: trustedStyle(
						".a{background:url(https://cdn.example/a.png)}",
					),
				}),
			}),
		);
		expect(host.querySelector("style")?.textContent).toContain(
			"url(https://cdn.example/a.png)",
		);
		expect(host.querySelector("img")).toBeNull();

		expect(() => trustedStyle(1 as unknown as string)).toThrow(
			"trustedStyle expects a string",
		);
	});
});

describe("approved url and remote-resource decisions", () => {
	it("drops protocol-relative hrefs and schemes outside the allowlist", () => {
		for (const href of [
			"//evil.com",
			"\\\\evil.com",
			"/\\evil.com",
			"\\/evil.com",
			"ftp://example.com/a",
			"data:image/png;base64,aaaa",
			"blob:https://example.com/id",
		]) {
			expect(
				mount("a", { href, children: "x" })
					.querySelector("a")
					?.getAttribute("href"),
			).toBeNull();
		}
		expect(
			mount("img", { src: "data:image/png;base64,aaaa" })
				.querySelector("img")
				?.getAttribute("src"),
		).toContain("data:image/png");
		expect(
			mount("img", { src: "data:image/svg+xml,<svg></svg>" })
				.querySelector("img")
				?.getAttribute("src"),
		).toBeNull();
		expect(
			mount("img", { src: "https://cdn.example/a.png" })
				.querySelector("img")
				?.getAttribute("src"),
		).toContain("https://cdn.example/a.png");
	});

	it("omits src scripts and stylesheet links in any case or prefix", () => {
		const host = mount("div", {
			children: [
				jsx("script", {}),
				jsx("script", { src: "https://cdn.example/a.js" }),
				jsx("SCRIPT", { SRC: "/a.js" }),
				jsx("x:script", { src: "https://cdn.example/b.js" }),
				jsx("link", {
					rel: "stylesheet",
					href: "https://cdn.example/a.css",
				}),
				jsx("link", { rel: "StyleSheet", href: "/a.css" }),
				jsx("X:LINK", { REL: "preload stylesheet", href: "/b.css" }),
				jsx("link", { rel: "icon", href: "https://cdn.example/favicon.ico" }),
			],
		});
		const tags = [...host.querySelectorAll("*")].map((element) =>
			element.localName.toLowerCase(),
		);
		expect(
			tags.filter((tag) => tag === "script" || tag.endsWith(":script")),
		).toHaveLength(1);
		expect(
			[...host.querySelectorAll("*")].some((element) =>
				(element.getAttribute("rel") ?? "")
					.toLowerCase()
					.includes("stylesheet"),
			),
		).toBe(false);
		expect(host.querySelector("link")?.getAttribute("rel")).toBe("icon");
		expect(host.querySelector("link")?.getAttribute("href")).toContain(
			"favicon.ico",
		);

		expect(
			mount("script", {
				src: false,
				SRC: "https://evil.example/dup.js",
			}).querySelector("script"),
		).toBeNull();
		expect(
			mount("svg", {
				children: jsx("script", { href: "https://evil.example/svg.js" }),
			}).querySelector("script"),
		).toBeNull();
		expect(
			mount("svg", {
				children: jsx("script", {
					xlinkHref: "https://evil.example/svg.js",
				}),
			}).querySelector("script"),
		).toBeNull();

		const spellings = mount("div", {
			children: [
				jsx("link", {
					rel: ["stylesheet"],
					href: "https://evil.example/a.css",
				}),
				jsx("link", {
					rel: { toString: () => "stylesheet" },
					href: "/a.css",
				}),
				jsx("link", { rel: "icon", REL: "stylesheet", href: "/b.css" }),
			],
		});
		expect(spellings.querySelector("link")).toBeNull();
	});

	it("omits a script when an own source key is present, whatever the value", () => {
		expect(mount("script", {}).querySelector("script")).not.toBeNull();
		expect(
			mount("script", { id: "keep", type: "module" }).querySelector("script"),
		).not.toBeNull();
		expect(
			mount("script", { srcset: false }).querySelector("script"),
		).not.toBeNull();
		// rel is a token check. A present false is not a stylesheet.
		expect(
			mount("link", {
				rel: false,
				href: "https://cdn.example/a.css",
			}).querySelector("link"),
		).not.toBeNull();

		const spellings = [
			"src",
			"SRC",
			"Src",
			"href",
			"HREF",
			"xlink:href",
			"xlinkHref",
			"XLINK:HREF",
			"xlinkhref",
			"svg:src",
			"XML:HREF",
			"foo:xlink:href",
			"ns:Src",
		];
		const falsy = [false, null, undefined, "", 0] as const;
		for (const key of spellings) {
			for (const value of falsy) {
				const props: Record<string, unknown> = { id: "keep" };
				props[key] = value;
				expect(
					mount("script", props).querySelector("script"),
					`${key}=${String(value)}`,
				).toBeNull();
			}
		}
		expect(
			mount("svg", {
				children: jsx("script", { href: null }),
			}).querySelector("script"),
		).toBeNull();
		expect(
			mount("x:script", { src: false }).querySelector("script"),
		).toBeNull();

		fc.assert(
			fc.property(
				fc.constantFrom(...spellings),
				fc.constantFrom(...falsy),
				fc.constantFrom("script", "SCRIPT", "x:script", "svg:script"),
				(key, value, tag) => {
					const props: Record<string, unknown> = { id: "keep" };
					props[key] = value;
					const host =
						tag === "svg:script"
							? mount("svg", { children: jsx("script", props) })
							: mount(tag, props);
					expect(host.querySelector("script")).toBeNull();
				},
			),
			{ numRuns: 48, seed: 1 },
		);
	});

	it("drops expression, behavior, moz-binding, and commented url() from untrusted style", async () => {
		const css =
			"color: red; width: expression(alert(1)); behavior: none; -moz-binding: none; scroll-behavior: smooth; background: url/**/(https://evil.example/a.png); background: url /*c*/ (https://evil.example/b.png); color: blue";
		const filtered = styleSheetFromChildren([{ kind: "text", value: css }]).css;
		expect(filtered).toContain("color: red");
		expect(filtered).toContain("color: blue");
		expect(filtered).toContain("scroll-behavior: smooth");
		expect(filtered.toLowerCase()).not.toContain("expression");
		expect(filtered.toLowerCase()).not.toContain("behavior: none");
		expect(filtered.toLowerCase()).not.toContain("moz-binding");
		expect(filtered).not.toContain("evil.example");
		const hidden = styleSheetFromChildren([
			{
				kind: "text",
				value:
					'body::before{content:"/*" url(https://evil.example/pixel.png) "*/"}',
			},
		]).css;
		expect(hidden).not.toContain("evil.example");
		expect(hidden.toLowerCase()).not.toContain("url(");

		const host = document.createElement("div");
		document.body.append(host);
		mountIgniteJsx(host, jsx("style", { children: css }));
		const sheet = host.querySelector("style")?.textContent ?? "";
		expect(sheet).toContain("color: red");
		expect(sheet).not.toContain("evil.example");
		expect(sheet.toLowerCase()).not.toContain("expression");

		const styled = mount("div", {
			style: {
				color: "red",
				width: "expression(alert(1))",
				behavior: "url(#x)",
			},
		}).querySelector("div") as HTMLElement;
		expect(styled.style.color).toBe("red");
		expect(styled.style.cssText.toLowerCase()).not.toContain("expression");
		expect(styled.getAttribute("style")?.toLowerCase() ?? "").not.toContain(
			"behavior",
		);

		const { trustedStyle } = await loadHelpers();
		expect(typeof trustedStyle).toBe("function");
		if (typeof trustedStyle !== "function") return;
		const token = trustedStyle("width: expression(1); color: red");
		expect(
			styleSheetFromChildren([
				{ kind: "text", value: readTrustedStyle(token), trusted: true },
			]).css,
		).toContain("expression");
	});
});

function linkLoadsStylesheet(host: ParentNode): boolean {
	for (const link of host.querySelectorAll("link")) {
		const rel = `${link.getAttribute("rel") ?? ""} ${[...link.relList].join(" ")}`;
		if (rel.toLowerCase().includes("stylesheet") && link.getAttribute("href")) {
			return true;
		}
	}
	return false;
}

describe("security re-review of remote loads", () => {
	it("does not load a stylesheet through relList on mount, update, or safeSpread", async () => {
		expect(
			linkLoadsStylesheet(
				mount("link", {
					relList: "stylesheet",
					href: "https://evil.example/x.css",
				}),
			),
		).toBe(false);
		expect(
			linkLoadsStylesheet(
				mount("link", {
					RELLIST: "styleSheet",
					href: "https://evil.example/x.css",
				}),
			),
		).toBe(false);

		const host = document.createElement("div");
		document.body.append(host);
		const first = renderIgniteJsx(
			host,
			jsx("link", { rel: "icon", href: "https://cdn.example/favicon.ico" }),
		);
		expect(host.querySelector("link")?.getAttribute("rel")).toBe("icon");
		renderIgniteJsx(
			host,
			jsx("link", {
				relList: "stylesheet",
				href: "https://evil.example/x.css",
			}),
			first,
		);
		expect(linkLoadsStylesheet(host)).toBe(false);

		const { safeSpread } = await loadHelpers();
		expect(typeof safeSpread).toBe("function");
		if (typeof safeSpread !== "function") return;
		const spread = safeSpread({
			relList: "stylesheet",
			href: "https://evil.example/spread.css",
		});
		expect(spread).not.toHaveProperty("relList");
		expect(linkLoadsStylesheet(mount("link", spread))).toBe(false);
		expect(
			linkLoadsStylesheet(
				mount("div", {
					children: jsx("link", {
						...spread,
						rel: "stylesheet",
						href: "https://evil.example/spread.css",
					}),
				}),
			),
		).toBe(false);
	});

	it("reads a mounted link rel once and does not write href when that read is blocked", () => {
		const host = document.createElement("div");
		document.body.append(host);
		const href = "https://cdn.example/favicon.ico";
		const evil = "https://evil.example/a.css";
		let tree = renderIgniteJsx(host, jsx("link", { rel: "icon", href }));
		const link = host.querySelector("link");
		expect(link?.getAttribute("rel")).toBe("icon");
		expect(link?.getAttribute("href")).toContain("favicon.ico");

		const writes: string[] = [];
		const setAttribute = Element.prototype.setAttribute;
		Element.prototype.setAttribute = function (
			this: Element,
			name: string,
			value: string,
		) {
			if (this.localName === "link") writes.push(`${name}=${String(value)}`);
			return setAttribute.call(this, name, value);
		};
		try {
			const blocked = ["stylesheet", "preload", "modulepreload", "import"];
			let reads = 0;
			const rel = {
				toString() {
					reads += 1;
					return reads === 1 ? "icon" : "stylesheet";
				},
			};
			writes.length = 0;
			tree = renderIgniteJsx(host, jsx("link", { rel, href: evil }), tree);
			expect(reads).toBe(1);
			expect(host.querySelector("link")?.getAttribute("rel")).toBe("icon");
			expect(
				writes.some((write) =>
					/^(?:rel|rellist)=(?:stylesheet|preload|modulepreload|import)$/i.test(
						write,
					),
				),
			).toBe(false);

			fc.assert(
				fc.property(
					fc.constantFrom("rel", "REL", "Rel"),
					fc.constantFrom("icon", "prefetch", "dns-prefetch", "preconnect"),
					fc.constantFrom(...blocked, "StyleSheet", "ModulePreload"),
					(key, safe, blockedRel) => {
						reads = 0;
						const flipping = {
							toString() {
								reads += 1;
								return reads === 1 ? safe : blockedRel;
							},
						};
						writes.length = 0;
						const props: Record<string, unknown> = { href: evil };
						props[key] = flipping;
						tree = renderIgniteJsx(host, jsx("link", props), tree);
						expect(reads).toBe(1);
						expect(
							writes.some((write) => write.endsWith(`=${blockedRel}`)),
						).toBe(false);
						expect(host.querySelector("link")?.getAttribute("rel")).toBe(safe);
					},
				),
				{ numRuns: 12, seed: 1 },
			);

			reads = 0;
			writes.length = 0;
			const blockedRel = {
				toString() {
					reads += 1;
					return reads === 1 ? "preload" : "icon";
				},
			};
			renderIgniteJsx(host, jsx("link", { rel: blockedRel, href: evil }), tree);
			expect(reads).toBe(1);
			expect(
				writes.some(
					(write) =>
						write.startsWith("href=") && write.includes("evil.example"),
				),
			).toBe(false);
			expect(linkLoadsStylesheet(host)).toBe(false);
		} finally {
			Element.prototype.setAttribute = setAttribute;
		}
	});

	it("does not let URL part setters rewrite href", async () => {
		const parts = [
			"host",
			"hostname",
			"protocol",
			"port",
			"pathname",
			"origin",
			"username",
			"password",
			"search",
			"hash",
		];
		for (const key of parts) {
			const anchor = mount("a", {
				href: "/safe",
				[key]: key === "port" ? "81" : "evil.example",
				children: "x",
			}).querySelector("a");
			expect(anchor?.getAttribute("href"), key).toBe("/safe");
			expect(anchor?.getAttribute(key), key).toBeNull();
		}
		const { safeSpread } = await loadHelpers();
		expect(typeof safeSpread).toBe("function");
		if (typeof safeSpread !== "function") return;
		const spread = safeSpread({ href: "/safe", host: "evil.example" });
		expect(spread).not.toHaveProperty("host");
		expect(
			mount("a", { ...spread, children: "x" })
				.querySelector("a")
				?.getAttribute("href"),
		).toBe("/safe");
	});

	it("drops remote url() on SVG paint and SMIL, and keeps local fragments", () => {
		const host = mount("svg", {
			children: [
				jsx("rect", {
					id: "remote-fill",
					fill: "url(https://evil.example/a.png)",
				}),
				jsx("rect", { id: "local-fill", fill: "url(#grad)" }),
				jsx("rect", {
					id: "filter",
					filter: "url(https://evil.example/f.svg)",
				}),
				jsx("rect", { id: "mask", mask: "url(https://evil.example/m.svg)" }),
				jsx("rect", {
					id: "clip",
					"clip-path": "url(https://evil.example/c.svg)",
				}),
				jsx("rect", {
					id: "marker",
					markerStart: "url(https://evil.example/k.svg)",
				}),
				jsx("set", {
					id: "set-fill",
					attributeName: "fill",
					to: "url(https://evil.example/s.png)",
				}),
				jsx("animate", {
					id: "animate-mask",
					attributeName: "mask",
					values: "url(https://evil.example/a.png);url(#local)",
				}),
			],
		});
		expect(host.querySelector("#remote-fill")?.getAttribute("fill")).toBeNull();
		expect(host.querySelector("#local-fill")?.getAttribute("fill")).toBe(
			"url(#grad)",
		);
		expect(
			mount("svg", {
				children: jsx("rect", { fill: 'url("#grad")' }),
			})
				.querySelector("rect")
				?.getAttribute("fill"),
		).toBe('url("#grad")');
		expect(
			mount("svg", {
				children: jsx("rect", { fill: "url('#grad')" }),
			})
				.querySelector("rect")
				?.getAttribute("fill"),
		).toBe("url('#grad')");
		expect(
			mount("svg", {
				children: jsx("rect", { fill: "URL(#grad)" }),
			})
				.querySelector("rect")
				?.getAttribute("fill"),
		).toBe("URL(#grad)");
		const hidden = [
			"url(#a url(https://evil.example/a.png))",
			"url('#a', url(https://evil.example/a.png))",
			'url("#a" url(https://evil.example/a.png))',
			"url(#grad)url(https://evil.example/a.png)",
			"url(https://evil.example/a.png)url(#grad)",
			"url( #grad )",
			'url( "#grad" )',
		];
		for (const value of hidden) {
			for (const key of ["fill", "filter", "mask", "cursor"] as const) {
				const painted = mount("svg", {
					children: jsx("rect", { [key]: value }),
				}).querySelector("rect");
				expect(painted?.getAttribute(key), `${key} ${value}`).toBeNull();
			}
		}
		const escapes = [
			"u\\rl(//evil.example/m.png)",
			"\\75 rl(//evil.example/m.png)",
			"image-set('//evil.example/m.png' 1x)",
			"src(//evil.example/m.png)",
		];
		for (const value of escapes) {
			for (const key of ["mask", "filter", "cursor", "fill"] as const) {
				const painted = mount("svg", {
					children: jsx("rect", { [key]: value }),
				}).querySelector("rect");
				expect(painted?.getAttribute(key), `${key} ${value}`).toBeNull();
			}
			const set = mount("svg", {
				children: jsx("set", {
					attributeName: "mask",
					to: value,
				}),
			}).querySelector("set");
			expect(set?.getAttribute("to"), value).toBeNull();
		}
		expect(host.querySelector("#filter")?.getAttribute("filter")).toBeNull();
		expect(host.querySelector("#mask")?.getAttribute("mask")).toBeNull();
		expect(host.querySelector("#clip")?.getAttribute("clip-path")).toBeNull();
		expect(
			host.querySelector("#marker")?.getAttribute("marker-start"),
		).toBeNull();
		expect(host.querySelector("#set-fill")?.getAttribute("to")).toBeNull();
		expect(
			host.querySelector("#animate-mask")?.getAttribute("values"),
		).toBeNull();
		expect(host.innerHTML).not.toContain("evil.example");
		let paints = 0;
		const flipping = {
			toString() {
				paints += 1;
				return paints === 1 ? "#fff" : "url(https://evil.example/x.png)";
			},
		};
		const painted = mount("svg", {
			children: jsx("rect", { id: "flip-fill", fill: flipping }),
		});
		expect(
			painted.querySelector("#flip-fill")?.getAttribute("fill"),
		).toBeNull();
		expect(painted.innerHTML).not.toContain("evil.example");
	});

	it("blocks a remote url hidden in a fragment paint", () => {
		fc.assert(
			fc.property(
				fc.constantFrom("fill", "filter", "mask", "cursor"),
				fc.constantFrom("", " ", ",", "/**/", "\0", "\n", "a"),
				(attr, junk) => {
					expect(
						decorativeUrlBlocked(
							"rect",
							attr,
							`url(#a${junk}url(http://e/x.svg#f))`,
						),
					).toBe(true);
					expect(
						decorativeUrlBlocked(
							"rect",
							attr,
							`url('#a${junk}', url(http://e/x.svg#f))`,
						),
					).toBe(true);
				},
			),
			{ numRuns: 24, seed: 1 },
		);
	});

	it("pins SMIL loader names and the raster data image exception", () => {
		const loader = "u\\rl(//e)";
		for (const tag of ["animate", "set", "animatemotion"]) {
			for (const name of ["from", "to", "by", "values"]) {
				expect(decorativeUrlBlocked(tag, name, loader), `${tag} ${name}`).toBe(
					true,
				);
			}
		}
		expect(decorativeUrlBlocked("rect", "values", loader)).toBe(false);
		expect(decorativeUrlBlocked("animate", "dur", loader)).toBe(false);
		expect(decorativeUrlBlocked("set", "begin", loader)).toBe(false);
		const motion = mount("svg", {
			children: jsx("animateMotion", { to: loader }),
		}).querySelector("animateMotion");
		expect(motion?.getAttribute("to")).toBeNull();
		const png = "data:image/png;base64,aaaa";
		expect(
			mount("source", { srcset: `${png} 1x` })
				.querySelector("source")
				?.getAttribute("srcset"),
		).toContain("data:image/png");
		expect(
			mount("iframe", { src: png })
				.querySelector("iframe")
				?.getAttribute("src"),
		).toBeNull();
		expect(
			mount("img", { poster: png })
				.querySelector("img")
				?.getAttribute("poster"),
		).toBeNull();
		expect(urlValueBlocked("src", png, "source")).toBe(false);
		expect(urlValueBlocked("src", png, "iframe")).toBe(true);
	});

	it("filters style before a custom element setter copies it", () => {
		styleSeen.length = 0;
		titleSeen.length = 0;
		const leaked = mount("x-style-sink", {
			style: "background:url(https://evil.example/leak)",
			title: "url(https://evil.example/leak)",
		}).querySelector("x-style-sink") as HTMLElement;
		expect(styleSeen).toEqual([""]);
		expect(nativeStyle(leaked).toLowerCase()).not.toContain("url(");
		expect(leaked.innerHTML).not.toContain("evil.example");
		expect(titleSeen).toEqual(["url(https://evil.example/leak)"]);
		styleSeen.length = 0;
		const mixed = mount("x-style-sink", {
			style: "color:red;background:url(https://evil.example/leak)",
		}).querySelector("x-style-sink") as HTMLElement;
		expect(styleSeen).toEqual(["color:red"]);
		expect(nativeStyle(mixed).toLowerCase()).not.toContain("evil.example");
		styleSeen.length = 0;
		const safeStyle = { color: "red" };
		mount("x-style-sink", { style: safeStyle });
		expect(styleSeen).toEqual([{ color: "red" }]);
		expect(styleSeen[0]).not.toBe(safeStyle);
		expect(Object.getPrototypeOf(styleSeen[0])).toBe(Object.prototype);
		for (const value of Object.values(styleSeen[0] as object)) {
			expect(typeof value).toBe("string");
		}
		styleSeen.length = 0;
		const trusted = trustedStyle("background:url(https://cdn.example/a.png)");
		mount("x-style-sink", { style: trusted });
		expect(styleSeen).toEqual([trusted]);
		expect(styleSeen[0]).toBe(trusted);
		for (const value of [false, 0, 7]) {
			styleSeen.length = 0;
			mount("x-style-sink", { style: value });
			expect(styleSeen).toEqual([value]);
		}
		styleSeen.length = 0;
		const painted = mount("x-style-sink", {
			style: {
				color: "red",
				backgroundImage: "url(https://evil.example/leak)",
				BACKGROUND: "image-set(url(https://evil.example/a) 1x)",
			},
		}).querySelector("x-style-sink") as HTMLElement;
		expect(styleSeen).toEqual([{ color: "red" }]);
		expect(styleAsCss(styleSeen[0])).not.toMatch(REMOTE_LOADER);
		expect(nativeStyle(painted)).not.toMatch(REMOTE_LOADER);
		styleSeen.length = 0;
		const described = mount("x-style-sink", {
			style: {
				color: "blue",
				background: { toString: () => "url(https://evil.example/leak)" },
			},
		}).querySelector("x-style-sink") as HTMLElement;
		expect(styleSeen).toEqual([{ color: "blue" }]);
		expect(nativeStyle(described)).not.toMatch(REMOTE_LOADER);
		fc.assert(
			fc.property(fc.string({ maxLength: 16 }), (css) => {
				styleSeen.length = 0;
				const el = mount("x-style-sink", { style: css }).querySelector(
					"x-style-sink",
				) as HTMLElement;
				const safe = cssTextWithoutUrls(css);
				expect(styleSeen).toEqual([safe]);
				expect(nativeStyle(el).toLowerCase()).not.toMatch(
					/url\s*\(|@import|image-set\s*\(/,
				);
			}),
			{ numRuns: 16, seed: 1 },
		);
		fc.assert(
			fc.property(
				fc.dictionary(
					fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{0,8}$/),
					fc.oneof(
						fc.constantFrom(
							"red",
							"1px",
							"none",
							"url(https://evil.example/a)",
							"url(//evil.example/a)",
							"@import 'https://evil.example/a.css'",
							"image-set(url(https://evil.example/a) 1x)",
							"-webkit-image-set(url(https://evil.example/a) 1x)",
							"expression(alert(1))",
							"-moz-binding:url(https://evil.example/a)",
						),
						fc.string({ maxLength: 24 }),
					),
					{ maxKeys: 4 },
				),
				(style) => {
					styleSeen.length = 0;
					const el = mount("x-style-sink", { style }).querySelector(
						"x-style-sink",
					) as HTMLElement;
					const received = styleSeen[0];
					expect(styleAsCss(received)).not.toMatch(REMOTE_LOADER);
					expect(nativeStyle(el)).not.toMatch(REMOTE_LOADER);
					expect(received).not.toBe(style);
					if (received && typeof received === "object") {
						expect(Object.getPrototypeOf(received)).toBe(Object.prototype);
						for (const value of Object.values(
							received as Record<string, unknown>,
						)) {
							expect(typeof value).toBe("string");
							expect(cssValueForStyle(value)).not.toBe(false);
						}
					}
				},
			),
			{ numRuns: 24, seed: 1 },
		);
	});

	it("copies checked style strings before an own setter", () => {
		expect(cssTextWithoutUrls(null)).toBe(null);
		expect(cssTextWithoutUrls(false)).toBe(false);
		expect(cssTextWithoutUrls(0)).toBe(0);
		expect(cssTextWithoutUrls(7)).toBe(7);
		const trusted = trustedStyle("background:url(https://cdn.example/a.png)");
		expect(cssTextWithoutUrls(trusted)).toBe(trusted);

		let reads = 0;
		const color = {
			toString() {
				reads += 1;
				return reads === 1 ? "red" : "url(https://evil.example/second)";
			},
		};
		styleSeen.length = 0;
		const flipped = mount("x-style-sink", {
			style: { color },
		}).querySelector("x-style-sink") as HTMLElement;
		expect(reads).toBe(1);
		expect(styleSeen[0]).toEqual({ color: "red" });
		expect((styleSeen[0] as { color: unknown }).color).not.toBe(color);
		expect(typeof (styleSeen[0] as { color: unknown }).color).toBe("string");
		expect(styleAsCss(styleSeen[0])).not.toMatch(REMOTE_LOADER);
		expect(nativeStyle(flipped)).not.toMatch(REMOTE_LOADER);

		let inheritedReads = 0;
		const proto = {};
		Object.defineProperty(proto, "backgroundImage", {
			enumerable: true,
			get() {
				inheritedReads += 1;
				return "url(https://evil.example/inherited)";
			},
		});
		const inheritedStyle = Object.create(proto) as { color: string };
		inheritedStyle.color = "red";
		styleSeen.length = 0;
		const inherited = mount("x-style-sink", {
			style: inheritedStyle,
		}).querySelector("x-style-sink") as HTMLElement;
		expect(inheritedReads).toBe(0);
		expect(styleSeen[0]).toEqual({ color: "red" });
		expect(styleSeen[0]).not.toBe(inheritedStyle);
		expect(Object.getPrototypeOf(styleSeen[0])).toBe(Object.prototype);
		expect(styleAsCss(styleSeen[0])).not.toMatch(REMOTE_LOADER);
		expect(nativeStyle(inherited)).not.toMatch(REMOTE_LOADER);

		styleCaseSeen.length = 0;
		mount("x-style-sink", {
			Style: "background:url(https://evil.example/leak)",
		});
		expect(styleCaseSeen).toEqual([""]);

		const safeText = ["red", "1px", "none", "blue"];
		const loaders = [
			"url(https://evil.example/a)",
			"url(//evil.example/a)",
			"@import 'https://evil.example/a.css'",
			"image-set(url(https://evil.example/a) 1x)",
			"-webkit-image-set(url(https://evil.example/a) 1x)",
			"expression(alert(1))",
			"-moz-binding:url(https://evil.example/a)",
		];
		fc.assert(
			fc.property(
				fc.uniqueArray(
					fc.record({
						key: fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{0,6}$/),
						kind: fc.constantFrom("plain", "flip", "getter"),
						text: fc.constantFrom(...safeText, ...loaders),
					}),
					{ maxLength: 3, selector: (entry) => entry.key },
				),
				fc.boolean(),
				(fields, inherit) => {
					const protoChain = Object.create({
						background: "url(https://evil.example/proto)",
					}) as Record<string, unknown>;
					Object.defineProperty(protoChain, "backgroundImage", {
						enumerable: true,
						value: "url(https://evil.example/inherited)",
					});
					const input: Record<string, unknown> = inherit
						? Object.create(protoChain)
						: {};
					for (const field of fields) {
						if (field.kind === "plain") {
							input[field.key] = field.text;
							continue;
						}
						const first = safeText.includes(field.text) ? field.text : "red";
						if (field.kind === "flip") {
							let seen = 0;
							input[field.key] = {
								toString() {
									seen += 1;
									return seen === 1
										? first
										: "url(https://evil.example/second)";
								},
							};
							continue;
						}
						let seen = 0;
						Object.defineProperty(input, field.key, {
							configurable: true,
							enumerable: true,
							get() {
								seen += 1;
								return seen === 1 ? first : "url(https://evil.example/getter)";
							},
						});
					}
					styleSeen.length = 0;
					const el = mount("x-style-sink", { style: input }).querySelector(
						"x-style-sink",
					) as HTMLElement;
					const received = styleSeen[0];
					expect(styleAsCss(received)).not.toMatch(REMOTE_LOADER);
					expect(nativeStyle(el)).not.toMatch(REMOTE_LOADER);
					expect(received).not.toBe(input);
					expect(received && typeof received === "object").toBe(true);
					expect(Object.getPrototypeOf(received)).toBe(Object.prototype);
					for (const value of Object.values(
						received as Record<string, unknown>,
					)) {
						expect(typeof value).toBe("string");
					}
				},
			),
			{ numRuns: 16, seed: 1 },
		);
	});

	it("gives an own style setter null entries as null and numbers as strings", () => {
		styleSeen.length = 0;
		mount("x-style-sink", {
			style: {
				color: "red",
				opacity: null,
				lineHeight: 0,
				missing: undefined,
			},
		});
		const received = styleSeen[0] as Record<string, unknown>;
		expect(received).toEqual({
			color: "red",
			opacity: null,
			lineHeight: "0",
		});
		expect(received.opacity).toBeNull();
		expect(received.lineHeight).toBe("0");
		expect("missing" in received).toBe(false);

		let reads = 0;
		const style: Record<string, unknown> = { color: "red" };
		Object.defineProperty(style, "opacity", {
			configurable: true,
			enumerable: true,
			get() {
				reads += 1;
				return reads === 1 ? null : "url(https://evil.example/second)";
			},
		});
		styleSeen.length = 0;
		const flipped = mount("x-style-sink", { style }).querySelector(
			"x-style-sink",
		) as HTMLElement;
		expect(reads).toBe(1);
		expect((styleSeen[0] as { opacity: unknown }).opacity).toBeNull();
		expect(styleAsCss(styleSeen[0])).not.toMatch(REMOTE_LOADER);
		expect(nativeStyle(flipped)).not.toMatch(REMOTE_LOADER);
	});

	it("drops a style entry whose key and value join into a loader", () => {
		const key = "background:u/*";
		const value = "*/rl(https://evil.example/x)";
		styleSeen.length = 0;
		const painted = mount("x-style-sink", {
			style: { color: "red", [key]: value },
		}).querySelector("x-style-sink") as HTMLElement;
		const received = styleSeen[0] as Record<string, unknown>;
		expect(received).toEqual({ color: "red" });
		expect(key in received).toBe(false);
		expect(styleAsCss(received).replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(
			REMOTE_LOADER,
		);
		expect(nativeStyle(painted)).not.toMatch(REMOTE_LOADER);

		const loaders = [
			"url(https://evil.example/x)",
			"url(//evil.example/x)",
			"@import 'https://evil.example/a.css'",
			"image-set(url(https://evil.example/x) 1x)",
			"-webkit-image-set(url(https://evil.example/x) 1x)",
			"expression(alert(1))",
			"-moz-binding:url(https://evil.example/x)",
		];
		fc.assert(
			fc.property(
				fc.constantFrom(...loaders),
				fc.integer({ min: 1, max: 20 }),
				(loader, cut) => {
					const at = (cut % (loader.length - 1)) + 1;
					const splitKey = `prop:${loader.slice(0, at)}/*`;
					const splitValue = `*/${loader.slice(at)}`;
					styleSeen.length = 0;
					const el = mount("x-style-sink", {
						style: { color: "red", [splitKey]: splitValue },
					}).querySelector("x-style-sink") as HTMLElement;
					const next = styleSeen[0] as Record<string, unknown>;
					expect(splitKey in next).toBe(false);
					expect(styleAsCss(next).replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(
						REMOTE_LOADER,
					);
					expect(nativeStyle(el)).not.toMatch(REMOTE_LOADER);
					expect(next.color).toBe("red");
				},
			),
			{ numRuns: 14, seed: 1 },
		);
	});

	it("passes null through to a custom style setter", () => {
		styleSeen.length = 0;
		mount("x-style-sink", { style: null });
		expect(styleSeen).toEqual([null]);
		expect(styleSeen[0]).toBeNull();

		const host = document.createElement("div");
		document.body.append(host);
		const first = renderIgniteJsx(
			host,
			jsx("x-style-sink", { style: { color: "red" } }),
		);
		expect(styleSeen[styleSeen.length - 1]).toEqual({ color: "red" });
		styleSeen.length = 0;
		renderIgniteJsx(host, jsx("x-style-sink", { style: null }), first);
		expect(styleSeen).toEqual([null]);
		expect(styleSeen[0]).toBeNull();
	});

	it("drops style-object keys that carry a loader", () => {
		styleSeen.length = 0;
		const painted = mount("x-style-sink", {
			style: {
				color: "blue",
				"background:url(https://evil.example/x);color": "red",
				"a\\75": "red",
			},
		}).querySelector("x-style-sink") as HTMLElement;
		expect(styleSeen[0]).toEqual({ color: "blue" });
		expect(styleAsCss(styleSeen[0])).not.toMatch(REMOTE_LOADER);
		expect(styleAsCss(styleSeen[0])).not.toContain("\\");
		expect(nativeStyle(painted)).not.toMatch(REMOTE_LOADER);
		const safeNames = ["color", "margin", "opacity"];
		const loaderNames = [
			"background:url(https://evil.example/x);color",
			"url(https://evil.example/a)",
			"image-set(url(https://evil.example/a) 1x)",
			"-webkit-image-set(url(https://evil.example/a) 1x)",
			"@import 'https://evil.example/a.css'",
			"expression(alert(1))",
			"-moz-binding:url(https://evil.example/a)",
			"a\\75rl(https://evil.example/a)",
		];
		fc.assert(
			fc.property(
				fc.uniqueArray(
					fc.record({
						key: fc.oneof(
							fc.constantFrom(...safeNames),
							fc.constantFrom(...loaderNames),
							fc.string({ maxLength: 20 }),
						),
						value: fc.constantFrom("red", "1px", "none", "blue"),
					}),
					{ maxLength: 4, selector: (entry) => entry.key },
				),
				(fields) => {
					const style: Record<string, string> = {};
					for (const field of fields) style[field.key] = field.value;
					styleSeen.length = 0;
					const el = mount("x-style-sink", { style }).querySelector(
						"x-style-sink",
					) as HTMLElement;
					const received = styleSeen[0];
					expect(styleAsCss(received)).not.toMatch(REMOTE_LOADER);
					expect(styleAsCss(received)).not.toContain("\\");
					expect(nativeStyle(el)).not.toMatch(REMOTE_LOADER);
					if (received && typeof received === "object") {
						for (const key of Object.keys(received)) {
							expect(cssValueForStyle(key)).not.toBe(false);
						}
					}
				},
			),
			{ numRuns: 16, seed: 1 },
		);
	});

	it("does not write a Chromium onsearch handler", () => {
		fc.assert(
			fc.property(
				fc.constantFrom(
					"onsearch",
					"ONSEARCH",
					"OnSearch",
					"onSearch",
					"oNsEaRcH",
				),
				(key) => {
					expect(isHandlerKey(key)).toBe(true);
					const props: Record<string, unknown> = { type: "search" };
					props[key] = "alert(1)";
					const input = mount("input", props).querySelector("input");
					expect(input?.getAttribute("onsearch")).toBeNull();
					expect(input?.hasAttribute(key)).toBe(false);
					expect(safeSpread(props)[key]).toBeUndefined();
				},
			),
			{ numRuns: 5, seed: 1 },
		);
		expect(safeSpread({ one: "yes", ONSEARCH: "alert(1)" }).one).toBe("yes");
	});

	it("treats every standard handler name as a handler", () => {
		// WHATWG GlobalEventHandlers from html.spec.whatwg.org on 2026-10-23,
		// plus animationend, transitionend, selectstart, command, and pagereveal.
		const names = [
			"abort",
			"auxclick",
			"beforeinput",
			"beforematch",
			"beforetoggle",
			"blur",
			"cancel",
			"canplay",
			"canplaythrough",
			"change",
			"click",
			"close",
			"command",
			"contextlost",
			"contextmenu",
			"contextrestored",
			"copy",
			"cuechange",
			"cut",
			"dblclick",
			"drag",
			"dragend",
			"dragenter",
			"dragleave",
			"dragover",
			"dragstart",
			"drop",
			"durationchange",
			"emptied",
			"ended",
			"error",
			"focus",
			"formdata",
			"input",
			"invalid",
			"keydown",
			"keypress",
			"keyup",
			"load",
			"loadeddata",
			"loadedmetadata",
			"loadstart",
			"mousedown",
			"mouseenter",
			"mouseleave",
			"mousemove",
			"mouseout",
			"mouseover",
			"mouseup",
			"paste",
			"pause",
			"play",
			"playing",
			"progress",
			"ratechange",
			"reset",
			"resize",
			"scroll",
			"scrollend",
			"securitypolicyviolation",
			"seeked",
			"seeking",
			"select",
			"slotchange",
			"stalled",
			"submit",
			"suspend",
			"timeupdate",
			"toggle",
			"volumechange",
			"waiting",
			"webkitanimationend",
			"webkitanimationiteration",
			"webkitanimationstart",
			"webkittransitionend",
			"wheel",
			"animationend",
			"transitionend",
			"selectstart",
			"pagereveal",
		];
		for (const name of names) {
			expect(isHandlerKey(`on${name}`), name).toBe(true);
			expect(isHandlerKey(`ON${name.toUpperCase()}`), name).toBe(true);
		}
		expect(isHandlerKey("one")).toBe(false);
		expect(isHandlerKey("online")).toBe(false);
		expect(isHandlerKey("onlyIcon")).toBe(false);
		for (const name of [
			"animationend",
			"transitionend",
			"selectstart",
			"command",
			"pagereveal",
		]) {
			const key = `on${name}`;
			const props: Record<string, unknown> = { id: "stay" };
			props[key] = "alert(1)";
			expect(safeSpread(props)[key], name).toBeUndefined();
			expect(
				mount("div", props).querySelector("div")?.hasAttribute(key),
				name,
			).toBe(false);
		}
	});

	it("rechecks reflected rel on a prefixed link and a link without relList", () => {
		fc.assert(
			fc.property(
				fc.constantFrom("link", "x:link", "svg:link", "XML:LINK"),
				fc.constantFrom(
					"stylesheet",
					"preload",
					"modulepreload",
					"import",
					"icon",
				),
				(name, rel) => {
					const element = {
						localName: name,
						getAttribute: (key: string) => (key === "rel" ? rel : null),
					} as unknown as Element;
					const blocked = /^(?:stylesheet|preload|modulepreload|import)$/.test(
						rel,
					);
					expect(linkReflectsBlocked(element)).toBe(blocked);
				},
			),
			{ numRuns: 20, seed: 1 },
		);
		const svgLink = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"link",
		);
		svgLink.setAttribute("rel", "modulepreload");
		expect(linkReflectsBlocked(svgLink)).toBe(true);
		for (const rel of ["stylesheet", "preload", "modulepreload", "import"]) {
			let reads = 0;
			const value = {
				toString() {
					reads += 1;
					return reads === 1 ? "icon" : rel;
				},
			};
			const prefixed = mount("x:link", {
				rel: value,
				href: "https://evil.example/a.js",
			});
			const link = prefixed.getElementsByTagName("x:link")[0];
			expect(reads, rel).toBe(1);
			expect(link?.getAttribute("rel"), rel).toBe("icon");
			expect(link?.getAttribute("href"), rel).toContain("evil.example");
		}
		let svgReads = 0;
		const svg = mount("svg", {
			children: jsx("link", {
				rel: {
					toString() {
						svgReads += 1;
						return svgReads === 1 ? "icon" : "modulepreload";
					},
				},
				href: "https://evil.example/a.js",
			}),
		});
		const reflected = svg.getElementsByTagName("link")[0];
		expect(svgReads).toBe(1);
		expect(reflected?.getAttribute("rel")).toBe("icon");
		expect(reflected?.getAttribute("href")).toContain("evil.example");
		expect(
			mount("x:div", {
				rel: "stylesheet",
				href: "https://cdn.example/a.css",
			})
				.getElementsByTagName("x:div")[0]
				?.getAttribute("href"),
		).toContain("cdn.example");
	});

	it("guards imagesrcset and manifest, and omits preload links", () => {
		const icon = mount("link", {
			rel: "icon",
			href: "https://cdn.example/favicon.ico",
			imagesrcset: "https://cdn.example/a.png 1x, //evil.example/b.png 2x",
		}).querySelector("link");
		expect(icon?.getAttribute("imagesrcset")).toBeNull();
		expect(icon?.getAttribute("href")).toContain("favicon.ico");
		expect(
			mount("link", {
				rel: "icon",
				imagesrcset: "https://cdn.example/a.png 1x",
			})
				.querySelector("link")
				?.getAttribute("imagesrcset"),
		).toContain("https://cdn.example/a.png");
		expect(
			mount("html", { manifest: "//evil.example/app.webmanifest" })
				.querySelector("html")
				?.getAttribute("manifest"),
		).toBeNull();
		expect(
			mount("html", { manifest: "https://example.com/app.webmanifest" })
				.querySelector("html")
				?.getAttribute("manifest"),
		).toContain("https://example.com/app.webmanifest");
		expect(
			mount("link", {
				rel: "preload",
				as: "script",
				href: "https://evil.example/a.js",
			}).querySelector("link"),
		).toBeNull();
		expect(
			mount("link", {
				rel: "modulepreload",
				href: "https://evil.example/a.js",
			}).querySelector("link"),
		).toBeNull();
		expect(
			mount("link", {
				rel: "preload",
				as: "style",
				href: "https://evil.example/a.css",
			}).querySelector("link"),
		).toBeNull();
		expect(
			mount("link", {
				rel: "import",
				href: "https://evil.example/a.html",
			}).querySelector("link"),
		).toBeNull();
		expect(
			mount("iframe", { src: "https://evil.example/a.html" })
				.querySelector("iframe")
				?.getAttribute("src"),
		).toBeNull();
		expect(
			mount("frame", { src: "http://evil.example/a.html" })
				.querySelector("frame")
				?.getAttribute("src"),
		).toBeNull();
		expect(
			mount("iframe", { src: "/safe.txt" })
				.querySelector("iframe")
				?.getAttribute("src"),
		).toBe("/safe.txt");
		expect(
			mount("object", { data: "https://evil.example/a.svg" })
				.querySelector("object")
				?.getAttribute("data"),
		).toBeNull();
		expect(
			mount("object", { DATA: "http://evil.example/a.svg" })
				.querySelector("object")
				?.getAttribute("data"),
		).toBeNull();
		expect(
			mount("object", { data: "/same.svg" })
				.querySelector("object")
				?.getAttribute("data"),
		).toBe("/same.svg");
		expect(
			mount("embed", { src: "https://evil.example/a.svg" })
				.querySelector("embed")
				?.getAttribute("src"),
		).toBeNull();
		expect(
			mount("embed", { src: "/same.svg" })
				.querySelector("embed")
				?.getAttribute("src"),
		).toBe("/same.svg");
		expect(
			mount("link", {
				rel: ["icon", "modulepreload"],
				href: "https://evil.example/a.js",
			}).querySelector("link"),
		).toBeNull();
		const keptIcon = mount("link", {
			rel: "icon",
			href: "https://cdn.example/favicon.ico",
		}).querySelector("link");
		expect(keptIcon?.getAttribute("rel")).toBe("icon");
		expect(keptIcon?.getAttribute("href")).toContain("favicon.ico");
		for (const rel of ["prefetch", "dns-prefetch", "preconnect", "prerender"]) {
			const link = mount("link", {
				rel,
				href: "https://cdn.example",
			}).querySelector("link");
			expect(link?.getAttribute("rel"), rel).toBe(rel);
			expect(link?.getAttribute("href"), rel).toContain("cdn.example");
		}
		let relReads = 0;
		const flippingRel = {
			toString() {
				relReads += 1;
				return relReads === 1 ? "icon" : "modulepreload";
			},
		};
		const flipped = mount("link", {
			rel: flippingRel,
			href: "https://evil.example/x.js",
		}).querySelector("link");
		expect(relReads).toBe(1);
		expect(flipped?.getAttribute("rel")).toBe("icon");
		expect(flipped?.getAttribute("href")).toContain("evil.example");
		expect(`${flipped?.getAttribute("rel") ?? ""}`).not.toMatch(
			/modulepreload/i,
		);
		const button = mount("button", {
			onValueChanged: () => undefined,
			children: "x",
		}).querySelector("button");
		expect(button?.getAttribute("onvaluechanged")).toBeNull();
		const handlerHost = document.createElement("div");
		document.body.append(handlerHost);
		const withHandler = renderIgniteJsx(
			handlerHost,
			jsx("button", { onValueChanged: () => undefined, children: "x" }),
		);
		expect(
			handlerHost.querySelector("button")?.getAttribute("onvaluechanged"),
		).toBeNull();
		renderIgniteJsx(handlerHost, jsx("button", { children: "x" }), withHandler);
		expect(
			handlerHost.querySelector("button")?.getAttribute("onvaluechanged"),
		).toBeNull();
		expect(
			mount("div", {
				rel: "stylesheet",
				href: "https://evil.example/a.css",
			}).querySelector("div"),
		).not.toBeNull();
	});

	it("filters declarations inside rules without dropping the sibling rule", () => {
		const face = styleSheetFromChildren([
			{
				kind: "text",
				value:
					"@font-face{unicode-range:U+0-FF;src:url(https://evil.example/a.woff)}",
			},
		]).css;
		expect(face).toContain("unicode-range:U+0-FF");
		expect(face).not.toContain("evil.example");
		expect(face.split("{").length).toBe(face.split("}").length);

		const rules = styleSheetFromChildren([
			{
				kind: "text",
				value: "a{color:red} b{background:url(https://evil.example/a.png)}",
			},
		]).css;
		expect(rules).toContain("a{color:red}");
		expect(rules).not.toContain("evil.example");
		expect(rules).not.toContain("url(");

		const inside = styleSheetFromChildren([
			{
				kind: "text",
				value: "a{color:red;background:url(https://evil.example/a.png)}",
			},
		]).css;
		expect(inside).toContain("color:red");
		expect(inside).not.toContain("evil.example");
		expect(inside.startsWith("a{")).toBe(true);
		expect(inside.endsWith("}")).toBe(true);

		const quoted = styleSheetFromChildren([
			{
				kind: "text",
				value:
					".q{content:'a;b'} .q2{background:url(https://evil.example/a.png)}",
			},
		]).css;
		expect(quoted).toContain(".q{content:'a;b'}");
		expect(quoted).not.toContain("evil.example");
		expect(quoted).not.toBe("");

		const ruleset = styleSheetFromChildren([
			{
				kind: "text",
				value:
					"button:focus-visible{outline:3px solid currentColor}.thumb{width:1rem}",
			},
		]).css;
		expect(ruleset).toBe(
			"button:focus-visible{outline:3px solid currentColor}.thumb{width:1rem}",
		);
		const declarations = styleSheetFromChildren([
			{ kind: "text", value: "a{color:red;background:blue}" },
		]).css;
		expect(declarations).toBe("a{color:red;background:blue}");
		expect(srcsetCandidates("https://cdn.example/a.png,")).toEqual([
			"https://cdn.example/a.png",
		]);
		expect(srcsetCandidates(",,")).toEqual([]);
		expect(
			srcsetCandidates(
				" https://cdn.example/a.png 1x, https://cdn.example/b.png 2x ",
			),
		).toEqual([
			"https://cdn.example/a.png 1x",
			"https://cdn.example/b.png 2x ",
		]);
		const tail = styleSheetFromChildren([
			{
				kind: "text",
				value: "a{background:url(https://evil.example/a.png);color:blue}",
			},
		]).css;
		expect(tail).toBe("a{color:blue}");
		expect(tail).not.toContain("evil.example");

		const sibling = styleSheetFromChildren([
			{
				kind: "text",
				value:
					"@font-face{unicode-range:U+0-FF;src:url(https://evil.example/a.woff)} b{color:red}",
			},
		]).css;
		expect(sibling).toBe("@font-face{unicode-range:U+0-FF} b{color:red}");
		expect(sibling.split("{").length).toBe(sibling.split("}").length);

		const media = styleSheetFromChildren([
			{
				kind: "text",
				value: "@media all{a{background:url(//e)}} b{color:red}",
			},
		]).css;
		expect(media).toBe("@media all{a{}} b{color:red}");
		expect(media.split("{").length).toBe(media.split("}").length);

		const nested = styleSheetFromChildren([
			{
				kind: "text",
				value: "a{ b{background:url(//e)} color:red}",
			},
		]).css;
		expect(nested).toBe("a{ b{} color:red}");
		expect(nested).not.toContain("url");
		expect(nested.split("{").length).toBe(nested.split("}").length);

		expect(
			styleSheetFromChildren([{ kind: "text", value: "a{color:red" }]).css,
		).toBe("a{color:red}");
		expect(
			styleSheetFromChildren([{ kind: "text", value: "a{color:red}}" }]).css,
		).toBe("a{color:red}}");
		expect(
			styleSheetFromChildren([
				{ kind: "text", value: "a{background:url(//e){color:red}" },
			]).css,
		).toBe("a{color:red}}");
	});

	it("pins the renderer guard wiring", () => {
		expect(
			mount("script", { children: "alert(1)" }).querySelector("script"),
		).toBeNull();
		expect(
			mount("script", { src: "https://evil.example/a.js" }).querySelector(
				"script",
			),
		).toBeNull();
		expect(
			mount("link", {
				rel: "stylesheet",
				href: "https://evil.example/a.css",
			}).querySelector("link"),
		).toBeNull();

		expect(
			mount("base", { href: "https://evil.example/" })
				.querySelector("base")
				?.getAttribute("href"),
		).toBeNull();
		expect(
			mount("base", { target: "_blank" })
				.querySelector("base")
				?.getAttribute("target"),
		).toBe("_blank");
		expect(
			mount("a", { href: "https://example.com", children: "x" })
				.querySelector("a")
				?.getAttribute("href"),
		).toContain("https://example.com");

		for (const key of ["to", "from", "by", "values"] as const) {
			const animated = mount("svg", {
				children: jsx("animate", {
					attributeName: "href",
					[key]: "javascript:alert(1)",
				}),
			}).querySelector("animate");
			expect(animated?.getAttribute(key), key).toBeNull();
			expect(
				animated?.getAttribute("attributename") ??
					animated?.getAttribute("attributeName"),
			).toBe("href");
		}
		expect(
			mount("svg", {
				children: jsx("animate", { attributeName: "fill", to: "#fff" }),
			})
				.querySelector("animate")
				?.getAttribute("to"),
		).toBe("#fff");
		expect(
			mount("svg", {
				children: jsx("set", {
					attributeName: "href",
					to: "javascript:alert(1)",
				}),
			})
				.querySelector("set")
				?.getAttribute("to"),
		).toBeNull();

		const widened = mount("object", {
			width: 100,
			data: "/same.svg",
		}).querySelector("object");
		expect(widened?.getAttribute("width")).toBe("100");
		expect(widened?.getAttribute("data")).toBe("/same.svg");
		expect(
			mount("object", { data: "https://evil.example/a.svg" })
				.querySelector("object")
				?.getAttribute("data"),
		).toBeNull();
		expect(
			mount("div", { data: "javascript:alert(1)" })
				.querySelector("div")
				?.getAttribute("data"),
		).toBe("javascript:alert(1)");
		const namedTarget = mount("svg", {
			children: jsx("animate", {
				attributeName: "javascript:alert(1)",
				to: "#fff",
			}),
		}).querySelector("animate");
		expect(namedTarget?.getAttribute("attributeName")).toBe(
			"javascript:alert(1)",
		);
		expect(
			mount("object", { codebase: "javascript:alert(1)" })
				.querySelector("object")
				?.getAttribute("codebase"),
		).toBeNull();
		expect(
			mount("object", { archive: "https://cdn.example/a.jar" })
				.querySelector("object")
				?.getAttribute("archive"),
		).toContain("cdn.example");
		expect(
			mount("object", { classid: "https://cdn.example/a.cls" })
				.querySelector("object")
				?.getAttribute("classid"),
		).toContain("cdn.example");
		expect(
			mount("embed", { code: "https://cdn.example/a.swf" })
				.querySelector("embed")
				?.getAttribute("code"),
		).toContain("cdn.example");
		expect(
			mount("embed", { pluginspage: "https://cdn.example/plugin" })
				.querySelector("embed")
				?.getAttribute("pluginspage"),
		).toContain("cdn.example");
		expect(
			mount("param", { name: "movie", value: "https://cdn.example/a.swf" })
				.querySelector("param")
				?.getAttribute("value"),
		).toContain("cdn.example");

		let hrefReads = 0;
		const flippingHref = {
			toString() {
				hrefReads += 1;
				return hrefReads === 1
					? "https://cdn.example/ok"
					: "javascript:alert(1)";
			},
		};
		expect(
			mount("a", { href: flippingHref, children: "x" })
				.querySelector("a")
				?.getAttribute("href"),
		).toBeNull();
		const flippingName = {
			toString() {
				return "href";
			},
		};
		const named = mount("svg", {
			children: jsx("animate", {
				attributeName: flippingName,
				to: "javascript:alert(1)",
			}),
		}).querySelector("animate");
		expect(
			named?.getAttribute("attributename") ??
				named?.getAttribute("attributeName"),
		).toBeNull();
		expect(named?.getAttribute("to")).toBeNull();

		expect(
			mount("meta", {
				httpEquiv: "refresh",
				content: "0;url=https://evil.example",
			})
				.querySelector("meta")
				?.getAttribute("http-equiv"),
		).toBeNull();
		expect(
			mount("meta", { httpEquiv: "content-type", content: "text/html" })
				.querySelector("meta")
				?.getAttribute("http-equiv"),
		).toBe("content-type");
		expect(
			mount("div", { title: 1, children: "x" })
				.querySelector("div")
				?.getAttribute("title"),
		).toBe("1");
	});
});

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const requireFromElement = createRequire(
	fileURLToPath(
		new URL("../../packages/ignite-element/package.json", import.meta.url),
	),
);
const { JSDOM } = requireFromElement("jsdom");
const elementDist = fileURLToPath(
	new URL("../../packages/ignite-element/dist/", import.meta.url),
);
const rendererDist = fileURLToPath(
	new URL("../../packages/ignite-renderer/dist/", import.meta.url),
);

let installedWindow;
function installDom() {
	if (installedWindow) return installedWindow;
	const dom = new JSDOM("<!DOCTYPE html><body></body>", {
		url: "https://example.test/",
	});
	const { window } = dom;
	const skip = new Set(["process", "console", "Buffer"]);
	for (const name of Object.getOwnPropertyNames(window)) {
		if (skip.has(name)) continue;
		try {
			globalThis[name] = window[name];
		} catch {
			// Node owns a few names. The renderer only needs the DOM ones.
		}
	}
	installedWindow = window;
	return window;
}

describe("published trustedStyle registry", () => {
	it("keeps one registry for ignite-element/jsx and igniteCore", async () => {
		const window = installDom();
		const seen = [];
		class StyleSink extends window.HTMLElement {}
		Object.defineProperty(StyleSink.prototype, "style", {
			configurable: true,
			set(value) {
				seen.push(value);
			},
		});
		window.customElements.define("x-dist-style-sink", StyleSink);

		const jsxApi = await import(
			pathToFileURL(`${elementDist}jsx/index.es.js`).href
		);
		const coreApi = await import(
			pathToFileURL(`${elementDist}ignite-element.es.js`).href
		);
		const { jsx, trustedStyle } = jsxApi;
		const register = coreApi.igniteCore();
		const image = "url(https://cdn.example/a.png)";
		const trusted = trustedStyle(image);
		const evil = "background-image: url(https://evil.example/forged.png)";
		const forged = Object.freeze({
			[Symbol.for("ignite-element.trustedStyle")]: evil,
		});

		register("x-dist-setter", () =>
			jsx("x-dist-style-sink", {
				style: { color: "red", backgroundImage: trusted },
			}),
		);
		register("x-dist-plain", () =>
			jsx("div", {
				style: { color: "red", backgroundImage: trusted },
			}),
		);
		register("x-dist-forged-entry", () =>
			jsx("x-dist-style-sink", {
				style: { color: "red", backgroundImage: forged },
			}),
		);
		register("x-dist-forged-whole", () => jsx("div", { style: forged }));
		register("x-dist-forged-child", () => jsx("style", { children: forged }));

		const mount = (tag) => {
			const host = document.createElement(tag);
			document.body.append(host);
			return host.shadowRoot;
		};

		mount("x-dist-setter");
		assert.deepEqual(seen[0], { color: "red", backgroundImage: image });

		const plain = mount("x-dist-plain");
		const div = plain.querySelector("div");
		assert.equal(div.style.color, "red");
		assert.match(div.style.backgroundImage, /cdn\.example/);

		seen.length = 0;
		mount("x-dist-forged-entry");
		assert.deepEqual(seen[0], { color: "red" });

		const whole = mount("x-dist-forged-whole");
		const wholeDiv = whole.querySelector("div");
		assert.equal(
			wholeDiv.style.backgroundImage.includes("evil.example"),
			false,
		);
		assert.equal(wholeDiv.style.cssText.includes("evil.example"), false);

		const child = mount("x-dist-forged-child");
		const style = child.querySelector("style");
		assert.equal((style?.textContent ?? "").includes("evil.example"), false);
		assert.equal(child.querySelector("img"), null);
	});

	it("drops trustedStyle from @ignite-element/renderer and warns in dev", async () => {
		const window = installDom();
		const seen = [];
		const warnings = [];
		const previousWarn = console.warn;
		console.warn = (...args) => {
			warnings.push(args.map((part) => String(part)).join(" "));
		};
		try {
			class StyleSink extends window.HTMLElement {}
			Object.defineProperty(StyleSink.prototype, "style", {
				configurable: true,
				set(value) {
					seen.push(value);
				},
			});
			window.customElements.define("x-dist-foreign-sink", StyleSink);

			const rendererJsx = await import(
				pathToFileURL(`${rendererDist}jsx.es.js`).href
			);
			const elementDev = await import(
				pathToFileURL(`${elementDist}jsx/index.development.es.js`).href
			);
			const coreDev = await import(
				pathToFileURL(`${elementDist}ignite-element.development.es.js`).href
			);
			const foreign = rendererJsx.trustedStyle(
				"url(https://evil.example/renderer.png)",
			);
			const register = coreDev.igniteCore();
			const { jsx } = elementDev;
			register("x-dist-foreign-setter", () =>
				jsx("x-dist-foreign-sink", {
					style: { color: "red", backgroundImage: foreign },
				}),
			);
			register("x-dist-foreign-plain", () =>
				jsx("div", {
					style: { color: "red", backgroundImage: foreign },
				}),
			);
			register("x-dist-foreign-proxy", () =>
				jsx("div", {
					style: new Proxy(foreign, {
						get() {
							throw new TypeError("lying style");
						},
					}),
				}),
			);

			const mount = (tag) => {
				const host = document.createElement(tag);
				document.body.append(host);
				return host.shadowRoot;
			};

			mount("x-dist-foreign-setter");
			assert.deepEqual(seen[0], { color: "red" });
			assert.equal(
				warnings.some((line) => line.includes("ignite-element/jsx")),
				true,
			);

			const plain = mount("x-dist-foreign-plain");
			const div = plain.querySelector("div");
			assert.equal(div.style.backgroundImage.includes("evil.example"), false);

			const proxied = mount("x-dist-foreign-proxy");
			const proxyDiv = proxied.querySelector("div");
			assert.equal(proxyDiv.style.cssText.includes("evil.example"), false);
		} finally {
			console.warn = previousWarn;
		}
	});
});

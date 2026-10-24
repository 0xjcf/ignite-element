import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

describe("published author-style registry", () => {
	it("keeps a compiler mark in the packed element build and fails closed otherwise", async () => {
		installDom();
		const banned = [
			"trustedStyle",
			"safeUrl",
			"safeSpread",
			"igniteAuthorStyle",
		];
		const elementJsx = await import(
			pathToFileURL(`${elementDist}jsx/index.es.js`).href
		);
		const rendererJsx = await import(
			pathToFileURL(`${rendererDist}jsx.es.js`).href
		);
		const rendererIndex = await import(
			pathToFileURL(`${rendererDist}jsx/index.es.js`).href
		);
		for (const entry of [elementJsx, rendererJsx, rendererIndex]) {
			for (const name of banned) {
				assert.equal(Object.hasOwn(entry, name), false, name);
			}
		}

		const author = await import(
			pathToFileURL(`${rendererDist}jsx/author-style-mark.es.js`).href
		);
		assert.equal(typeof author.igniteAuthorStyle, "function");
		const { igniteAuthorStyle } = author;
		const coreApi = await import(
			pathToFileURL(`${elementDist}ignite-element.es.js`).href
		);
		const { jsx } = elementJsx;
		const register = coreApi.igniteCore();
		const image = ".a{background:url(https://cdn.example/a.png)}";
		const marked = igniteAuthorStyle(image);
		const evil = "body{background:url(https://evil.example/forged.png)}";
		const forged = Object.freeze({
			[Symbol.for("ignite-element.authorStyle")]: evil,
		});
		const lying = new Proxy(marked, {
			get() {
				throw new TypeError("lying style");
			},
		});
		const copyDir = mkdtempSync(join(tmpdir(), "ignite-author-"));
		const copyPath = join(copyDir, "author-style.mjs");
		copyFileSync(`${rendererDist}jsx/author-style-mark.es.js`, copyPath);
		const second = await import(pathToFileURL(copyPath).href);
		const other = second.igniteAuthorStyle(
			"body{background:url(https://cdn.example/other.png)}",
		);

		register("x-dist-marked", () => jsx("style", { children: marked }));
		register("x-dist-attr", () =>
			jsx("div", { style: { backgroundImage: marked } }),
		);
		register("x-dist-forged", () => jsx("style", { children: forged }));
		register("x-dist-proxy", () => jsx("style", { children: lying }));
		register("x-dist-second", () => jsx("style", { children: other }));

		const mount = (tag) => {
			const host = document.createElement(tag);
			document.body.append(host);
			return host.shadowRoot;
		};

		const markedRoot = mount("x-dist-marked");
		assert.match(
			markedRoot.querySelector("style")?.textContent ?? "",
			/cdn\.example\/a\.png/,
		);
		assert.equal(markedRoot.querySelector("img"), null);

		const attr = mount("x-dist-attr").querySelector("div");
		assert.equal((attr?.style?.cssText ?? "").includes("cdn.example"), false);

		const forgedRoot = mount("x-dist-forged");
		assert.equal(
			(forgedRoot.querySelector("style")?.textContent ?? "").includes(
				"evil.example",
			),
			false,
		);

		const proxyRoot = mount("x-dist-proxy");
		assert.equal(
			(proxyRoot.querySelector("style")?.textContent ?? "").includes(
				"cdn.example",
			),
			false,
		);

		const secondRoot = mount("x-dist-second");
		assert.equal(
			(secondRoot.querySelector("style")?.textContent ?? "").includes(
				"other.png",
			),
			false,
		);
	});
});

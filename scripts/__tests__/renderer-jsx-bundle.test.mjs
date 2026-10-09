import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { build } from "vite";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const jsxBundle = path.join(
	repoRoot,
	"packages/ignite-renderer/dist/jsx.es.js",
);
const browserImportHelper = path.join(
	repoRoot,
	"scripts/__tests__/helpers/import-jsx-dist-without-process.mjs",
);

const DUPLICATE_KEY =
	'[ignite-jsx] Duplicate key "dup" among siblings. Keys must be unique.';
const INNER_HTML =
	"[ignite-jsx] `innerHTML` is deprecated and will be removed in the next major release. Use JSX children for text, and hosts for trusted rich content.";
const TEXT_CONTENT =
	"[ignite-jsx] `textContent` is deprecated and will be removed in the next major release. Use JSX children for text, and hosts for trusted rich content.";
const WARNING_STRINGS = [
	"Duplicate key",
	"Mixed keyed and unkeyed",
	"requires a single element",
	"is deprecated and will be removed",
];

// Gzip level 9 of this same production consumer entry against the previous
// library build, before dev warnings were left in dist.
const TODAY_CONSUMER_GZIP = 4634;
const FEW_BYTES = 16;

function consumerEntry() {
	return `import { jsx, mountIgniteJsxOnce } from ${JSON.stringify(jsxBundle)};
const warnings = [];
const warn = console.warn.bind(console);
console.warn = (...args) => {
  warnings.push(args.map((part) => String(part)).join(" "));
  warn(...args);
};
const host = document.createElement("div");
mountIgniteJsxOnce(host, jsx("div", { children: [
  jsx("span", { children: "one" }, "dup"),
  jsx("span", { children: "two" }, "dup"),
]}));
mountIgniteJsxOnce(document.createElement("div"), jsx("div", { innerHTML: "<p>rich</p>" }));
mountIgniteJsxOnce(document.createElement("div"), jsx("div", { textContent: "plain" }));
globalThis.__igniteWarnings = warnings;
globalThis.__igniteText = host.textContent;
`;
}

async function bundleConsumer(mode, format) {
	const root = mkdtempSync(path.join(tmpdir(), "ignite-jsx-consumer-"));
	const entry = path.join(root, "main.js");
	writeFileSync(entry, consumerEntry());
	try {
		const result = await build({
			configFile: false,
			define: {
				"process.env.NODE_ENV": JSON.stringify(mode),
				"global.process.env.NODE_ENV": JSON.stringify(mode),
				"globalThis.process.env.NODE_ENV": JSON.stringify(mode),
			},
			logLevel: "silent",
			mode,
			root,
			build: {
				minify: true,
				rollupOptions: {
					input: entry,
					output: { format, inlineDynamicImports: true },
				},
				write: false,
			},
		});
		const outputs = (Array.isArray(result) ? result : [result]).flatMap(
			(item) => item.output ?? [],
		);
		return outputs
			.filter((output) => output.type === "chunk")
			.map((output) => output.code)
			.join("\n");
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
}

function runInBrowser(code) {
	const { createRequire } = process.getBuiltinModule("node:module");
	const require = createRequire(
		new URL("../../packages/ignite-element/package.json", import.meta.url),
	);
	const { JSDOM } = require("jsdom");
	const dom = new JSDOM("<!DOCTYPE html><body></body>", {
		runScripts: "dangerously",
		url: "https://example.test/",
	});
	assert.equal("process" in dom.window, false);
	const originalWarn = console.warn;
	try {
		dom.window.eval(code);
		return {
			text: dom.window.__igniteText,
			warnings: dom.window.__igniteWarnings,
		};
	} finally {
		console.warn = originalWarn;
	}
}

describe("published renderer jsx bundle", { concurrency: false }, () => {
	it("keeps the dev warning check for the consumer bundler to strip", () => {
		const source = readFileSync(jsxBundle, "utf8");
		assert.match(
			source,
			/globalThis\.process\?\.env\?\.NODE_ENV\s*!==\s*"production"/,
		);
		for (const warning of WARNING_STRINGS) {
			assert.equal(source.includes(warning), true, warning);
		}
	});

	it("strips warning strings from a Vite production build", async () => {
		const code = await bundleConsumer("production", "es");
		for (const warning of WARNING_STRINGS) {
			assert.equal(code.includes(warning), false, warning);
		}
		const gzipBytes = gzipSync(Buffer.from(code), { level: 9 }).byteLength;
		assert.ok(
			Math.abs(gzipBytes - TODAY_CONSUMER_GZIP) <= FEW_BYTES,
			`consumer gzip ${gzipBytes} is not within ${FEW_BYTES} bytes of ${TODAY_CONSUMER_GZIP}`,
		);
	});

	it("shows duplicate-key and deprecated content warnings in a Vite dev build", async () => {
		const code = await bundleConsumer("development", "iife");
		const result = runInBrowser(code);
		assert.equal(result.text, "onetwo");
		assert.ok(result.warnings.includes(DUPLICATE_KEY));
		assert.ok(result.warnings.includes(INNER_HTML));
		assert.ok(result.warnings.includes(TEXT_CONTENT));
	});

	it("imports dist in a browser realm without process", () => {
		const result = spawnSync(
			process.execPath,
			["--experimental-vm-modules", browserImportHelper, jsxBundle],
			{ encoding: "utf8" },
		);
		assert.equal(result.status, 0, result.stderr || result.stdout);
		const parsed = JSON.parse(result.stdout);
		assert.equal(parsed.text, "onetwo");
		assert.ok(parsed.warnings.includes(DUPLICATE_KEY), result.stdout);
		assert.ok(parsed.warnings.includes(INNER_HTML));
		assert.ok(parsed.warnings.includes(TEXT_CONTENT));
	});
});

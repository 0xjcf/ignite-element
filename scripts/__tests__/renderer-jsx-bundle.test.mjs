import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { build } from "vite";

const requireFromRoot = createRequire(
	fileURLToPath(new URL("../../package.json", import.meta.url)),
);
const requireFromVite = createRequire(
	realpathSync(
		fileURLToPath(
			new URL("../../node_modules/vite/package.json", import.meta.url),
		),
	),
);
const esbuild = requireFromVite("esbuild");
const rollup = requireFromVite("rollup");
const nodeResolve = requireFromRoot("@rollup/plugin-node-resolve");
const webpack = requireFromRoot("webpack");

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const rendererDist = path.join(repoRoot, "packages/ignite-renderer/dist");
const elementDist = path.join(repoRoot, "packages/ignite-element/dist");
const jsxBundle = path.join(rendererDist, "jsx.es.js");
const jsxDevBundle = path.join(rendererDist, "jsx.development.es.js");
const elementBundle = path.join(elementDist, "xstate.es.js");
const elementDevBundle = path.join(elementDist, "xstate.development.es.js");
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
	"URL scheme is not allowed",
];
const EVENT_ORIGIN_WARNING = "observed from both native and effect";

// Gzip level 9 of this production consumer entry before dev warnings were
// left for a consumer bundler to strip.
const TODAY_CONSUMER_GZIP = 4634;
const FEW_BYTES = 16;

function consumerEntry() {
	return `import { jsx, mountIgniteJsxOnce } from "@ignite-element/renderer/jsx";
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

function makeRoot(label) {
	// The renderer package is linked from ignite-element's node_modules.
	return mkdtempSync(
		path.join(
			repoRoot,
			"packages/ignite-element",
			`.tmp-jsx-consumer-${label}-`,
		),
	);
}

function readModuleGraph(entryPath) {
	const seen = new Set();
	const pending = [entryPath];
	let source = "";
	while (pending.length > 0) {
		const file = pending.pop();
		if (!file || seen.has(file)) continue;
		seen.add(file);
		const text = readFileSync(file, "utf8");
		source += `\n${text}`;
		for (const match of text.matchAll(/from\s*["'](\.\/[^"']+)["']/g)) {
			pending.push(path.resolve(path.dirname(file), match[1]));
		}
	}
	return source;
}

function assertProductionBundle(code, label) {
	for (const warning of WARNING_STRINGS) {
		assert.equal(code.includes(warning), false, `${label}: ${warning}`);
	}
	const index = code.indexOf("process");
	assert.equal(
		index,
		-1,
		`${label} still contains process near: ${code.slice(Math.max(0, index - 80), index + 80)}`,
	);
	assert.equal(
		code.includes("ignite-jsx-root"),
		true,
		`${label} did not bundle the renderer`,
	);
}

function assertDevWarnings(result, label) {
	assert.equal(result.processType, "undefined", label);
	assert.equal(result.text, "onetwo", label);
	assert.ok(result.warnings.includes(DUPLICATE_KEY), label);
	assert.ok(result.warnings.includes(INNER_HTML), label);
	assert.ok(result.warnings.includes(TEXT_CONTENT), label);
}

function runInDomWithoutProcess(code) {
	const { createRequire: requireJsdom } =
		process.getBuiltinModule("node:module");
	const require = requireJsdom(
		new URL("../../packages/ignite-element/package.json", import.meta.url),
	);
	const { JSDOM } = require("jsdom");
	const dom = new JSDOM("<!DOCTYPE html><body></body>", {
		runScripts: "dangerously",
		url: "https://example.test/",
	});
	const { window } = dom;
	Reflect.deleteProperty(window, "process");
	const processType = window.eval("typeof process");
	window.eval(code);
	return {
		processType,
		text: window.__igniteText,
		warnings: window.__igniteWarnings,
	};
}

async function bundleWithVite(mode, format) {
	const root = makeRoot("vite");
	const entry = path.join(root, "main.js");
	writeFileSync(entry, consumerEntry());
	const previousNodeEnv = process.env.NODE_ENV;
	process.env.NODE_ENV = mode;
	try {
		const result = await build({
			configFile: false,
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
		if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
		else process.env.NODE_ENV = previousNodeEnv;
		rmSync(root, { force: true, recursive: true });
	}
}

async function bundleWithRollup(exportConditions, format) {
	const root = makeRoot("rollup");
	const entry = path.join(root, "main.js");
	writeFileSync(entry, consumerEntry());
	try {
		const bundle = await rollup.rollup({
			input: entry,
			plugins: [nodeResolve({ exportConditions })],
		});
		try {
			const generated = await bundle.generate({
				format,
				inlineDynamicImports: true,
			});
			return generated.output.map((output) => output.code ?? "").join("\n");
		} finally {
			await bundle.close();
		}
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
}

function bundleWithWebpack(mode) {
	const root = makeRoot("webpack");
	const entry = path.join(root, "main.js");
	const outfile = path.join(root, "out.js");
	writeFileSync(entry, consumerEntry());
	return new Promise((resolve, reject) => {
		const compiler = webpack({
			mode,
			entry,
			target: "web",
			output: { iife: true, path: root, filename: "out.js" },
			performance: { hints: false },
		});
		compiler.run((error, stats) => {
			if (error) {
				compiler.close(() => reject(error));
				return;
			}
			if (stats?.hasErrors()) {
				compiler.close(() =>
					reject(new Error(stats.toString({ errors: true }))),
				);
				return;
			}
			const code = readFileSync(outfile, "utf8");
			compiler.close((closeError) => {
				rmSync(root, { force: true, recursive: true });
				if (closeError) reject(closeError);
				else resolve(code);
			});
		});
	});
}

async function bundleWithEsbuild(conditions) {
	const root = makeRoot("esbuild");
	const entry = path.join(root, "main.js");
	writeFileSync(entry, consumerEntry());
	try {
		const result = await esbuild.build({
			absWorkingDir: repoRoot,
			bundle: true,
			conditions,
			entryPoints: [entry],
			format: conditions.includes("development") ? "iife" : "esm",
			logLevel: "silent",
			minify: true,
			platform: "browser",
			write: false,
		});
		return result.outputFiles.map((file) => file.text).join("\n");
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
}

describe("published renderer jsx bundle", { concurrency: false }, () => {
	it("publishes a development build and a process-free production build", () => {
		assert.equal(existsSync(jsxDevBundle), true, jsxDevBundle);
		assert.equal(existsSync(elementDevBundle), true, elementDevBundle);
		const production = readFileSync(jsxBundle, "utf8");
		const development = readFileSync(jsxDevBundle, "utf8");
		assertProductionBundle(production, "published jsx");
		for (const warning of WARNING_STRINGS) {
			assert.equal(development.includes(warning), true, warning);
		}
		assert.equal(development.includes("typeof process"), false);
		const elementProduction = readModuleGraph(elementBundle);
		const elementDevelopment = readModuleGraph(elementDevBundle);
		assert.equal(elementProduction.includes("process"), false);
		assert.equal(elementProduction.includes(EVENT_ORIGIN_WARNING), false);
		assert.equal(elementProduction.includes("Unknown host"), false);
		assert.equal(elementDevelopment.includes(EVENT_ORIGIN_WARNING), true);
		assert.equal(elementDevelopment.includes("Unknown host"), true);
		assert.equal(elementDevelopment.includes("typeof process"), false);
	});

	it("strips warning strings and process from a Vite production build", async () => {
		const code = await bundleWithVite("production", "es");
		assertProductionBundle(code, "vite");
		const gzipBytes = gzipSync(Buffer.from(code), { level: 9 }).byteLength;
		assert.ok(
			gzipBytes <= TODAY_CONSUMER_GZIP + FEW_BYTES,
			`consumer gzip ${gzipBytes} is more than ${FEW_BYTES} bytes above ${TODAY_CONSUMER_GZIP}`,
		);
	});

	it("strips warning strings and process from a Rollup production build", async () => {
		const code = await bundleWithRollup(["production"], "es");
		assertProductionBundle(code, "rollup");
	});

	it("strips warning strings and process from a webpack 5 production build", async () => {
		const code = await bundleWithWebpack("production");
		assertProductionBundle(code, "webpack");
	});

	it("strips warning strings and process from an esbuild production build", async () => {
		const code = await bundleWithEsbuild([]);
		assertProductionBundle(code, "esbuild");
	});

	it("shows warnings in a Vite dev build with no process global", async () => {
		const code = await bundleWithVite("development", "iife");
		assertDevWarnings(runInDomWithoutProcess(code), "vite dev");
	});

	it("shows warnings in a webpack development build with no process global", async () => {
		const code = await bundleWithWebpack("development");
		assertDevWarnings(runInDomWithoutProcess(code), "webpack dev");
	});

	it("shows warnings in a Rollup development build with no process global", async () => {
		const code = await bundleWithRollup(["development"], "iife");
		assertDevWarnings(runInDomWithoutProcess(code), "rollup dev");
	});

	it("shows warnings in an esbuild development build with no process global", async () => {
		const code = await bundleWithEsbuild(["development"]);
		assertDevWarnings(runInDomWithoutProcess(code), "esbuild dev");
	});

	it("resolves a default import to the production build and does not throw", () => {
		const resolved = pathToFileURL(
			createRequire(
				path.join(repoRoot, "packages/ignite-element/package.json"),
			).resolve("@ignite-element/renderer/jsx"),
		).href;
		assert.match(resolved, /\/jsx\.es\.js$/);
		assert.doesNotMatch(resolved, /development/);
		const result = spawnSync(
			process.execPath,
			[
				"--experimental-vm-modules",
				browserImportHelper,
				fileURLToPath(resolved),
			],
			{ encoding: "utf8", env: { ...process.env, NODE_ENV: "production" } },
		);
		assert.equal(result.status, 0, result.stderr || result.stdout);
		const parsed = JSON.parse(result.stdout);
		assert.equal(parsed.processType, "undefined");
		assert.equal(parsed.text, "onetwo");
		assert.deepEqual(parsed.warnings, []);
	});
});

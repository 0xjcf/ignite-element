import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const packageJson = JSON.parse(
	readFileSync(new URL("./../package.json", import.meta.url), "utf8"),
);

const expectedPublicSubpaths = [
	".",
	"./xstate",
	"./redux",
	"./mobx",
	"./actor-web",
	"./jsx",
	"./jsx/jsx-runtime",
	"./jsx/jsx-dev-runtime",
	"./react",
	"./package.json",
];

const expectedTypesVersions = [
	"xstate",
	"redux",
	"mobx",
	"actor-web",
	"jsx",
	"jsx/jsx-runtime",
	"jsx/jsx-dev-runtime",
	"react",
];

const removedStableSubpaths = [
	"./config/vite",
	"./config/webpack",
	"./config/loadIgniteConfig",
	"./renderers/ignite-jsx",
	"./renderers/lit",
];

const requiredExports = [
	[".", { StateScope: "object", event: "function", test: "function" }],
	[
		"./xstate",
		{ igniteCore: "function", matchState: "function", test: "function" },
	],
	["./redux", { igniteCore: "function", test: "function" }],
	["./mobx", { igniteCore: "function", test: "function" }],
	["./actor-web", { igniteCore: "function", test: "function" }],
	[
		"./jsx",
		{
			Fragment: "symbol",
			jsx: "function",
			jsxDEV: "function",
			jsxs: "function",
		},
	],
	[
		"./jsx/jsx-runtime",
		{ Fragment: "symbol", jsx: "function", jsxs: "function" },
	],
	["./jsx/jsx-dev-runtime", { Fragment: "symbol", jsxDEV: "function" }],
	["./react", { igniteReact: "function" }],
];

const recursiveImportPattern =
	/(?:from|import)\s+["'](\.\/[^"']+)["']|require\(["'](\.\/[^"']+)["']\)/g;

function assertDistGraphDoesNotReference(entryFile, forbiddenMarkers) {
	const pending = [entryFile];
	const seen = new Set();

	while (pending.length > 0) {
		const nextFile = pending.pop();
		if (!nextFile || seen.has(nextFile)) {
			continue;
		}

		seen.add(nextFile);
		const fileUrl = new URL(`./../dist/${nextFile}`, import.meta.url);
		assert.ok(existsSync(fileUrl), `Missing built artifact: dist/${nextFile}.`);
		const source = readFileSync(fileUrl, "utf8");

		for (const marker of forbiddenMarkers) {
			assert.ok(
				!source.includes(marker),
				`Expected dist/${nextFile} to avoid ${marker}.`,
			);
		}

		for (const match of source.matchAll(recursiveImportPattern)) {
			const relativeImport = match[1] ?? match[2];
			if (!relativeImport) {
				continue;
			}

			const resolved = path.posix.normalize(
				path.posix.join(path.posix.dirname(nextFile), relativeImport),
			);
			pending.push(resolved);
		}
	}
}

async function assertSubpathIsNotExported(subpath) {
	const specifier = `${packageJson.name}/${subpath.slice(2)}`;
	try {
		await import(specifier);
		assert.fail(`Expected ${specifier} to be blocked by package exports.`);
	} catch (error) {
		assert.equal(
			error?.code,
			"ERR_PACKAGE_PATH_NOT_EXPORTED",
			`Expected ${specifier} to be hidden from the stable public API.`,
		);
	}
}

assert.deepEqual(
	Object.keys(packageJson.exports).sort(),
	[...expectedPublicSubpaths].sort(),
	"package.json exports should match the stable public allowlist exactly.",
);

assert.deepEqual(
	Object.keys(packageJson.typesVersions["*"]).sort(),
	[...expectedTypesVersions].sort(),
	"typesVersions should match the stable public allowlist exactly.",
);

for (const [subpath, expectedExports] of requiredExports) {
	const exportEntry = packageJson.exports[subpath];
	assert.ok(exportEntry, `Missing package export for ${subpath}.`);
	assert.equal(
		typeof exportEntry.types,
		"string",
		`Missing types export for ${subpath}.`,
	);
	assert.ok(
		existsSync(new URL(`./../${exportEntry.types}`, import.meta.url)),
		`Missing built types file for ${subpath}: ${exportEntry.types}.`,
	);

	const specifier =
		subpath === "."
			? packageJson.name
			: `${packageJson.name}/${subpath.slice(2)}`;
	const module = await import(specifier);

	assert.deepEqual(
		Object.keys(module).sort(),
		Object.keys(expectedExports).sort(),
		`Unexpected runtime exports leaked from ${specifier}.`,
	);

	for (const [expectedName, expectedType] of Object.entries(expectedExports)) {
		assert.equal(
			typeof module[expectedName],
			expectedType,
			`Expected ${specifier} to export ${expectedName}.`,
		);
	}
}

for (const subpath of removedStableSubpaths) {
	assert.ok(
		!(subpath in packageJson.exports),
		`Removed stable subpath still appears in package exports: ${subpath}.`,
	);
	assert.ok(
		!(subpath.slice(2) in packageJson.typesVersions["*"]),
		`Removed stable subpath still appears in typesVersions: ${subpath}.`,
	);
	await assertSubpathIsNotExported(subpath);
}

assertDistGraphDoesNotReference("xstate.es.js", ["mobx", "@reduxjs/toolkit"]);
assertDistGraphDoesNotReference("xstate.cjs.js", ["mobx", "@reduxjs/toolkit"]);
assertDistGraphDoesNotReference("redux.es.js", ['"mobx"', '"xstate"']);
assertDistGraphDoesNotReference("redux.cjs.js", ['"mobx"', '"xstate"']);
assertDistGraphDoesNotReference("mobx.es.js", ['"xstate"', "@reduxjs/toolkit"]);
assertDistGraphDoesNotReference("mobx.cjs.js", [
	'"xstate"',
	"@reduxjs/toolkit",
]);
assertDistGraphDoesNotReference("actor-web.es.js", [
	'"xstate"',
	"@reduxjs/toolkit",
	'"mobx"',
]);
assertDistGraphDoesNotReference("actor-web.cjs.js", [
	'"xstate"',
	"@reduxjs/toolkit",
	'"mobx"',
]);

// The DOM polyfill (src/internal/setupDomPolyfill.ts) is the package's only
// module-level side effect. `sideEffects` must allowlist every dist chunk that
// carries it, or a tree-shaking bundler will drop it and break bundled
// SSR/Node consumers. Chunk hashes change per build, so match by glob and
// assert here that the globs still cover wherever Rollup placed the polyfill.
const polyfillMarker = /typeof\s*[\w$]+\.HTMLElement\s*>\s*"u"/;

function sideEffectGlobToRegExp(glob) {
	const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`^${escaped.replaceAll("*", "[^/]*")}$`);
}

const sideEffectPatterns = (packageJson.sideEffects ?? []).map(
	sideEffectGlobToRegExp,
);
assert.ok(
	sideEffectPatterns.length > 0,
	"package.json must declare a sideEffects allowlist for the DOM polyfill.",
);

const distDir = new URL("./../dist/", import.meta.url);
const polyfillChunks = readdirSync(distDir, { recursive: true })
	.map((entry) => `./dist/${String(entry).split(path.sep).join("/")}`)
	.filter((entry) => /\.(js|cjs)$/.test(entry))
	.filter((entry) =>
		polyfillMarker.test(
			readFileSync(new URL(`.${entry}`, import.meta.url), "utf8"),
		),
	);

assert.ok(
	polyfillChunks.length > 0,
	"Expected the DOM polyfill to be present in at least one dist chunk.",
);
for (const chunk of polyfillChunks) {
	assert.ok(
		sideEffectPatterns.some((pattern) => pattern.test(chunk)),
		`DOM polyfill chunk ${chunk} is not covered by the package.json sideEffects allowlist — a tree-shaking bundler would drop it.`,
	);
}

console.info("[verify:exports] Package exports resolved successfully.");

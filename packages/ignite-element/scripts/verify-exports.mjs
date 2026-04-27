import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const packageJson = JSON.parse(
	readFileSync(new URL("./../package.json", import.meta.url), "utf8"),
);

const requiredExports = [
	[
		".",
		{
			event: "function",
			StateScope: "object",
			test: "function",
		},
	],
	["./xstate", { igniteCore: "function", matchState: "function" }],
	["./redux", { igniteCore: "function" }],
	["./mobx", { igniteCore: "function" }],
	["./actor-web", { igniteCore: "function" }],
	["./config/vite", { igniteConfigVitePlugin: "function" }],
	["./config/webpack", { IgniteConfigWebpackPlugin: "function" }],
	["./config/loadIgniteConfig", { loadIgniteConfig: "function" }],
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

	for (const [expectedName, expectedType] of Object.entries(expectedExports)) {
		assert.equal(
			typeof module[expectedName],
			expectedType,
			`Expected ${specifier} to export ${expectedName}.`,
		);
	}
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

console.info("[verify:exports] Package exports resolved successfully.");

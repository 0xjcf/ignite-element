import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import esbuild from "esbuild";
import fc from "fast-check";
import { rollup } from "rollup";
import { build as viteBuild } from "vite";
import { describe, expect, it } from "vitest";
import igniteEsbuild from "./esbuild.js";
import igniteRollup from "./rollup.js";
import igniteVite from "./vite.js";

// Additional observations for the already reviewed R1/R2/R5 rules.
const profile = { seed: 20261109, numRuns: 8 };

async function fixture(
	files: Record<string, string>,
	check: (dir: string) => Promise<void>,
) {
	const dir = realpathSync(
		mkdtempSync(path.join(tmpdir(), "ignite-review-followup-")),
	);
	try {
		for (const [name, source] of Object.entries(files))
			writeFileSync(path.join(dir, name), source);
		await check(dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

function esbuildApp(dir: string, entry = "entry.cjs") {
	return esbuild.build({
		absWorkingDir: dir,
		entryPoints: [path.join(dir, entry)],
		bundle: true,
		write: false,
		format: "esm",
		platform: "node",
		plugins: [igniteEsbuild()],
		logLevel: "silent",
	});
}

function viteApp(dir: string, entry = "entry.cjs", output?: string) {
	return viteBuild({
		configFile: false,
		logLevel: "silent",
		root: dir,
		plugins: [
			igniteVite(),
			...(output === undefined
				? []
				: [
						{
							name: "later-source-producer",
							enforce: "post" as const,
							transform(_code: string, id: string) {
								return id === path.join(dir, entry) ? output : null;
							},
						},
					]),
		],
		build: { ssr: path.join(dir, entry), write: false, minify: false },
	});
}

async function expectMarkRefusal(builds: Promise<unknown>[]) {
	const results = await Promise.allSettled(builds);
	for (const result of results) {
		expect(result.status).toBe("rejected");
		if (result.status === "rejected")
			expect(String(result.reason)).toMatch(/cannot mark CSS/);
	}
}

describe("reviewed guard follow-up observations", () => {
	it("R1/R2: local wrappers forwarding a Node loader stay guarded", async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.constantFrom(
					"declaration",
					"arrow",
					"expression",
					"alias",
					"default",
				),
				fc.constantFrom("module.require", 'module["require"]'),
				async (form, loader) => {
					const declarations = {
						declaration: `function require(value) { return ${loader}(value); }`,
						arrow: `const require = value => ${loader}(value);`,
						expression: `const require = function(value) { return ${loader}(value); };`,
						alias: `function require(value) { const target = value; return ${loader}(target); }`,
						default: `function require(value = "node:fs") { return ${loader}(value); }`,
					};
					const declaration = declarations[form];
					await fixture(
						{
							"entry.cjs": `${declaration} module.exports = require("./author-style-mark.es.js");`,
							"author-style-mark.es.js":
								"exports.igniteAuthorStyle = css => ({ css });",
						},
						async (dir) => {
							await expectMarkRefusal([esbuildApp(dir), viteApp(dir)]);
						},
					);
				},
			),
			{
				...profile,
				examples: [
					["declaration", "module.require"],
					["arrow", 'module["require"]'],
					["alias", "module.require"],
					["default", 'module["require"]'],
				],
			},
		);
	});

	it("R2: local module-shaped data and unrelated safe loader operations remain ordinary", async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.boolean(),
				fc.boolean(),
				async (localModule, ignoresInput) => {
					const source = localModule
						? 'const module = { require: value => Boolean(value) }; function require(value) { return module.require(value); } export const value = require("author-style-is-data");'
						: 'function require(value) { module.require("node:fs"); return Boolean(value); } module.exports = require("author-style-is-data");';
					const entry = ignoresInput
						? source
								.replace("function require(value)", "function require()")
								.replace("module.require(value)", "module.require(true)")
								.replace("return Boolean(value)", "return true")
						: source;
					await fixture({ "entry.cjs": entry }, async (dir) => {
						await esbuildApp(dir);
						await viteApp(dir);
					});
				},
			),
			{
				...profile,
				examples: [
					[true, false],
					[false, false],
					[true, true],
					[false, true],
				],
			},
		);
	});

	it("R1/R5: angle-bracket assertion targets preserve safe loads and refuse private marks", async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.constantFrom("ts", "mts", "cts"),
				fc.boolean(),
				fc.boolean(),
				async (ext, constant, blocked) => {
					const target = blocked ? "./author-style-mark.es.js" : "./safe.cjs";
					const source = constant
						? `const helper = <string>${JSON.stringify(target)}; export const value = require(helper);`
						: `export const value = require(<string>${JSON.stringify(target)});`;
					await fixture(
						{
							[`entry.${ext}`]: source,
							"safe.cjs": "module.exports = 1;",
							"author-style-mark.es.js":
								"exports.igniteAuthorStyle = css => ({ css });",
						},
						async (dir) => {
							const result = esbuildApp(dir, `entry.${ext}`);
							if (blocked) await expectMarkRefusal([result]);
							else await result;
						},
					);
				},
			),
			{
				...profile,
				examples: [
					["ts", false, false],
					["ts", true, false],
					["mts", false, false],
					["mts", true, false],
					["cts", false, false],
					["cts", true, false],
					["cts", true, true],
				],
			},
		);
	});

	it("R1/R2: later transforms keep real CommonJS loads distinct from ordinary template data", async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.constantFrom(
					"require",
					"module",
					"wrapper",
					"wrapper-alias",
					"wrapper-default",
					"require-const",
					"ordinary-require",
					"ordinary-module",
					"ordinary-call",
					"construct",
				),
				async (form) => {
					const template = `\`./author-style-\${suffix}.es.js\``;
					const outputs = {
						require: `export const load = suffix => require(${template});`,
						module: `export const load = suffix => module.require(${template});`,
						wrapper: `function require(value) { return module.require(value); } export const load = suffix => require(${template});`,
						"wrapper-alias": `function require(value) { const target = value; return module.require(target); } export const load = suffix => require(${template});`,
						"wrapper-default": `function require(value = "node:fs") { return module.require(value); } export const load = suffix => require(${template});`,
						"require-const":
							'const target = "./author-style-mark.es.js"; export const load = () => require(target);',
						"ordinary-require": `const require = value => Boolean(value); export const load = suffix => require(${template});`,
						"ordinary-module": `const module = { require: value => Boolean(value) }; export const load = suffix => module.require(${template});`,
						"ordinary-call": `const ordinary = value => value; export const load = suffix => ordinary(${template});`,
						construct: `export const load = suffix => new Error(${template});`,
					};
					const output = outputs[form];
					await fixture(
						{ "entry.mjs": "export const load = () => null;" },
						async (dir) => {
							const rollupApp = async () => {
								const bundle = await rollup({
									input: path.join(dir, "entry.mjs"),
									plugins: [
										igniteRollup(),
										{
											name: "later-source-producer",
											transform(_code, id) {
												return id === path.join(dir, "entry.mjs")
													? output
													: null;
											},
										},
									],
								});
								try {
									await bundle.generate({ format: "es" });
								} finally {
									await bundle.close();
								}
							};
							const builds = [rollupApp(), viteApp(dir, "entry.mjs", output)];
							if (
								[
									"require",
									"module",
									"wrapper",
									"wrapper-alias",
									"wrapper-default",
									"require-const",
								].includes(form)
							)
								await expectMarkRefusal(builds);
							else await Promise.all(builds);
						},
					);
				},
			),
			{
				...profile,
				examples: [
					["require"],
					["module"],
					["wrapper"],
					["wrapper-alias"],
					["wrapper-default"],
					["require-const"],
					["ordinary-require"],
					["ordinary-module"],
					["ordinary-call"],
					["construct"],
				],
			},
		);
	});
});

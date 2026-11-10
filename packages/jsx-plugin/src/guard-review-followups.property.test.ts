import {
	mkdirSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import esbuild from "esbuild";
import fc from "fast-check";
import { rolldown } from "rolldown";
import { rollup } from "rollup";
import { build as viteBuild } from "vite";
import { describe, expect, it } from "vitest";
import { parse } from "@babel/parser";
import { moduleLoadSources } from "./transform.js";
import igniteEsbuild from "./esbuild.js";
import igniteRolldown from "./rolldown.js";
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
		for (const [name, source] of Object.entries(files)) {
			mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
			writeFileSync(path.join(dir, name), source);
		}
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
	it("R1/R2: dependency wrappers retain dynamic loading but reject known private targets", async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.constantFrom("module.require", "import"),
				fc.constantFrom("direct", "alias", "default"),
				fc.constantFrom("private", "safe", "unknown"),
				async (loader, form, target) => {
					const declaration =
						form === "alias"
							? `function require(value) { const specifier = value; return ${loader}(specifier); }`
							: form === "default"
								? `function require(value = "node:fs") { return ${loader}(value); }`
								: `function require(value) { return ${loader}(value); }`;
					const call =
						target === "private"
							? 'const target = "./author-style-mark.es.js"; module.exports = require(target);'
							: target === "safe"
								? 'module.exports = require("node:fs");'
								: "module.exports = name => require(name);";
					await fixture(
						{
							"entry.cjs": 'module.exports = require("loader-dep");',
							"node_modules/loader-dep/package.json":
								'{"name":"loader-dep","main":"index.cjs"}',
							"node_modules/loader-dep/index.cjs": `${declaration} ${call}`,
							"node_modules/loader-dep/author-style-mark.es.js":
								"exports.igniteAuthorStyle = css => ({ css });",
						},
						async (dir) => {
							const builds = [esbuildApp(dir), viteApp(dir)];
							if (target === "private") await expectMarkRefusal(builds);
							else await Promise.all(builds);
						},
					);
				},
			),
			{
				...profile,
				examples: [
					["module.require", "direct", "private"],
					["module.require", "alias", "private"],
					["module.require", "default", "private"],
					["import", "direct", "private"],
					["import", "alias", "private"],
					["import", "default", "private"],
					["module.require", "direct", "safe"],
					["module.require", "direct", "unknown"],
					["import", "direct", "safe"],
					["import", "direct", "unknown"],
				],
			},
		);
	});

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
					"rest-wrapper",
					"unknown-require",
					"unknown-module",
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
						"rest-wrapper": `function require(...args) { return module.require(args[0]); } export const load = suffix => require(${template});`,
						"unknown-require": "export const load = target => require(target);",
						"unknown-module":
							"export const load = target => module.require(target);",
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
							const rolldownApp = async () => {
								const bundle = await rolldown({
									input: path.join(dir, "entry.mjs"),
									plugins: [
										igniteRolldown(),
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
							const builds = [
								rollupApp(),
								rolldownApp(),
								viteApp(dir, "entry.mjs", output),
							];
							if (
								[
									"require",
									"module",
									"wrapper",
									"wrapper-alias",
									"wrapper-default",
									"rest-wrapper",
									"unknown-require",
									"unknown-module",
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
					["rest-wrapper"],
					["unknown-require"],
					["unknown-module"],
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

describe("reviewed expression-forwarding observations", () => {
	const expressions = {
		template: "`${value}`",
		concat: '"" + value',
		alias: "target",
		conditional: 'true ? `${value}` : "node:fs"',
		"conditional-alternate": 'false ? "node:fs" : `${value}`',
		logical: 'value || "node:fs"',
		sequence: '("discarded", `${value}`)',
		"sequence-many": '(0, "discarded", `${value}`)',
		call: "String(value)",
		member: "[value][0]",
		capture: "(() => value)()",
		rest: "value[0]",
	};
	it("R1: expression-based loader forwarding stays guarded before and after transforms", async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.constantFrom(
					...(Object.keys(expressions) as (keyof typeof expressions)[]),
				),
				fc.constantFrom("application", "dependency", "final"),
				async (form, stage) => {
					const parameter = form === "rest" ? "...value" : "value";
					const declaration = `function require(${parameter}) { const target = \`\${value}\`; return module.require(${expressions[form]}); }`;
					const target = '"./author-style-mark.es.js"';
					const source = `${declaration} module.exports = require(${target});`;
					const files: Record<string, string> =
						stage === "dependency"
							? {
									"entry.cjs": 'module.exports = require("loader-dep");',
									"node_modules/loader-dep/package.json":
										'{"name":"loader-dep","main":"index.cjs"}',
									"node_modules/loader-dep/index.cjs": source,
									"node_modules/loader-dep/author-style-mark.es.js":
										"exports.igniteAuthorStyle = css => ({ css });",
								}
							: {
									"entry.cjs": source,
									"author-style-mark.es.js":
										"exports.igniteAuthorStyle = css => ({ css });",
								};
					await fixture(files, async (dir) => {
						if (stage === "final") {
							writeFileSync(
								path.join(dir, "entry.mjs"),
								"export const load = () => null;",
							);
							await expectMarkRefusal([
								viteApp(
									dir,
									"entry.mjs",
									`${declaration} export const load = () => require(${target});`,
								),
							]);
						} else await expectMarkRefusal([esbuildApp(dir), viteApp(dir)]);
					});
				},
			),
			{
				...profile,
				examples: [
					["template", "application"],
					["template", "dependency"],
					["template", "final"],
					["concat", "dependency"],
					["alias", "dependency"],
					["conditional", "dependency"],
					["conditional-alternate", "dependency"],
					["logical", "dependency"],
					["sequence", "dependency"],
					["sequence-many", "dependency"],
					["call", "dependency"],
					["member", "dependency"],
					["capture", "dependency"],
					["rest", "dependency"],
				],
			},
		);
	});

	it("R2/R4: discarded inputs, branch tests and shadowed names remain ordinary data", async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.constantFrom(
					'(value, "node:fs")',
					'(value, Boolean(value), "node:fs")',
					'value ? "node:fs" : "node:path"',
					'`${(() => { const value = "node:fs"; return value; })()}`',
				),
				async (expression) => {
					const declaration = `function require(value) { module.require(${expression}); return Boolean(value); }`;
					const source = `${declaration} module.exports = require("author-style-is-data");`;
					await fixture({ "entry.cjs": source }, async (dir) => {
						await Promise.all([esbuildApp(dir), viteApp(dir)]);
						writeFileSync(
							path.join(dir, "entry.mjs"),
							"export const load = () => null;",
						);
						await viteApp(
							dir,
							"entry.mjs",
							`${declaration} export const load = () => require("author-style-is-data");`,
						);
					});
				},
			),
			{
				...profile,
				examples: [
					['(value, "node:fs")'],
					['(value, Boolean(value), "node:fs")'],
					['value ? "node:fs" : "node:path"'],
					['`${(() => { const value = "node:fs"; return value; })()}`'],
				],
			},
		);
	});
});

describe("reviewed loader-call observations", () => {
	const calls = {
		optional: "require?.(target)",
		"optional-member": "module?.require(target)",
		"optional-method": "module.require?.(target)",
		sequence: "(0, require)(target)",
		"sequence-many": "(0, Boolean, require)(target)",
		alias: "r(target)",
		"alias-chain": "s(target)",
		"module-alias": "m(target)",
		assigned: "assigned(target)",
		call: "require.call(null, target)",
		apply: "require.apply(null, [target])",
		"apply-const": "require.apply(null, targets)",
		"alias-call": "r.call(null, target)",
	};
	const aliases =
		"const r = require; const s = r; const m = module.require; let assigned; assigned = require; const targets = [target];";
	it("R1/R2: supported call shapes inspect loader targets and preserve local data functions", async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.constantFrom(...(Object.keys(calls) as (keyof typeof calls)[])),
				fc.boolean(),
				async (form, local) => {
					const prelude = local
						? "const module = { require: value => Boolean(value) }; function require(value) { return Boolean(value); }"
						: "";
					const entry = local ? "entry.mjs" : "entry.cjs";
					const source = `${prelude} const target = "./author-style-mark.es.js"; ${aliases} ${local ? "export const value" : "module.exports"} = ${calls[form]};`;
					await fixture(
						{
							[entry]: source,
							"author-style-mark.es.js":
								"exports.igniteAuthorStyle = css => ({ css });",
						},
						async (dir) => {
							const builds = [esbuildApp(dir, entry), viteApp(dir, entry)];
							if (local) await Promise.all(builds);
							else await expectMarkRefusal(builds);
						},
					);
				},
			),
			{
				...profile,
				examples: Object.keys(calls).flatMap<[keyof typeof calls, boolean]>(
					(form) => [
						[form as keyof typeof calls, false],
						[form as keyof typeof calls, true],
					],
				),
			},
		);
	});
	it("R1/R2: classifier source selection matches independent call-form expectations", () => {
		fc.assert(
			fc.property(
				fc.constantFrom(...(Object.keys(calls) as (keyof typeof calls)[])),
				fc.boolean(),
				(form, local) => {
					const prelude = local
						? "const module = { require: value => Boolean(value) }; function require(value) { return Boolean(value); }"
						: "";
					const ast = parse(
						prelude + ' const target = "data"; ' + aliases + calls[form] + ";",
						{ sourceType: "module" },
					);
					const actual = moduleLoadSources(ast)
						.filter((source) => source.kind === "call")
						.map((source) => source.source);
					if (local) expect(actual).toEqual([]);
					else {
						expect(actual).toHaveLength(1);
						expect(actual[0]).toMatchObject({
							type: "Identifier",
							name: "target",
						});
					}
				},
			),
			{
				...profile,
				numRuns: 100,
				examples: Object.keys(calls).flatMap<[keyof typeof calls, boolean]>(
					(form) => [
						[form as keyof typeof calls, false],
						[form as keyof typeof calls, true],
					],
				),
			},
		);
	});
});

describe("reviewed lexical wrapper chains", () => {
	it("R1/R2: a finite reference model distinguishes chained loaders from data functions", () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 1, max: 6 }),
				fc.boolean(),
				fc.boolean(),
				(count, data, rest) => {
					const argument = rest ? "values[0]" : "value";
					const declarations = Array.from({ length: count }, (_, index) => {
						const result =
							index + 1 < count
								? `wrapper${index + 1}(${argument})`
								: data
									? `Boolean(${argument})`
									: `module.require(String(${argument}))`;
						return `function wrapper${index}(${rest ? "...values" : "value"}) { return ${result}; }`;
					}).join("\n");
					const ast = parse(
						`${declarations}\nwrapper0("author-style-is-data");`,
						{ sourceType: "module" },
					);
					const calls = moduleLoadSources(ast).filter(
						(source) => source.kind === "call",
					);
					expect(calls).toHaveLength(data ? 0 : count + 1);
					if (!data)
						expect(calls.at(-1)?.source).toMatchObject({
							type: "StringLiteral",
							value: "author-style-is-data",
						});
				},
			),
			{
				...profile,
				numRuns: 100,
				examples: [
					[1, false, false],
					[1, false, true],
					[6, false, false],
					[6, false, true],
					[6, true, false],
					[6, true, true],
				],
			},
		);
	});
});

describe("reviewed reassigned forwarders", () => {
	it("R1/R2: reassignment retains real initial loaders while ordinary functions stay data", async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.constantFrom("declaration", "arrow", "expression"),
				fc.boolean(),
				fc.boolean(),
				async (form, loader, dependency) => {
					const operation = loader
						? "module.require(`${value}`)"
						: "Boolean(value)";
					const declaration =
						form === "declaration"
							? `function load(value) { return ${operation}; }`
							: form === "arrow"
								? `let load = value => ${operation};`
								: `let load = function(value) { return ${operation}; };`;
					const source = `${declaration} module.exports = load("./author-style-mark.es.js"); load = value => Boolean(value);`;
					const calls = moduleLoadSources(
						parse(source, { sourceType: "module" }),
					).filter((source) => source.kind === "call");
					expect(calls).toHaveLength(loader ? 2 : 0);
					const files: Record<string, string> = dependency
						? {
								"entry.cjs": 'module.exports = require("loader-dep");',
								"node_modules/loader-dep/package.json":
									'{"name":"loader-dep","main":"index.cjs"}',
								"node_modules/loader-dep/index.cjs": source,
								"node_modules/loader-dep/author-style-mark.es.js":
									"exports.igniteAuthorStyle = css => ({ css });",
							}
						: {
								"entry.cjs": source,
								"author-style-mark.es.js":
									"exports.igniteAuthorStyle = css => ({ css });",
							};
					await fixture(files, async (dir) => {
						const builds = [esbuildApp(dir), viteApp(dir)];
						if (loader) await expectMarkRefusal(builds);
						else await Promise.all(builds);
					});
				},
			),
			{
				...profile,
				examples: [
					["arrow", true, false],
					["arrow", true, true],
					["expression", true, false],
					["expression", true, true],
					["declaration", true, false],
					["declaration", true, true],
					["arrow", false, false],
					["arrow", false, true],
					["expression", false, true],
					["declaration", false, false],
				],
			},
		);
	});
});

describe("reviewed mutable target aliases", () => {
	it("R1/R2: possible loader inputs flow through mutable aliases without reclassifying unrelated safe I/O", async () => {
		const aliases = {
			let: "let target = value;",
			var: "var target = value;",
			assigned: "let target; target = value;",
			reassigned: 'let target = "node:fs"; target = value;',
		};
		await fc.assert(
			fc.asyncProperty(
				fc.constantFrom(...(Object.keys(aliases) as (keyof typeof aliases)[])),
				fc.boolean(),
				fc.boolean(),
				async (form, loader, dependency) => {
					const operation = loader
						? "return module.require(`${target}`);"
						: 'module.require("node:fs"); return Boolean(target);';
					const source = `function load(value) { ${aliases[form]} ${operation} } module.exports = load("./author-style-mark.es.js");`;
					const calls = moduleLoadSources(
						parse(source, { sourceType: "module" }),
					).filter((source) => source.kind === "call");
					expect(calls).toHaveLength(loader ? 2 : 1);
					const files: Record<string, string> = dependency
						? {
								"entry.cjs": 'module.exports = require("loader-dep");',
								"node_modules/loader-dep/package.json":
									'{"name":"loader-dep","main":"index.cjs"}',
								"node_modules/loader-dep/index.cjs": source,
								"node_modules/loader-dep/author-style-mark.es.js":
									"exports.igniteAuthorStyle = css => ({ css });",
							}
						: {
								"entry.cjs": source,
								"author-style-mark.es.js":
									"exports.igniteAuthorStyle = css => ({ css });",
							};
					await fixture(files, async (dir) => {
						const builds = [esbuildApp(dir), viteApp(dir)];
						if (loader) await expectMarkRefusal(builds);
						else await Promise.all(builds);
					});
				},
			),
			{
				...profile,
				examples: Object.keys(aliases).flatMap<
					[keyof typeof aliases, boolean, boolean]
				>((form) => [
					[form as keyof typeof aliases, true, false],
					[form as keyof typeof aliases, true, true],
					[form as keyof typeof aliases, false, false],
					[form as keyof typeof aliases, false, true],
				]),
			},
		);
	});
});

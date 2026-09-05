#!/usr/bin/env node

/**
 * Docs code-block typecheck guardrail.
 *
 * Extracts TypeScript / TSX code fences from the CURRENT (v3) docs and
 * typechecks them against the exact public beta package types, so doc
 * examples can't drift from the public API (failure modes include examples that
 * reference variables outside the callback scope, positional `emit` calls, or
 * positional `effects` callbacks that don't match the xstate adapter's
 * object-form `effects` type).
 *
 * Robustness against doc realities (so it reports real drift, not noise):
 *  - `ignite-element` + subpaths and `@ignite-element/*` map to the declaration
 *    files from the pinned public 3.0.0-beta.11 packages.
 *  - Unresolved imports fail unless a specific document/module pair is listed
 *    as an illustrative prerequisite. Connected runnable examples are checked
 *    separately without ambient scaffolding.
 *  - Names declared in EARLIER code blocks on the same page, plus a small set of
 *    test-runner globals and doc placeholders, are injected as ambient `any` so
 *    cross-block references and "your app provides this" names don't false-fail.
 *    A name that is declared NOWHERE (like the `snapshot` scope bug) still fails.
 *  - Blocks that don't parse as a complete module are treated as illustrative
 *    fragments and skipped.
 *
 * An optional baseline file (doc-examples-baseline.json) can identify accepted
 * diagnostics while still failing on new drift. The current baseline is empty.
 *
 * Opt a block out entirely with a `no-check` fence meta or a leading
 * `// docs-check: skip` comment. The frozen *.x archive is never checked.
 *
 * No package build is needed. Run `--update-baseline`
 * to regenerate the known-issues baseline after fixing docs.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const SITE_ROOT = fileURLToPath(new URL("..", import.meta.url)); // docs/site
const REPO_ROOT = resolve(SITE_ROOT, "..", "..");
const DOCS_DIR = join(SITE_ROOT, "src", "content", "docs");
const TMP = join(SITE_ROOT, ".doc-typecheck");
const BASELINE_FILE = join(SITE_ROOT, "scripts", "doc-examples-baseline.json");
const PUBLIC_PACKAGE_ROOT = join(SITE_ROOT, "node_modules");
const BETA_VERSION = "3.0.0-beta.11";
const DT = (p) =>
	relative(TMP, join(PUBLIC_PACKAGE_ROOT, p)).split(sep).join("/");

const PUBLIC_PACKAGES = [
	"@ignite-element/core",
	"@ignite-element/adapters",
	"@ignite-element/renderer",
	"ignite-element",
];

const LANGS = new Set(["ts", "tsx", "typescript", "typescriptreact"]);
const SKIP_META = /\b(no-check|no-typecheck|docs-skip)\b/;
const SKIP_COMMENT = /^\s*\/\/\s*docs-check:\s*skip\b/;
const ARCHIVE = /(^|\/)\d+\.x(\/|$)/;

// Per-document prerequisites only. These fragments are not standalone runnable
// programs. Never exempt an Ignite package path or an arbitrary relative import.
const ILLUSTRATIVE_IMPORTS = {
	"api/advanced-config.mdx": {
		"./ignite.config":
			"Application entrypoint illustration loads the configuration shown above.",
		"./components/ignite-counter":
			"Application-owned component registration illustrating config-before-component load order.",
	},
	"concepts/the-ignite-model.mdx": {
		"./counter-machine":
			"Application-owned counter source in the model illustration.",
	},
	"getting-started/first-component.mdx": {
		"./toggleMachine": "Source module is shown in the preceding fence.",
	},
	"guides/actor-web.mdx": {
		"./application":
			"Application-owned topology, runtime startup, and view projection.",
	},
	"guides/host-app-integration.mdx": {
		"./register-ignite":
			"Registration module shown on the same page and exercised by the connected check.",
		"./toggle-machine":
			"Preceding source module; connected registration also strictly checked.",
		react:
			"Optional host-framework prerequisite in the hand-written wrapper illustration, absent from the frozen docs dependencies; this fragment is not runnable verification.",
	},
	"guides/routing.mdx": {
		"./routes": "Route table from the linked released example.",
		"./matchRoute": "Pure matcher from the linked released example.",
		"./navigation":
			"Application-owned navigation port from the linked example.",
		"./routerSource":
			"Started source from the linked example; connected test also strictly checked.",
	},
	"guides/testing.mdx": {
		"./ignite.config":
			"Application config loaded by the separate test setup module.",
		"./counter.machine": "Separate machine module shown on the same page.",
		"./counter.element": "Separate registration module shown on the same page.",
	},
	"index.mdx": {
		"./toggle-machine":
			"Homepage illustration of an application-owned toggle source.",
		"./counter-machine":
			"Homepage illustration of an application-owned counter source.",
	},
};

// Names assumed available without declaration: test-runner globals + the
// "your app provides this" placeholders that appear throughout the guides.
const AMBIENT_GLOBALS = [
	// test-runner globals
	"describe",
	"it",
	"test",
	"expect",
	"beforeAll",
	"afterAll",
	"beforeEach",
	"afterEach",
	"vi",
	"defineConfig",
	// "your app provides this" placeholders used in the guides
	"handleToggle",
	"handleIncrement",
	"checkoutRuntime",
	// library / adapter names that some illustrative fragments use without an
	// import. Blocks that DO import these shadow the ambient (so igniteCore /
	// component calls in import-bearing blocks are still type-checked for real).
	"igniteCore",
	"component",
	"createMachine",
	"createActor",
	"html",
	"actor",
	"machine",
	"counterMachine",
	"toggleMachine",
];

// Diagnostic codes that only arise from how we SYNTHESIZE per-block files
// (ambient declarations + module wrapping) or from TS perf limits on the deep
// generics — never from real doc/API drift. Filtered out.
const ARTIFACT_CODES = new Set([2321, 2347, 2395, 2440, 2451, 2589]);

const DECL_RE =
	/(?:^|\n)[ \t]*(?:export[ \t]+)?(?:default[ \t]+)?(?:async[ \t]+)?(?:const|let|var|function|class)[ \t]+([A-Za-z_$][\w$]*)/g;
const IMPORT_RE =
	/import\s+(?:type\s+)?(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\*\s*as\s+([A-Za-z_$][\w$]*)|\{([^}]*)\})?\s*from/g;

const COMPILER_OPTIONS = {
	jsx: ts.JsxEmit.ReactJSX,
	jsxImportSource: "ignite-element/jsx",
	module: ts.ModuleKind.ESNext,
	moduleResolution: ts.ModuleResolutionKind.Bundler,
	target: ts.ScriptTarget.ESNext,
	lib: ["lib.esnext.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
	strict: false,
	noImplicitAny: false,
	skipLibCheck: true,
	noEmit: true,
	allowJs: false,
	noUncheckedSideEffectImports: true,
	types: [],
	baseUrl: TMP,
	// Map directly to the declaration graph from the exact public prerelease.
	paths: {
		"ignite-element": [DT("ignite-element/dist/types/index.d.ts")],
		"ignite-element/jsx": [DT("ignite-element/dist/types/jsx/index.d.ts")],
		"ignite-element/jsx/jsx-runtime": [
			DT("ignite-element/dist/types/jsx/jsx-runtime.d.ts"),
		],
		"ignite-element/jsx/jsx-dev-runtime": [
			DT("ignite-element/dist/types/jsx/jsx-dev-runtime.d.ts"),
		],
		"ignite-element/xstate": [DT("ignite-element/dist/types/xstate.d.ts")],
		"ignite-element/redux": [DT("ignite-element/dist/types/redux.d.ts")],
		"ignite-element/mobx": [DT("ignite-element/dist/types/mobx.d.ts")],
		"ignite-element/actor-web": [
			DT("ignite-element/dist/types/actor-web.d.ts"),
		],
		"ignite-element/react": [DT("ignite-element/dist/types/react/index.d.ts")],
		"ignite-element/tools": [DT("ignite-element/dist/types/tools/index.d.ts")],
		"ignite-element/tools/anthropic": [
			DT("ignite-element/dist/types/tools/anthropic/index.d.ts"),
		],
		"ignite-element/tools/openai": [
			DT("ignite-element/dist/types/tools/openai/index.d.ts"),
		],
		"@ignite-element/core": [DT("@ignite-element/core/dist/types/index.d.ts")],
		"@ignite-element/adapters": [
			DT("@ignite-element/adapters/dist/types/index.d.ts"),
		],
		"@ignite-element/adapters/actor-web": [
			DT("@ignite-element/adapters/dist/types/actor-web.d.ts"),
		],
		"@ignite-element/adapters/xstate": [
			DT("@ignite-element/adapters/dist/types/xstate.d.ts"),
		],
		"@ignite-element/adapters/redux": [
			DT("@ignite-element/adapters/dist/types/redux.d.ts"),
		],
		"@ignite-element/adapters/mobx": [
			DT("@ignite-element/adapters/dist/types/mobx.d.ts"),
		],
		"@ignite-element/renderer": [
			DT("@ignite-element/renderer/dist/types/index.d.ts"),
		],
		"@ignite-element/renderer/jsx": [
			DT("@ignite-element/renderer/dist/types/renderers/ignite-jsx.d.ts"),
		],
		"@ignite-element/renderer/lit": [
			DT("@ignite-element/renderer/dist/types/renderers/lit.d.ts"),
		],
		"@ignite-element/renderer/jsx-runtime": [
			DT("@ignite-element/renderer/dist/types/jsx/jsx-runtime.d.ts"),
		],
		"@ignite-element/renderer/jsx-dev-runtime": [
			DT("@ignite-element/renderer/dist/types/jsx/jsx-dev-runtime.d.ts"),
		],
		"@ignite-element/renderer/jsx/index": [
			DT("@ignite-element/renderer/dist/types/jsx/index.d.ts"),
		],
	},
};

async function findDocs(dir) {
	const out = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		const rel = relative(DOCS_DIR, full).split(sep).join("/");
		if (ARCHIVE.test(rel)) continue;
		if (entry.isDirectory()) out.push(...(await findDocs(full)));
		else if (/\.mdx?$/.test(entry.name)) out.push(full);
	}
	return out;
}

function extractBlocks(text) {
	const lines = text.split("\n");
	const blocks = [];
	let cur = null;
	for (let i = 0; i < lines.length; i++) {
		if (cur) {
			if (/^```\s*$/.test(lines[i])) {
				blocks.push(cur);
				cur = null;
			} else cur.code.push(lines[i]);
		} else {
			const fence = lines[i].match(/^```([A-Za-z0-9]+)?[ \t]*(.*)$/);
			if (fence)
				cur = {
					lang: (fence[1] || "").toLowerCase(),
					meta: fence[2] || "",
					code: [],
					startLine: i + 2,
				};
		}
	}
	return blocks.map((b) => ({ ...b, code: b.code.join("\n") }));
}

function exclusionMechanism(block) {
	const metaMatch = block.meta.match(SKIP_META);
	if (metaMatch) return metaMatch[1];
	const firstLine = block.code.split("\n").find((line) => line.trim());
	if (firstLine && SKIP_COMMENT.test(firstLine)) return "skip-comment";
	return undefined;
}

/** Top-level binding names declared OR imported in a block. */
function declaredNames(code) {
	const names = new Set();
	for (const m of code.matchAll(DECL_RE)) names.add(m[1]);
	for (const m of code.matchAll(IMPORT_RE)) {
		if (m[1]) names.add(m[1]); // default
		if (m[2]) names.add(m[2]); // namespace
		if (m[3]) {
			for (const part of m[3].split(",")) {
				const name = part
					.trim()
					.replace(/^type\s+/, "")
					.split(/\s+as\s+/)
					.pop()
					.trim();
				if (name) names.add(name);
			}
		}
	}
	return names;
}

async function main() {
	for (const packageName of PUBLIC_PACKAGES) {
		const packageJsonPath = join(
			PUBLIC_PACKAGE_ROOT,
			packageName,
			"package.json",
		);
		if (!existsSync(packageJsonPath)) {
			console.error(
				`[check-doc-examples] Missing ${packageName}@${BETA_VERSION}; install docs-site dependencies.`,
			);
			process.exit(2);
		}
		const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
		if (packageJson.version !== BETA_VERSION || packageJson.type !== "module") {
			console.error(
				`[check-doc-examples] Expected ${packageName}@${BETA_VERSION} as native ESM, received ${packageJson.version ?? "unknown"}.`,
			);
			process.exit(2);
		}
		for (const [specifier, targets] of Object.entries(COMPILER_OPTIONS.paths)) {
			if (specifier !== packageName && !specifier.startsWith(`${packageName}/`))
				continue;
			const subpath =
				specifier === packageName
					? "."
					: `.${specifier.slice(packageName.length)}`;
			const exported = packageJson.exports?.[subpath]?.types;
			if (
				!exported ||
				targets.length !== 1 ||
				resolve(TMP, targets[0]) !==
					resolve(PUBLIC_PACKAGE_ROOT, packageName, exported) ||
				!existsSync(resolve(TMP, targets[0]))
			) {
				throw new Error(
					`Missing or unsupported declaration target: ${specifier}`,
				);
			}
		}
	}
	const baseline = existsSync(BASELINE_FILE)
		? (JSON.parse(await readFile(BASELINE_FILE, "utf8")).entries ?? [])
		: [];

	const files = await findDocs(DOCS_DIR);
	const snippets = [];
	const exclusions = [];
	let totalDiscovered = 0;
	for (const file of files) {
		const blocks = extractBlocks(await readFile(file, "utf8"));
		const earlier = new Set();
		let typeScriptBlockIndex = 0;
		for (let i = 0; i < blocks.length; i++) {
			const b = blocks[i];
			if (LANGS.has(b.lang)) {
				totalDiscovered++;
				typeScriptBlockIndex++;
				const mechanism = exclusionMechanism(b);
				if (mechanism) {
					exclusions.push({
						doc: relative(REPO_ROOT, file).split(sep).join("/"),
						blockIndex: typeScriptBlockIndex,
						line: b.startLine,
						language: b.lang,
						mechanism,
					});
				} else {
					snippets.push({
						file,
						index: i,
						startLine: b.startLine,
						code: b.code,
						ambient: new Set(earlier),
					});
				}
			}
			for (const n of declaredNames(b.code)) earlier.add(n);
		}
	}

	await rm(TMP, { recursive: true, force: true });
	await mkdir(TMP, { recursive: true });
	const byVirtual = new Map();
	for (const s of snippets) {
		const own = declaredNames(s.code);
		const ambient = [...new Set([...s.ambient, ...AMBIENT_GLOBALS])].filter(
			(n) => !own.has(n),
		);
		const prelude = ambient.map((n) => `declare const ${n}: any;`).join("\n");
		// One line per ambient `declare` + a blank separator precede the snippet,
		// so subtract that many lines to map diagnostics back to the .mdx.
		const preludeLines = ambient.length ? ambient.length + 1 : 0;
		const body = `${prelude}${prelude ? "\n\n" : ""}${s.code}\nexport {};\n`;
		const name = `${relative(DOCS_DIR, s.file).replace(/[^\w]/g, "_")}__${s.index}.tsx`;
		const path = join(TMP, name);
		await writeFile(path, body);
		byVirtual.set(resolve(path), { ...s, preludeLines });
	}

	const program = ts.createProgram([...byVirtual.keys()], COMPILER_OPTIONS);
	const all = ts.getPreEmitDiagnostics(program);

	const syntactic = new Set();
	for (const d of all) {
		if (
			d.file &&
			byVirtual.has(resolve(d.file.fileName)) &&
			d.code >= 1000 &&
			d.code < 2000
		) {
			syntactic.add(resolve(d.file.fileName));
		}
	}

	const failures = [];
	const illustrativeImports = [];
	for (const d of all) {
		if (!d.file) continue;
		const key = resolve(d.file.fileName);
		const s = byVirtual.get(key);
		if (!s) continue; // library-internal noise
		if (syntactic.has(key)) continue; // fragment
		if (d.code === 2307) {
			const specifier = ts
				.flattenDiagnosticMessageText(d.messageText, " ")
				.match(/Cannot find module '([^']+)'/)?.[1];
			const doc = relative(DOCS_DIR, s.file).split(sep).join("/");
			const reason = ILLUSTRATIVE_IMPORTS[doc]?.[specifier];
			if (reason) {
				illustrativeImports.push({ doc, specifier, reason });
				continue;
			}
		}
		if (ARTIFACT_CODES.has(d.code)) continue; // file-synthesis / TS-perf artifact
		const message = ts.flattenDiagnosticMessageText(d.messageText, " ");
		const { line } = d.file.getLineAndCharacterOfPosition(d.start);
		failures.push({
			doc: relative(REPO_ROOT, s.file).split(sep).join("/"),
			line: s.startLine + Math.max(0, line - s.preludeLines),
			code: d.code,
			message,
		});
	}
	await rm(TMP, { recursive: true, force: true });

	if (process.argv.includes("--update-baseline")) {
		const seen = new Set();
		const entries = [];
		for (const f of failures) {
			const includes = f.message.slice(0, 48);
			const k = `${f.doc}::${f.code}::${includes}`;
			if (seen.has(k)) continue;
			seen.add(k);
			entries.push({ doc: f.doc, code: f.code, includes });
		}
		await writeFile(
			BASELINE_FILE,
			`${JSON.stringify({ note: "Known doc-example failures to burn down (docs-accuracy tasks). Each is a real finding or symptom; the guardrail fails on anything NOT listed here.", entries }, null, 2)}\n`,
		);
		console.log(
			`Wrote ${entries.length} baseline entries from ${failures.length} failures to ${relative(REPO_ROOT, BASELINE_FILE)}.`,
		);
		return;
	}

	const baselinedHits = new Set();
	const fresh = failures.filter((f) => {
		const b = baseline.find(
			(b) =>
				b.doc === f.doc && b.code === f.code && f.message.includes(b.includes),
		);
		if (b) {
			baselinedHits.add(b);
			return false;
		}
		return true;
	});
	const stale = baseline.filter((b) => !baselinedHits.has(b));

	const checked = byVirtual.size - syntactic.size;
	const eligible = snippets.length;
	if (totalDiscovered !== exclusions.length + syntactic.size + checked) {
		throw new Error(
			"documentation example accounting invariant failed: total != excluded + incomplete + typechecked",
		);
	}
	if (eligible !== syntactic.size + checked) {
		throw new Error(
			"documentation example accounting invariant failed: eligible != incomplete + typechecked",
		);
	}
	const report = {
		status: "documentation-example-accounting",
		filesScanned: files.length,
		totalDiscovered,
		explicitlyExcluded: exclusions.length,
		eligible,
		syntacticallyIncomplete: syntactic.size,
		incompleteFragments: [...syntactic].map((key) => {
			const snippet = byVirtual.get(key);
			return {
				doc: relative(REPO_ROOT, snippet.file).split(sep).join("/"),
				line: snippet.startLine,
			};
		}),
		actuallyTypechecked: checked,
		knownBaselineEntries: baseline.length,
		knownBaselinedFailures: failures.length - fresh.length,
		newFailures: fresh.length,
		illustrativeImports,
		exclusions,
	};
	console.log("\nDocs code-block typecheck guardrail");
	console.log("─".repeat(72));
	console.log(
		`Scanned ${files.length} doc files: ${totalDiscovered} TS/TSX fences discovered, ${exclusions.length} explicitly excluded, ${eligible} eligible, ${syntactic.size} syntactically incomplete, ${checked} typechecked.`,
	);
	console.log(
		`Known-baselined failures: ${failures.length - fresh.length}; baseline entries: ${baseline.length}; new failures: ${fresh.length}.`,
	);
	console.log("Explicit exclusions:");
	for (const exclusion of exclusions) {
		console.log(
			`  - ${exclusion.doc}:${exclusion.line} block ${exclusion.blockIndex} ${exclusion.language} via ${exclusion.mechanism}`,
		);
	}
	console.log(JSON.stringify(report));
	if (stale.length) {
		console.log(
			`\n⚠ ${stale.length} baseline entr(ies) no longer occur — remove them:`,
		);
		for (const b of stale)
			console.log(`  - ${b.doc} TS${b.code} "${b.includes}"`);
	}
	if (fresh.length) {
		console.error(`\n✗ ${fresh.length} NEW doc example type error(s):`);
		for (const f of fresh)
			console.error(`  - ${f.doc}:${f.line}  TS${f.code}  ${f.message}`);
		console.error(
			"\nFix the example to match the real API, mark an intentionally-partial block with `no-check`, or (if a known issue) add it to doc-examples-baseline.json.",
		);
		process.exit(1);
	}
	console.log(
		`\n✓ Exact-public-beta declaration compatibility check passed for ${checked} blocks; ${baseline.length} baseline entries.`,
	);
}

main().catch((err) => {
	console.error("[check-doc-examples] unexpected error:", err);
	process.exit(2);
});

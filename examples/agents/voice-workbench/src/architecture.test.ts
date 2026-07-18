import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

type BoundaryRule = {
	id: string;
	layer:
		| "contracts"
		| "functional-core"
		| "statechart"
		| "projection"
		| "runtime"
		| "adapter"
		| "composition"
		| "host-root";
	paths?: readonly string[];
	prefixes?: readonly string[];
	allowSideEffects: boolean;
	allowedInternalDependencies: readonly string[];
	allowedExternalRuntimeImports?: readonly string[];
	disposition: "reuse" | "extend" | "move" | "split" | "retire";
};

type ReviewedViolation = {
	rule: string;
	file: string;
	detail: string;
};

type ArchitectureBoundaries = {
	moduleRules: readonly BoundaryRule[];
	reviewedViolations: readonly ReviewedViolation[];
};

const workbenchRoot = resolve(import.meta.dirname, "..");
const srcRoot = resolve(workbenchRoot, "src");
const boundariesPath = resolve(workbenchRoot, "architecture-boundaries.json");

const deterministicLayers = new Set<BoundaryRule["layer"]>([
	"contracts",
	"functional-core",
	"statechart",
	"projection",
]);

const bannedDeterministicGlobals = [
	{ label: "window", pattern: /\bwindow\./ },
	{ label: "navigator", pattern: /\bnavigator\./ },
	{ label: "SpeechRecognition", pattern: /\bnew\s+SpeechRecognition\b/ },
	{
		label: "webkitSpeechRecognition",
		pattern: /\bnew\s+webkitSpeechRecognition\b/,
	},
	{ label: "speechSynthesis", pattern: /\bspeechSynthesis\./ },
	{ label: "localStorage", pattern: /\blocalStorage\./ },
	{ label: "sessionStorage", pattern: /\bsessionStorage\./ },
	{ label: "globalThis.fetch", pattern: /\bglobalThis\.fetch\b/ },
	{ label: "XMLHttpRequest", pattern: /\bnew\s+XMLHttpRequest\b/ },
	{ label: "WebSocket", pattern: /\bnew\s+WebSocket\b/ },
	{ label: "Date.now", pattern: /\bDate\.now\(/ },
	{ label: "Math.random", pattern: /\bMath\.random\(/ },
] as const;

const externalRuntimeByLayer: Record<BoundaryRule["layer"], readonly string[]> =
	{
		contracts: [],
		"functional-core": [],
		statechart: ["xstate", "ignite-element/tools"],
		projection: ["ignite-element/tools"],
		runtime: ["xstate"],
		adapter: ["ignite-element/tools"],
		composition: ["ignite-element/xstate", "ignite-element/tools", "xstate"],
		"host-root": [
			"@ignite-element/renderer/jsx",
			"ignite-element/xstate",
			"xstate",
			"node:process",
			"node:readline/promises",
			"node:url",
		],
	};

const productionFiles = (dir: string): string[] => {
	const files: string[] = [];
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		const stats = statSync(path);
		if (stats.isDirectory()) {
			if (entry === "fixtures") continue;
			files.push(...productionFiles(path));
			continue;
		}
		if (![".ts", ".tsx"].includes(extname(path))) continue;
		if (
			path.endsWith(".test.ts") ||
			path.endsWith(".test.tsx") ||
			path.endsWith(".d.ts")
		) {
			continue;
		}
		files.push(path);
	}
	return files.sort();
};

const importMatches = (source: string) =>
	Array.from(
		source.matchAll(
			/^import\s+(type\s+)?(?:[\s\S]*?)\s+from\s+["']([^"']+)["'];?$/gm,
		),
	).map((match) => ({
		typeOnly: Boolean(match[1]),
		specifier: match[2]!,
	}));

const normalizeWorkspacePath = (path: string) =>
	relative(workbenchRoot, path).replace(/\\/g, "/");

const resolveRelativeImport = (fromFile: string, specifier: string) => {
	const base = resolve(dirname(fromFile), specifier);
	const candidates = [
		base,
		`${base}.ts`,
		`${base}.tsx`,
		join(base, "index.ts"),
		join(base, "index.tsx"),
	];
	return candidates.find((candidate) => existsSync(candidate)) ?? null;
};

const loadBoundaries = (): ArchitectureBoundaries => {
	if (!existsSync(boundariesPath)) {
		throw new Error(
			`Missing architecture-boundaries.json at ${normalizeWorkspacePath(boundariesPath)}.`,
		);
	}
	return JSON.parse(
		readFileSync(boundariesPath, "utf8"),
	) as ArchitectureBoundaries;
};

const matchesRule = (relativePath: string, rule: BoundaryRule) =>
	(rule.paths ?? []).includes(relativePath) ||
	(rule.prefixes ?? []).some((prefix) => relativePath.startsWith(prefix));

describe("voice workbench architecture boundaries", () => {
	it("checks in an explicit boundary manifest for every production example module", () => {
		expect(existsSync(boundariesPath)).toBe(true);
		const boundaries = loadBoundaries();
		const files = productionFiles(srcRoot).map(normalizeWorkspacePath);
		expect(boundaries.moduleRules.length).toBeGreaterThan(0);

		const unmatched = files.filter(
			(file) =>
				boundaries.moduleRules.filter((rule) => matchesRule(file, rule))
					.length !== 1,
		);

		expect(unmatched).toEqual([]);
	});

	it("keeps deterministic layers free of host globals and forbidden inward imports", () => {
		const boundaries = loadBoundaries();
		const files = productionFiles(srcRoot);
		const ownership = new Map<string, BoundaryRule>();
		for (const file of files) {
			const relativePath = normalizeWorkspacePath(file);
			const rule = boundaries.moduleRules.find((entry) =>
				matchesRule(relativePath, entry),
			);
			if (!rule) continue;
			ownership.set(relativePath, rule);
		}

		const actualViolations: ReviewedViolation[] = [];

		for (const file of files) {
			const relativePath = normalizeWorkspacePath(file);
			const rule = ownership.get(relativePath);
			if (!rule) continue;
			const source = readFileSync(file, "utf8");
			for (const token of bannedDeterministicGlobals) {
				if (
					deterministicLayers.has(rule.layer) &&
					token.pattern.test(source) &&
					!rule.allowSideEffects
				) {
					actualViolations.push({
						rule: "deterministic-no-host-globals",
						file: relativePath,
						detail: `Unexpected ${token.label} reference in ${rule.layer}.`,
					});
				}
			}

			for (const imported of importMatches(source)) {
				if (imported.specifier.startsWith(".")) {
					const resolved = resolveRelativeImport(file, imported.specifier);
					if (!resolved) {
						actualViolations.push({
							rule: "resolved-relative-import",
							file: relativePath,
							detail: `Could not resolve ${imported.specifier}.`,
						});
						continue;
					}
					const importedPath = normalizeWorkspacePath(resolved);
					const importedRule = ownership.get(importedPath);
					if (!importedRule) continue;
					if (!rule.allowedInternalDependencies.includes(importedRule.id)) {
						actualViolations.push({
							rule: "allowed-internal-dependencies",
							file: relativePath,
							detail: `${rule.id} cannot import ${importedRule.id} via ${importedPath}.`,
						});
					}
					continue;
				}

				if (imported.typeOnly) continue;
				const allowed = new Set([
					...externalRuntimeByLayer[rule.layer],
					...(rule.allowedExternalRuntimeImports ?? []),
				]);
				if (!allowed.has(imported.specifier)) {
					actualViolations.push({
						rule: "allowed-external-runtime-imports",
						file: relativePath,
						detail: `${rule.id} cannot import ${imported.specifier}.`,
					});
				}
			}
		}

		expect(actualViolations).toEqual(boundaries.reviewedViolations);
	});
});

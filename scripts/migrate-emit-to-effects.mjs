import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_ROOTS = ["."];
const DEFAULT_EXTENSIONS = new Set([
	".ts",
	".tsx",
	".js",
	".jsx",
	".md",
	".mdx",
]);
const IGNORED_DIRECTORIES = new Set([
	".git",
	".fas",
	".astro",
	"coverage",
	"dist",
	"docs",
	"node_modules",
]);

function isIgnoredPath(entryPath) {
	return (
		entryPath.endsWith(".d.ts") ||
		entryPath.endsWith(".tsbuildinfo") ||
		entryPath.includes(`${path.sep}__tests__${path.sep}`) ||
		entryPath.includes(`${path.sep}tests${path.sep}`) ||
		entryPath.endsWith(".test.js") ||
		entryPath.endsWith(".test.ts") ||
		entryPath.endsWith(".test.tsx") ||
		entryPath.endsWith(".spec.js") ||
		entryPath.endsWith(".spec.ts") ||
		entryPath.endsWith(".spec.tsx") ||
		path.basename(entryPath) === "README.md" ||
		path.basename(entryPath) === "CHANGELOG.md"
	);
}

function getLineNumber(source, index) {
	return source.slice(0, index).split("\n").length;
}

function findMatchingBrace(source, openIndex) {
	let depth = 0;

	for (let index = openIndex; index < source.length; index += 1) {
		const character = source[index];
		if (character === "{") {
			depth += 1;
		} else if (character === "}") {
			depth -= 1;
			if (depth === 0) {
				return index;
			}
		}
	}

	return -1;
}

export function analyzeSource(source) {
	const findings = [];
	const commandPattern = /commands\s*:\s*\(([\s\S]{0,200}?)\)\s*=>/g;

	for (const match of source.matchAll(commandPattern)) {
		const matchIndex = match.index ?? 0;
		const parameterSource = match[1] ?? "";
		if (/\bemit\b/.test(parameterSource)) {
			findings.push({
				type: "command-context",
				line: getLineNumber(source, matchIndex),
				message:
					"`commands` still destructures `emit`. Remove it from the command context and move event emission into `effects()`.",
			});
		}

		const bodyStart = source.indexOf("{", matchIndex + match[0].length);
		if (bodyStart === -1) {
			continue;
		}

		const bodyEnd = findMatchingBrace(source, bodyStart);
		if (bodyEnd === -1) {
			continue;
		}

		const bodySource = source.slice(bodyStart, bodyEnd + 1);
		for (const bodyMatch of bodySource.matchAll(/\bemit\s*\(/g)) {
			const emitIndex = bodyStart + (bodyMatch.index ?? 0);
			findings.push({
				type: "emit-call",
				line: getLineNumber(source, emitIndex),
				message:
					"`emit(...)` call found inside `commands`. Move it into `effects(snapshot, prevSnapshot, ctx)`.",
			});
		}
	}

	return findings;
}

async function collectFiles(entryPath) {
	if (isIgnoredPath(entryPath)) {
		return [];
	}

	const entryStats = await stat(entryPath);
	if (entryStats.isFile()) {
		return DEFAULT_EXTENSIONS.has(path.extname(entryPath)) ? [entryPath] : [];
	}

	const entries = await readdir(entryPath, { withFileTypes: true });
	const nestedFiles = await Promise.all(
		entries.map(async (entry) => {
			if (IGNORED_DIRECTORIES.has(entry.name)) {
				return [];
			}

			return collectFiles(path.join(entryPath, entry.name));
		}),
	);

	return nestedFiles.flat();
}

export async function analyzePaths(pathsToScan = DEFAULT_ROOTS) {
	const fileSets = await Promise.all(
		pathsToScan.map((entry) => collectFiles(entry)),
	);
	const files = [...new Set(fileSets.flat())].sort();
	const report = [];

	for (const filePath of files) {
		const source = await readFile(filePath, "utf8");
		const findings = analyzeSource(source);

		if (findings.length > 0) {
			report.push({
				filePath,
				findings,
			});
		}
	}

	return report;
}

export function formatReport(report) {
	if (report.length === 0) {
		return [
			"No command-coupled `emit` usage found.",
			"",
			"Your codebase already looks aligned with the effects-based event model.",
		].join("\n");
	}

	const lines = [
		"ignite-element effects migration report",
		"",
		"Commands should express intent. Move DOM event emission into `effects(snapshot, prevSnapshot, ctx)`.",
		"",
		"Suggested migration shape:",
		"1. Remove `emit` from `commands` parameters.",
		"2. Keep command bodies focused on actor/store events.",
		"3. Add `effects(snapshot, prevSnapshot, { emit, actor, host })`.",
		"4. Emit only when the relevant state transition actually occurred.",
		"",
	];

	for (const entry of report) {
		lines.push(`${entry.filePath}`);
		for (const finding of entry.findings) {
			lines.push(`  L${finding.line}: ${finding.message}`);
		}
		lines.push("");
	}

	lines.push(
		"See docs/migrations/v2.2.3-effects-events.md for before/after examples and rollout guidance.",
	);

	return lines.join("\n");
}

async function runCli(argv = process.argv.slice(2)) {
	const args = [...argv];
	const reportIndex = args.indexOf("--report");
	let reportPath;

	if (reportIndex !== -1) {
		reportPath = args[reportIndex + 1];
		args.splice(reportIndex, 2);
	}

	const targets = args.length > 0 ? args : DEFAULT_ROOTS;
	const report = await analyzePaths(targets);
	const formatted = formatReport(report);

	if (reportPath) {
		await writeFile(reportPath, formatted, "utf8");
	}

	process.stdout.write(`${formatted}\n`);
	process.exitCode = report.length > 0 ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	runCli().catch((error) => {
		process.stderr.write(
			`${error instanceof Error ? error.message : String(error)}\n`,
		);
		process.exitCode = 1;
	});
}

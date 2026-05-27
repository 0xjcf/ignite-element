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
const REGEX_PREFIX_TOKENS = new Set([
	"(",
	"[",
	"{",
	",",
	";",
	":",
	"=",
	"!",
	"?",
	"&",
	"|",
	"+",
	"-",
	"*",
	"%",
	"^",
	"~",
	"<",
	">",
]);
const REGEX_PREFIX_KEYWORDS = new Set([
	"case",
	"delete",
	"in",
	"instanceof",
	"new",
	"of",
	"return",
	"throw",
	"typeof",
	"void",
	"yield",
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

function isIdentifierPart(character) {
	return /[A-Za-z0-9_$]/.test(character);
}

function skipLineComment(source, startIndex) {
	let index = startIndex + 2;
	while (index < source.length && source[index] !== "\n") {
		index += 1;
	}
	return index - 1;
}

function skipBlockComment(source, startIndex) {
	const endIndex = source.indexOf("*/", startIndex + 2);
	return endIndex === -1 ? source.length - 1 : endIndex + 1;
}

function skipQuotedString(source, startIndex, quote) {
	for (let index = startIndex + 1; index < source.length; index += 1) {
		const character = source[index];
		if (character === "\\") {
			index += 1;
			continue;
		}
		if (character === quote) {
			return index;
		}
	}
	return source.length - 1;
}

function previousSignificantToken(source, index) {
	for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
		const character = source[cursor];
		if (/\s/.test(character)) {
			continue;
		}
		if (character === "/" && source[cursor - 1] === "*") {
			cursor -= 2;
			while (cursor >= 1) {
				if (source[cursor - 1] === "/" && source[cursor] === "*") {
					cursor -= 1;
					break;
				}
				cursor -= 1;
			}
			continue;
		}
		if (character === "\n") {
			continue;
		}
		if (character === "/" && source[cursor - 1] === "/") {
			cursor -= 2;
			while (cursor >= 0 && source[cursor] !== "\n") {
				cursor -= 1;
			}
			continue;
		}
		if (REGEX_PREFIX_TOKENS.has(character)) {
			return character;
		}
		if (isIdentifierPart(character)) {
			let start = cursor;
			while (start > 0 && isIdentifierPart(source[start - 1])) {
				start -= 1;
			}
			return source.slice(start, cursor + 1);
		}
		return character;
	}
	return null;
}

function isRegexStart(source, index) {
	const previousToken = previousSignificantToken(source, index);
	if (previousToken === null) {
		return true;
	}
	if (REGEX_PREFIX_TOKENS.has(previousToken)) {
		return true;
	}
	return REGEX_PREFIX_KEYWORDS.has(previousToken);
}

function skipRegexLiteral(source, startIndex) {
	let inCharacterClass = false;

	for (let index = startIndex + 1; index < source.length; index += 1) {
		const character = source[index];
		if (character === "\\") {
			index += 1;
			continue;
		}
		if (character === "[") {
			inCharacterClass = true;
			continue;
		}
		if (character === "]" && inCharacterClass) {
			inCharacterClass = false;
			continue;
		}
		if (character === "/" && !inCharacterClass) {
			let flagsIndex = index + 1;
			while (
				flagsIndex < source.length &&
				/[A-Za-z]/.test(source[flagsIndex])
			) {
				flagsIndex += 1;
			}
			return flagsIndex - 1;
		}
	}

	return source.length - 1;
}

function findMatchingDelimiter(
	source,
	openIndex,
	openCharacter,
	closeCharacter,
) {
	let depth = 0;

	for (let index = openIndex; index < source.length; index += 1) {
		const character = source[index];
		const nextCharacter = source[index + 1];

		if (character === "/" && nextCharacter === "/") {
			index = skipLineComment(source, index);
			continue;
		}
		if (character === "/" && nextCharacter === "*") {
			index = skipBlockComment(source, index);
			continue;
		}
		if (character === "'" || character === '"') {
			index = skipQuotedString(source, index, character);
			continue;
		}
		if (character === "`") {
			index = skipTemplateLiteral(source, index);
			continue;
		}
		if (
			character === "/" &&
			nextCharacter !== "/" &&
			nextCharacter !== "*" &&
			isRegexStart(source, index)
		) {
			index = skipRegexLiteral(source, index);
			continue;
		}
		if (character === openCharacter) {
			depth += 1;
			continue;
		}
		if (character === closeCharacter) {
			depth -= 1;
			if (depth === 0) {
				return index;
			}
		}
	}

	return -1;
}

function findTemplateExpressionRanges(source, startIndex) {
	const ranges = [];

	for (let index = startIndex + 1; index < source.length; index += 1) {
		const character = source[index];
		if (character === "\\") {
			index += 1;
			continue;
		}
		if (character === "`") {
			return { endIndex: index, ranges };
		}
		if (character === "$" && source[index + 1] === "{") {
			const expressionEnd = findMatchingDelimiter(source, index + 1, "{", "}");
			if (expressionEnd === -1) {
				return { endIndex: source.length - 1, ranges };
			}
			ranges.push({
				endIndex: expressionEnd - 1,
				startIndex: index + 2,
			});
			index = expressionEnd;
		}
	}

	return { endIndex: source.length - 1, ranges };
}

function skipTemplateLiteral(source, startIndex) {
	return findTemplateExpressionRanges(source, startIndex).endIndex;
}

function skipWhitespaceAndComments(source, startIndex) {
	let index = startIndex;

	while (index < source.length) {
		const character = source[index];
		const nextCharacter = source[index + 1];

		if (/\s/.test(character)) {
			index += 1;
			continue;
		}
		if (character === "/" && nextCharacter === "/") {
			index = skipLineComment(source, index) + 1;
			continue;
		}
		if (character === "/" && nextCharacter === "*") {
			index = skipBlockComment(source, index) + 1;
			continue;
		}
		break;
	}

	return index;
}

function findPreviousNonWhitespaceIndex(source, startIndex) {
	for (let index = startIndex; index >= 0; index -= 1) {
		if (!/\s/.test(source[index])) {
			return index;
		}
	}

	return -1;
}

function isMemberAccessIdentifier(source, identifierStart) {
	const previousIndex = findPreviousNonWhitespaceIndex(
		source,
		identifierStart - 1,
	);
	return previousIndex !== -1 && source[previousIndex] === ".";
}

function findBareCallStart(source, identifierEnd) {
	const callStart = skipWhitespaceAndComments(source, identifierEnd);
	if (source[callStart] === "(") {
		return callStart;
	}

	if (source[callStart] === "?" && source[callStart + 1] === ".") {
		const optionalCallStart = skipWhitespaceAndComments(source, callStart + 2);
		if (source[optionalCallStart] === "(") {
			return optionalCallStart;
		}
	}

	return -1;
}

function findCommandPropertyIndices(source) {
	const indices = [];

	for (let index = 0; index < source.length; index += 1) {
		const character = source[index];
		const nextCharacter = source[index + 1];

		if (character === "/" && nextCharacter === "/") {
			index = skipLineComment(source, index);
			continue;
		}
		if (character === "/" && nextCharacter === "*") {
			index = skipBlockComment(source, index);
			continue;
		}
		if (character === "'" || character === '"') {
			index = skipQuotedString(source, index, character);
			continue;
		}
		if (character === "`") {
			index = skipTemplateLiteral(source, index);
			continue;
		}
		if (
			character === "/" &&
			nextCharacter !== "/" &&
			nextCharacter !== "*" &&
			isRegexStart(source, index)
		) {
			index = skipRegexLiteral(source, index);
			continue;
		}
		if (source.startsWith("commands", index)) {
			const previousCharacter = source[index - 1];
			const nextTokenCharacter = source[index + "commands".length];
			if (
				(previousCharacter === undefined ||
					!isIdentifierPart(previousCharacter)) &&
				(nextTokenCharacter === undefined ||
					!isIdentifierPart(nextTokenCharacter))
			) {
				indices.push(index);
				index += "commands".length - 1;
			}
		}
	}

	return indices;
}

function findCommandBlocks(source) {
	const commandBlocks = [];

	for (const matchIndex of findCommandPropertyIndices(source)) {
		let cursor = skipWhitespaceAndComments(
			source,
			matchIndex + "commands".length,
		);
		if (source[cursor] !== ":") {
			continue;
		}

		cursor = skipWhitespaceAndComments(source, cursor + 1);
		if (source[cursor] !== "(") {
			continue;
		}

		const parametersEnd = findMatchingDelimiter(source, cursor, "(", ")");
		if (parametersEnd === -1) {
			continue;
		}

		const parameterSource = source.slice(cursor + 1, parametersEnd);
		cursor = skipWhitespaceAndComments(source, parametersEnd + 1);
		if (source.slice(cursor, cursor + 2) !== "=>") {
			continue;
		}

		cursor = skipWhitespaceAndComments(source, cursor + 2);
		if (source[cursor] === "(") {
			const expressionEnd = findMatchingDelimiter(source, cursor, "(", ")");
			if (expressionEnd === -1) {
				continue;
			}

			const expressionCursor = skipWhitespaceAndComments(source, cursor + 1);
			if (source[expressionCursor] !== "{") {
				continue;
			}

			const bodyEnd = findMatchingDelimiter(source, expressionCursor, "{", "}");
			if (bodyEnd === -1) {
				continue;
			}

			commandBlocks.push({
				matchIndex,
				parameterSource,
				bodyStart: expressionCursor,
				bodyEnd,
			});
		} else if (source[cursor] === "{") {
			const bodyEnd = findMatchingDelimiter(source, cursor, "{", "}");
			if (bodyEnd === -1) {
				continue;
			}

			commandBlocks.push({
				matchIndex,
				parameterSource,
				bodyStart: cursor,
				bodyEnd,
			});
		}
	}

	return commandBlocks;
}

function findEmitCalls(source, startIndex, endIndex) {
	const emitCalls = [];

	for (let index = startIndex; index <= endIndex; index += 1) {
		const character = source[index];
		const nextCharacter = source[index + 1];

		if (character === "/" && nextCharacter === "/") {
			index = skipLineComment(source, index);
			continue;
		}
		if (character === "/" && nextCharacter === "*") {
			index = skipBlockComment(source, index);
			continue;
		}
		if (character === "'" || character === '"') {
			index = skipQuotedString(source, index, character);
			continue;
		}
		if (character === "`") {
			const templateScan = findTemplateExpressionRanges(source, index);
			for (const range of templateScan.ranges) {
				emitCalls.push(
					...findEmitCalls(source, range.startIndex, range.endIndex),
				);
			}
			index = templateScan.endIndex;
			continue;
		}
		if (
			character === "/" &&
			nextCharacter !== "/" &&
			nextCharacter !== "*" &&
			isRegexStart(source, index)
		) {
			index = skipRegexLiteral(source, index);
			continue;
		}
		if (source.startsWith("emit", index)) {
			const previousCharacter = source[index - 1];
			const nextTokenCharacter = source[index + 4];
			if (
				(previousCharacter === undefined ||
					!isIdentifierPart(previousCharacter)) &&
				!isMemberAccessIdentifier(source, index) &&
				(nextTokenCharacter === undefined ||
					!isIdentifierPart(nextTokenCharacter))
			) {
				if (findBareCallStart(source, index + 4) !== -1) {
					emitCalls.push(index);
				}
			}
		}
	}

	return emitCalls;
}

export function analyzeSource(source) {
	const findings = [];

	for (const commandBlock of findCommandBlocks(source)) {
		if (/\bemit\b/.test(commandBlock.parameterSource)) {
			findings.push({
				type: "command-context",
				line: getLineNumber(source, commandBlock.matchIndex),
				message:
					"`commands` still destructures `emit`. Remove it from the command context and move event emission into `effects()`.",
			});
		}

		for (const emitIndex of findEmitCalls(
			source,
			commandBlock.bodyStart,
			commandBlock.bodyEnd,
		)) {
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

export function parseCliArgs(argv = process.argv.slice(2)) {
	const targets = [];
	let reportPath;

	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--report") {
			const nextArgument = argv[index + 1];
			if (!nextArgument || nextArgument.startsWith("-")) {
				throw new Error(
					"`--report` requires a file path argument before any other flags.",
				);
			}
			reportPath = nextArgument;
			index += 1;
			continue;
		}

		if (argument.startsWith("--report=")) {
			const inlinePath = argument.slice("--report=".length);
			if (!inlinePath) {
				throw new Error("`--report` requires a non-empty file path.");
			}
			reportPath = inlinePath;
			continue;
		}

		targets.push(argument);
	}

	return {
		reportPath,
		targets: targets.length > 0 ? targets : DEFAULT_ROOTS,
	};
}

export async function runCli(argv = process.argv.slice(2)) {
	const { reportPath, targets } = parseCliArgs(argv);
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

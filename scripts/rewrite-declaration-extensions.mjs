import {
	existsSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const specifierPattern =
	/(?<prefix>\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)(?<quote>["'])(?<specifier>\.[^"']+)\k<quote>/g;

const publishedPackages = [
	"packages/ignite-core",
	"packages/ignite-adapters",
	"packages/ignite-renderer",
	"packages/ignite-element",
];

export function repositoryRoot() {
	return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

export function publishedPackageRoots(root = repositoryRoot()) {
	return publishedPackages.map((directory) => join(root, directory));
}

function declarationFiles(directory) {
	if (!existsSync(directory)) {
		return [];
	}

	const files = [];
	for (const entry of readdirSync(directory)) {
		const entryPath = join(directory, entry);
		if (statSync(entryPath).isDirectory()) {
			files.push(...declarationFiles(entryPath));
			continue;
		}
		if (entryPath.endsWith(".d.ts")) {
			files.push(entryPath);
		}
	}
	return files;
}

function hasExplicitExtension(specifier) {
	const last = specifier.split("/").pop() ?? specifier;
	return last !== "." && last !== ".." && /\.[a-zA-Z0-9]+$/.test(last);
}

export function rewriteSpecifier(specifier, fromFile) {
	if (!specifier.startsWith(".") || hasExplicitExtension(specifier)) {
		return specifier;
	}

	const absolute = resolve(dirname(fromFile), specifier);
	if (existsSync(`${absolute}.d.ts`)) {
		return `${specifier}.js`;
	}
	if (existsSync(join(absolute, "index.d.ts"))) {
		return specifier.endsWith("/")
			? `${specifier}index.js`
			: `${specifier}/index.js`;
	}

	throw new Error(
		`Cannot add a NodeNext extension to ${specifier} from ${fromFile}`,
	);
}

const vlqAlphabet =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function rewriteDeclarationText(text, fromFile) {
	const edits = [];
	const next = text.replace(
		specifierPattern,
		(match, prefix, quote, specifier, offset) => {
			const rewritten = rewriteSpecifier(specifier, fromFile);
			if (rewritten === specifier) {
				return match;
			}
			edits.push({
				index: offset + prefix.length + quote.length + specifier.length,
				delta: rewritten.length - specifier.length,
			});
			return `${prefix}${quote}${rewritten}${quote}`;
		},
	);
	return { text: next, edits };
}

function indexToLineColumn(text, index) {
	let line = 0;
	let column = 0;
	for (let cursor = 0; cursor < index; cursor += 1) {
		if (text.charCodeAt(cursor) === 10) {
			line += 1;
			column = 0;
			continue;
		}
		column += 1;
	}
	return { line, column };
}

function encodeVlq(value) {
	let vlq = value < 0 ? (-value << 1) + 1 : value << 1;
	let encoded = "";
	do {
		let digit = vlq & 31;
		vlq >>>= 5;
		if (vlq > 0) {
			digit |= 32;
		}
		encoded += vlqAlphabet[digit];
	} while (vlq > 0);
	return encoded;
}

function decodeVlq(segment, mapFile) {
	if (segment.length === 0) {
		throw new Error(
			`Malformed declaration map ${mapFile}: empty mapping segment`,
		);
	}
	const values = [];
	let index = 0;
	while (index < segment.length) {
		let value = 0;
		let shift = 0;
		let digit = 0;
		do {
			if (index >= segment.length) {
				throw new Error(`Malformed declaration map ${mapFile}: truncated VLQ`);
			}
			digit = vlqAlphabet.indexOf(segment[index]);
			index += 1;
			if (digit < 0) {
				throw new Error(`Malformed declaration map ${mapFile}: invalid VLQ`);
			}
			value += (digit & 31) << shift;
			shift += 5;
		} while (digit & 32);
		const negated = value & 1;
		value >>>= 1;
		values.push(negated ? -value : value);
	}
	return values;
}

function shiftMappings(mappings, editsByLine, mapFile) {
	return mappings
		.split(";")
		.map((line, lineIndex) => {
			if (line.length === 0) {
				return "";
			}
			const edits = editsByLine.get(lineIndex) ?? [];
			let originalGenerated = 0;
			let shiftedGenerated = 0;
			return line
				.split(",")
				.map((segment) => {
					const values = decodeVlq(segment, mapFile);
					originalGenerated += values[0];
					let columnShift = 0;
					for (const edit of edits) {
						if (edit.column <= originalGenerated) {
							columnShift += edit.delta;
						}
					}
					const generated = originalGenerated + columnShift;
					values[0] = generated - shiftedGenerated;
					shiftedGenerated = generated;
					return values.map((value) => encodeVlq(value)).join("");
				})
				.join(",");
		})
		.join(";");
}

function rewriteDeclarationMap(declarationFile, originalText, edits) {
	const mapFile = `${declarationFile}.map`;
	if (!existsSync(mapFile)) {
		return;
	}

	const mapText = readFileSync(mapFile, "utf8");
	let map;
	try {
		map = JSON.parse(mapText);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Malformed declaration map ${mapFile}: ${message}`, {
			cause: error,
		});
	}
	if (typeof map.mappings !== "string") {
		throw new Error(
			`Malformed declaration map ${mapFile}: mappings must be a string`,
		);
	}

	const editsByLine = new Map();
	for (const edit of edits) {
		const position = indexToLineColumn(originalText, edit.index);
		const lineEdits = editsByLine.get(position.line) ?? [];
		lineEdits.push({ column: position.column, delta: edit.delta });
		editsByLine.set(position.line, lineEdits);
	}

	map.mappings = shiftMappings(map.mappings, editsByLine, mapFile);
	const trailingNewline = mapText.endsWith("\n") ? "\n" : "";
	writeFileSync(mapFile, `${JSON.stringify(map)}${trailingNewline}`);
}

export function extensionlessRelativeSpecifiers(packageRoot) {
	const found = [];
	for (const file of declarationFiles(join(packageRoot, "dist", "types"))) {
		const text = readFileSync(file, "utf8");
		for (const match of text.matchAll(specifierPattern)) {
			const specifier = match.groups?.specifier;
			if (specifier && !hasExplicitExtension(specifier)) {
				found.push({ file, specifier });
			}
		}
	}
	return found;
}

export function rewritePackageDeclarations(packageRoot) {
	const files = declarationFiles(join(packageRoot, "dist", "types"));
	let rewritten = 0;

	for (const file of files) {
		const text = readFileSync(file, "utf8");
		const next = rewriteDeclarationText(text, file);
		if (next.text === text) {
			continue;
		}
		writeFileSync(file, next.text);
		rewriteDeclarationMap(file, text, next.edits);
		rewritten += 1;
	}

	const remaining = extensionlessRelativeSpecifiers(packageRoot);
	if (remaining.length > 0) {
		throw new Error(
			`Declaration rewrite left extensionless imports in ${packageRoot}: ${remaining
				.slice(0, 5)
				.map((item) => item.specifier)
				.join(", ")}`,
		);
	}

	return { files: files.length, rewritten };
}

function main() {
	const args = process.argv.slice(2);
	const roots =
		args.length > 0 ? args.map((arg) => resolve(arg)) : publishedPackageRoots();

	for (const root of roots) {
		const result = rewritePackageDeclarations(root);
		console.log(
			`[declarations] ${root}: rewrote ${result.rewritten} of ${result.files} declaration files`,
		);
	}
}

if (process.argv[1]?.endsWith("rewrite-declaration-extensions.mjs")) {
	main();
}

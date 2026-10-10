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

export function rewriteDeclarationText(text, fromFile) {
	return text.replace(specifierPattern, (match, prefix, quote, specifier) => {
		const rewritten = rewriteSpecifier(specifier, fromFile);
		return rewritten === specifier
			? match
			: `${prefix}${quote}${rewritten}${quote}`;
	});
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
		if (next === text) {
			continue;
		}
		writeFileSync(file, next);
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

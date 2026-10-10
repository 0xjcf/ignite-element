import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Names that must not appear in a published .d.ts. */
export const PUBLISHED_HOST_TYPE_NAMES = [
	"IgniteHostRuntime",
	"HOST_RUNTIME_FIELD",
	"syncHostElement",
	"describeIgniteHosts",
];

const DECLARATION_FILES = [
	"packages/ignite-renderer/dist/types/renderers/jsx/hostBridge.d.ts",
	"packages/ignite-element/dist/types/internal/hostRuntime.d.ts",
];

const RENDERER_DECLARATION =
	"packages/ignite-renderer/dist/types/renderers/jsx/renderer.d.ts";

function walkDeclarations(root, directory, hits) {
	if (!fs.existsSync(directory)) return;
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const fullPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			walkDeclarations(root, fullPath, hits);
			continue;
		}
		if (!entry.name.endsWith(".d.ts")) continue;
		const text = fs.readFileSync(fullPath, "utf8");
		const relativePath = path.relative(root, fullPath);
		for (const name of PUBLISHED_HOST_TYPE_NAMES) {
			const pattern = new RegExp(`\\b${name}\\b`);
			if (pattern.test(text)) hits.push({ file: relativePath, name });
		}
	}
}

export function findPublishedHostDeclarations(root) {
	const hits = [];
	for (const packageName of ["ignite-renderer", "ignite-element"]) {
		walkDeclarations(
			root,
			path.join(root, "packages", packageName, "dist", "types"),
			hits,
		);
	}
	return hits;
}

function stripRendererOptions(text) {
	// Leave the line break so declaration maps stay aligned. The NodeNext
	// rewriter has already turned ./hostBridge into ./hostBridge.js.
	const withoutImport = text.replace(
		/^import\s+(?:type\s+)?\{[^}]*\}\s+from\s+["']\.\/hostBridge(?:\.js)?["'];/gm,
		"",
	);
	return withoutImport.replace(/^[ \t]*hosts\?: IgniteHostRuntime;/gm, "");
}

function removeDeclaration(root, relativePath) {
	for (const suffix of ["", ".map"]) {
		const fullPath = path.join(root, `${relativePath}${suffix}`);
		if (fs.existsSync(fullPath)) fs.rmSync(fullPath);
	}
}

export function stripPublishedHostDeclarations(root) {
	for (const relativePath of DECLARATION_FILES) {
		removeDeclaration(root, relativePath);
	}
	const rendererDeclaration = path.join(root, RENDERER_DECLARATION);
	if (fs.existsSync(rendererDeclaration)) {
		const text = fs.readFileSync(rendererDeclaration, "utf8");
		fs.writeFileSync(rendererDeclaration, stripRendererOptions(text));
	}
	return findPublishedHostDeclarations(root);
}

const invokedDirectly =
	process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
	const root = fileURLToPath(new URL("..", import.meta.url));
	const hits = stripPublishedHostDeclarations(root);
	if (hits.length > 0) {
		console.error(
			hits.map((hit) => `${hit.file} names ${hit.name}`).join("\n"),
		);
		process.exit(1);
	}
}

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createUnplugin } from "unplugin";
import {
	AUTHOR_SOURCE,
	isRawCssSpecifier,
	transformSource,
} from "./transform.js";

const SOURCE = /\.[cm]?[jt]sx?$/;

function filePath(id: string): string {
	const query = id.indexOf("?");
	return query < 0 ? id : id.slice(0, query);
}

function shouldTransform(id: string): boolean {
	const file = filePath(id).split("\\").join("/");
	if (file.includes("/node_modules/")) return false;
	if (file.includes("/dist/")) return false;
	if (file.includes("/.ignite-jsx-shims/")) return false;
	return SOURCE.test(file);
}

export function loadRawCss(id: string): string | null {
	if (!isRawCssSpecifier(id)) return null;
	const file = filePath(id);
	if (!existsSync(file)) return null;
	return `export default ${JSON.stringify(readFileSync(file, "utf8"))};\n`;
}

function packageRoot(entry: string, name: string): string | null {
	let dir = path.dirname(entry);
	for (let depth = 0; depth < 6; depth += 1) {
		const file = path.join(dir, "package.json");
		if (existsSync(file)) {
			try {
				const parsed = JSON.parse(readFileSync(file, "utf8")) as {
					name?: string;
				};
				if (parsed.name === name) return dir;
			} catch {
				// A broken package.json is not this package.
			}
		}
		const parent = path.dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
	return null;
}

function rendererRoot(from: NodeRequire): string | null {
	try {
		return packageRoot(
			from.resolve("@ignite-element/renderer"),
			"@ignite-element/renderer",
		);
	} catch {
		// An app may depend on ignite-element, which depends on the renderer.
	}
	try {
		const elementRoot = packageRoot(
			from.resolve("ignite-element"),
			"ignite-element",
		);
		if (!elementRoot) return null;
		const fromElement = createRequire(path.join(elementRoot, "package.json"));
		return packageRoot(
			fromElement.resolve("@ignite-element/renderer"),
			"@ignite-element/renderer",
		);
	} catch {
		return null;
	}
}

function monorepoRendererRoot(importer: string | undefined): string | null {
	if (!importer) return null;
	let dir = path.dirname(filePath(importer));
	for (let depth = 0; depth < 8; depth += 1) {
		const root = path.join(dir, "packages", "ignite-renderer");
		const manifest = path.join(root, "package.json");
		if (existsSync(manifest)) {
			try {
				const parsed = JSON.parse(readFileSync(manifest, "utf8")) as {
					name?: string;
				};
				if (parsed.name === "@ignite-element/renderer") return root;
			} catch {
				// A broken package.json is not this package.
			}
		}
		const parent = path.dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
	return null;
}

function markFile(root: string, importer: string | undefined): string | null {
	const source = path.join(root, "src/renderers/jsx/authorStyle.ts");
	const dist = path.join(root, "dist/jsx/author-style-mark.es.js");
	const norm = (importer ?? "").split("\\").join("/");
	// Docs consume the published renderer. Examples and package tests alias
	// that renderer to source, so the mark has to be the same module.
	const sourceApp =
		!norm.includes("/docs/site/") &&
		(norm.includes("/examples/") || norm.includes("/packages/"));
	if (sourceApp && existsSync(source)) return source;
	if (existsSync(dist)) return dist;
	if (existsSync(source)) return source;
	return null;
}

export function resolveAuthorMark(importer: string | undefined): string | null {
	const norm = (importer ?? "").split("\\").join("/");
	// The plugin's own bundler fixture shims this specifier. App files,
	// including the docs site, need the real mark module.
	if (norm.includes("/packages/jsx-plugin/")) return null;
	// Example installs resolve the published renderer, which has no mark file.
	// Their Vite aliases point at this repo's source, so the mark does too.
	if (norm.includes("/examples/")) {
		const root = monorepoRendererRoot(importer);
		if (root) {
			const mark = markFile(root, importer);
			if (mark) return mark;
		}
	}
	const bases = [importer, fileURLToPath(import.meta.url)];
	for (const base of bases) {
		if (!base) continue;
		try {
			const root = rendererRoot(createRequire(base));
			if (!root) continue;
			const mark = markFile(root, importer);
			if (mark) return mark;
		} catch {
			// The next base may be the app file that can see ignite-element.
		}
	}
	return null;
}

export function resolveRawCss(
	id: string,
	importer: string | undefined,
): string | null {
	if (!importer || !isRawCssSpecifier(id)) return null;
	const queryAt = id.indexOf("?");
	const specifier = queryAt < 0 ? id : id.slice(0, queryAt);
	const query = queryAt < 0 ? "" : id.slice(queryAt);
	const resolved = path.isAbsolute(specifier)
		? specifier
		: path.resolve(path.dirname(importer), specifier);
	if (!existsSync(resolved)) return null;
	return resolved + query;
}

export const igniteJsx = createUnplugin(() => ({
	name: "ignite-jsx",
	enforce: "pre",
	resolveId: {
		filter: { id: /\.css\?raw(?:&|$)|jsx\/author-style$/ },
		handler(id, importer) {
			if (id === AUTHOR_SOURCE) return resolveAuthorMark(importer);
			return resolveRawCss(id, importer);
		},
	},
	loadInclude(id) {
		return isRawCssSpecifier(id);
	},
	load(id) {
		return loadRawCss(id);
	},
	transformInclude(id) {
		return shouldTransform(id);
	},
	transform(code, id) {
		if (!shouldTransform(id)) return null;
		const next = transformSource(code, filePath(id));
		if (next === code) return null;
		return { code: next, map: null };
	},
	esbuild: {
		onResolveFilter: /\.css\?raw|jsx\/author-style$/,
		onLoadFilter: /\.[cm]?[jt]sx?$/,
		setup(build) {
			build.onResolve({ filter: /jsx\/author-style$/ }, (args) => {
				if (args.path !== AUTHOR_SOURCE) return null;
				const resolved = resolveAuthorMark(args.importer);
				if (!resolved) return null;
				return { path: resolved };
			});
			build.onLoad({ filter: /\.css/, namespace: "ignite-jsx" }, (args) => {
				const contents = loadRawCss(args.path + (args.suffix || ""));
				if (contents == null) return null;
				return { contents, loader: "js" };
			});
		},
	},
}));

export default igniteJsx;

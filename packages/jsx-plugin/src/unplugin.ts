import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createUnplugin } from "unplugin";
import {
	AUTHOR_SOURCE,
	AUTHOR_VIRTUAL,
	isBlockedAuthorSpecifier,
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
		!norm.includes("/packages/jsx-plugin/") &&
		(norm.includes("/examples/") || norm.includes("/packages/"));
	if (sourceApp && existsSync(source)) return source;
	if (existsSync(dist)) return dist;
	if (existsSync(source)) return source;
	return null;
}

const markedImporters = new Set<string>();

function rememberImporter(id: string): void {
	const file = filePath(id);
	markedImporters.add(file);
	markedImporters.add(path.resolve(file));
}

function importerWasMarked(importer: string | undefined): boolean {
	if (!importer) return false;
	const file = filePath(importer);
	return markedImporters.has(file) || markedImporters.has(path.resolve(file));
}

function pluginFile(): string | null {
	try {
		const url = import.meta.url;
		if (typeof url === "string" && url.length > 0) return fileURLToPath(url);
	} catch {
		// A CJS build replaces import.meta with {}. fileURLToPath(undefined) throws.
	}
	if (typeof __filename === "string" && __filename.length > 0)
		return __filename;
	return null;
}

function libraryOwnsMark(importer: string | undefined): boolean {
	if (!importer) return false;
	const norm = filePath(importer).split("\\").join("/");
	if (norm.includes("/packages/jsx-plugin/")) return false;
	if (norm.includes("/.ignite-jsx-shims/")) return false;
	return (
		norm.includes("/packages/ignite-renderer/") ||
		norm.includes("/packages/ignite-element/") ||
		norm.includes("/node_modules/@ignite-element/renderer/") ||
		norm.includes("/node_modules/ignite-element/")
	);
}

function claimsAuthor(id: string, importer: string | undefined): boolean {
	if (isBlockedAuthorSpecifier(id)) return true;
	if (!id.startsWith(".") || !importer) return false;
	const resolved = path.resolve(
		path.dirname(filePath(importer)),
		id.split("?")[0],
	);
	return isBlockedAuthorSpecifier(resolved);
}

function blockedAuthor(id: string): Error {
	return new Error(
		`An application import from "${id}" cannot mark CSS. The ignite JSX plugin marks static <style> text itself.`,
	);
}

/**
 * Resolve the private compiler id, and nothing else.
 * `null` means this id is not an author route. A thrown error is a refused route.
 * The returned path is the real mark file.
 */
export function resolveAuthorRequest(
	id: string,
	importer: string | undefined,
): string | null {
	if (isRawCssSpecifier(id)) return null;
	if (id === AUTHOR_VIRTUAL) {
		if (!importerWasMarked(importer)) throw blockedAuthor(id);
		const mark = resolveAuthorMark(importer);
		if (!mark) {
			throw new Error(
				"The ignite JSX plugin could not find the author mark module.",
			);
		}
		return mark;
	}
	if (!claimsAuthor(id, importer)) return null;
	if (id.startsWith(".") && libraryOwnsMark(importer)) return null;
	// The private id resolves to this absolute file. The bundler asks again
	// for that path. A file the plugin did not mark still cannot import it.
	if (importerWasMarked(importer) && path.isAbsolute(filePath(id))) return null;
	throw blockedAuthor(id);
}

export function resolveAuthorMark(importer: string | undefined): string | null {
	const norm = (importer ?? "").split("\\").join("/");
	// Example installs resolve the published renderer, which has no mark file.
	// Their Vite aliases point at this repo's source, so the mark does too.
	if (norm.includes("/examples/")) {
		const root = monorepoRendererRoot(importer);
		if (root) {
			const mark = markFile(root, importer);
			if (mark) return mark;
		}
	}
	const bases = [importer, pluginFile()];
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
	const walked =
		monorepoRendererRoot(importer) ??
		monorepoRendererRoot(pluginFile() ?? undefined);
	if (walked) return markFile(walked, importer);
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

const AUTHOR_ID = /author-style|authorStyle|\0ignite-jsx:author-style/;

export const igniteJsx = createUnplugin((_options, meta) => ({
	name: "ignite-jsx",
	enforce: "pre",
	resolveId: {
		filter: {
			id: /\.css\?raw(?:&|$)|author-style|authorStyle|\0ignite-jsx:author-style/,
		},
		handler(id, importer) {
			if (isRawCssSpecifier(id)) return resolveRawCss(id, importer);
			// unplugin's esbuild host forces namespace to the plugin name.
			// Returning null lets esbuild.setup answer with namespace "file".
			if (meta.framework === "esbuild") return null;
			try {
				return resolveAuthorRequest(id, importer);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				// Rollup and Vite throw from this.error. Webpack records it and
				// needs a null return, or the resolve hook never calls back.
				this.error(message);
				return null;
			}
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
		rememberImporter(id);
		return { code: next, map: null };
	},
	esbuild: {
		onResolveFilter: /\.css\?raw/,
		onLoadFilter: /\.[cm]?[jt]sx?$/,
		setup(build) {
			build.onResolve({ filter: AUTHOR_ID }, (args) => {
				if (args.path === AUTHOR_SOURCE) {
					return {
						errors: [
							{
								text: `An application import from "${args.path}" cannot mark CSS. The ignite JSX plugin marks static <style> text itself.`,
							},
						],
					};
				}
				try {
					const resolved = resolveAuthorRequest(args.path, args.importer);
					if (!resolved) return null;
					return { path: resolved, namespace: "file" };
				} catch (error) {
					return {
						errors: [
							{
								text: error instanceof Error ? error.message : String(error),
							},
						],
					};
				}
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

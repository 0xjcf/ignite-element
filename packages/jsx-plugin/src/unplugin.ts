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
	if (file.includes("/.ignite-jsx-shims/")) return false;
	return SOURCE.test(file);
}

export function loadRawCss(id: string): string | null {
	if (!isRawCssSpecifier(id)) return null;
	const file = filePath(id);
	if (!existsSync(file)) return null;
	return `export default ${JSON.stringify(readFileSync(file, "utf8"))};\n`;
}

export function resolveAuthorMark(importer: string | undefined): string | null {
	const bases = [importer, fileURLToPath(import.meta.url)];
	for (const base of bases) {
		if (!base) continue;
		try {
			const require = createRequire(base);
			const pkg = require.resolve("@ignite-element/renderer/package.json");
			const root = path.dirname(pkg);
			const source = path.join(root, "src/renderers/jsx/authorStyle.ts");
			if (existsSync(source)) return source;
			const dist = path.join(root, "dist/jsx/author-style-mark.es.js");
			if (existsSync(dist)) return dist;
		} catch {
			// The next base may be the app file that can see the renderer package.
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

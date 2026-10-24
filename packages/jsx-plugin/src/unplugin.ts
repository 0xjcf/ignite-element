import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createUnplugin } from "unplugin";
import { isRawCssSpecifier, transformSource } from "./transform.js";

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
		filter: { id: /\.css\?raw(?:&|$)/ },
		handler(id, importer) {
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
		onResolveFilter: /\.css\?raw/,
		onLoadFilter: /\.[cm]?[jt]sx?$/,
		setup(build) {
			build.onLoad({ filter: /\.css/, namespace: "ignite-jsx" }, (args) => {
				const contents = loadRawCss(args.path + (args.suffix || ""));
				if (contents == null) return null;
				return { contents, loader: "js" };
			});
		},
	},
}));

export default igniteJsx;

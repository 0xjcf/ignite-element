import {
	existsSync,
	lstatSync,
	readdirSync,
	readFileSync,
	realpathSync,
} from "node:fs";
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

function realpathOf(file: string): string {
	try {
		return realpathSync(file);
	} catch {
		return path.resolve(file);
	}
}

function isMarkFile(file: string): boolean {
	return isBlockedAuthorSpecifier(realpathOf(file).split("\\").join("/"));
}

function isAuthorBridge(id: string): boolean {
	const file = filePath(id).split("\\").join("/");
	return /(?:^|\/)author-style-resolve(?:\.js)?$/.test(file);
}

function libraryImporter(importer: string | undefined): boolean {
	if (!importer) return false;
	const file = filePath(importer);
	let real = file;
	try {
		if (lstatSync(file).isSymbolicLink()) return false;
		real = realpathOf(file);
	} catch {
		real = path.resolve(file);
	}
	const norm = real.split("\\").join("/");
	if (norm.includes("/.ignite-jsx-shims/")) return false;
	if (norm.includes("/packages/jsx-plugin/")) return false;
	let dir = path.dirname(real);
	for (let depth = 0; depth < 8; depth += 1) {
		const manifest = path.join(dir, "package.json");
		if (existsSync(manifest)) {
			try {
				const parsed = JSON.parse(readFileSync(manifest, "utf8")) as {
					name?: string;
				};
				if (parsed.name === "@ignite-element/renderer") return true;
				if (parsed.name === "ignite-element") return norm.includes("/dist/");
				return false;
			} catch {
				// A broken package.json is not this package.
			}
		}
		const parent = path.dirname(dir);
		if (parent === dir) return false;
		dir = parent;
	}
	return false;
}

const issuedExact = new Set<string>();

function sourceMentionsAuthorMark(importer: string | undefined): boolean {
	if (!importer) return false;
	const file = filePath(importer);
	if (!existsSync(file)) return false;
	let text = "";
	try {
		text = readFileSync(file, "utf8");
	} catch {
		return false;
	}
	if (
		/import\s*\(\s*`[^`]*author-style|require\s*\(\s*`[^`]*author-style/.test(
			text,
		)
	) {
		return true;
	}
	const specs = text.matchAll(
		/(?:from\s*|import\s*\(\s*|require\s*\(\s*|export\s+[^;]*?\sfrom\s*)["']([^"']+)["']/g,
	);
	for (const match of specs) {
		const spec = match[1] ?? "";
		if (/author-style|authorStyle/.test(spec)) return true;
		if (!spec.startsWith(".")) continue;
		const resolved = path.resolve(
			path.dirname(file),
			spec.split("?")[0] ?? spec,
		);
		if (isMarkFile(resolved)) return true;
	}
	return false;
}

function allowIssuedFollowUp(
	id: string,
	importer: string | undefined,
): boolean {
	if (!importerWasMarked(importer)) return false;
	if (sourceMentionsAuthorMark(importer)) return false;
	const requested = filePath(id);
	if (!path.isAbsolute(requested)) return false;
	return issuedExact.has(path.resolve(requested));
}

function claimsAuthor(id: string, importer: string | undefined): boolean {
	if (isBlockedAuthorSpecifier(id)) return true;
	if (isAuthorBridge(id)) return true;
	if (!id.startsWith(".") || !importer) return false;
	const resolved = path.resolve(
		path.dirname(filePath(importer)),
		id.split("?")[0] ?? id,
	);
	if (isBlockedAuthorSpecifier(resolved)) return true;
	return isMarkFile(resolved);
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
function rememberedMark(importer: string | undefined): string {
	const mark = resolveAuthorMark(importer);
	if (!mark) {
		throw new Error(
			"The ignite JSX plugin could not find the author mark module.",
		);
	}
	const real = realpathOf(mark);
	issuedExact.add(path.resolve(real));
	return real;
}

export function resolveAuthorRequest(
	id: string,
	importer: string | undefined,
): string | null {
	if (isRawCssSpecifier(id)) return null;
	if (isAuthorBridge(id)) {
		if (!libraryImporter(importer)) throw blockedAuthor(id);
		return rememberedMark(importer);
	}
	if (id === AUTHOR_VIRTUAL) {
		if (!importerWasMarked(importer)) throw blockedAuthor(id);
		return rememberedMark(importer);
	}
	if (!claimsAuthor(id, importer)) return null;
	// Library dist may import the mark by a relative path or by the absolute
	// path a resolver already computed. App code may not.
	if (libraryImporter(importer)) return null;
	// The private id resolves to an absolute file. The bundler asks again.
	// That follow-up is the path this plugin just issued, from a file whose
	// own source does not name the mark.
	if (allowIssuedFollowUp(id, importer)) return null;
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

type ParsedModule = {
	id: string;
	importedIds?: readonly string[];
	ast?: { body?: unknown[] } | null;
};

type GuardHost = {
	resolve: (
		source: string,
		importer: string | undefined,
		options: { skipSelf?: boolean },
	) => Promise<{ id: string } | null>;
	error: (message: string) => void;
};

function collectImportSources(node: unknown, out: string[]): void {
	if (!node || typeof node !== "object") return;
	const record = node as Record<string, unknown>;
	const type = record.type;
	const source = record.source as { value?: unknown } | undefined;
	if (
		(type === "ImportDeclaration" ||
			type === "ExportAllDeclaration" ||
			type === "ExportNamedDeclaration" ||
			type === "ImportExpression") &&
		typeof source?.value === "string"
	) {
		out.push(source.value);
	}
	if (type === "ImportExpression" || type === "CallExpression") {
		const template = source ?? (record.arguments as unknown[] | undefined)?.[0];
		const quasis = (
			template as
				| { quasis?: Array<{ value?: { cooked?: string; raw?: string } }> }
				| undefined
		)?.quasis;
		if (
			quasis?.some((quasi) =>
				/author-style|authorStyle/.test(
					quasi.value?.cooked ?? quasi.value?.raw ?? "",
				),
			)
		) {
			out.push("author-style");
		}
	}
	for (const [key, value] of Object.entries(record)) {
		if (key === "loc" || key === "range" || key === "start" || key === "end")
			continue;
		if (Array.isArray(value)) {
			for (const item of value) collectImportSources(item, out);
			continue;
		}
		if (value && typeof value === "object") collectImportSources(value, out);
	}
}

function readModuleAst(info: ParsedModule): unknown {
	try {
		return info.ast ?? null;
	} catch {
		// Rolldown's ModuleInfo#ast throws. importedIds is the fallback.
		return null;
	}
}

async function guardParsedModule(
	host: GuardHost,
	info: ParsedModule,
): Promise<void> {
	if (libraryImporter(info.id)) return;
	const sources: string[] = [];
	const ast = readModuleAst(info);
	if (ast) collectImportSources(ast, sources);
	else {
		for (const imported of info.importedIds ?? []) {
			if (!isMarkFile(filePath(imported)) && !isAuthorBridge(imported))
				continue;
			if (allowIssuedFollowUp(imported, info.id)) continue;
			host.error(blockedAuthor(imported).message);
			return;
		}
		return;
	}
	for (const spec of sources) {
		if (spec === AUTHOR_VIRTUAL) continue;
		if (allowIssuedFollowUp(spec, info.id)) continue;
		if (
			spec === "author-style" ||
			isBlockedAuthorSpecifier(spec) ||
			isAuthorBridge(spec)
		) {
			host.error(blockedAuthor(spec).message);
			return;
		}
		let resolved: { id: string } | null = null;
		try {
			resolved = await host.resolve(spec, info.id, { skipSelf: true });
		} catch (error) {
			host.error(
				error instanceof Error ? error.message : blockedAuthor(spec).message,
			);
			return;
		}
		if (!resolved?.id) continue;
		if (isMarkFile(filePath(resolved.id)) || isAuthorBridge(resolved.id)) {
			host.error(blockedAuthor(spec).message);
			return;
		}
	}
}

type WebpackLike = {
	hooks: {
		normalModuleFactory: {
			tap: (name: string, fn: (factory: WebpackFactory) => void) => void;
		};
		contextModuleFactory: {
			tap: (name: string, fn: (factory: WebpackContextFactory) => void) => void;
		};
	};
};

type WebpackFactory = {
	hooks: {
		afterResolve: {
			tap: (
				name: string,
				fn: (data: {
					request: string;
					contextInfo?: { issuer?: string };
					createData?: { resource?: string };
					dependencies?: Array<{ request?: string; userRequest?: string }>;
				}) => void,
			) => void;
		};
	};
};

type WebpackContextFactory = {
	hooks: {
		alternativeRequests: {
			tap: (
				name: string,
				fn: (
					requests: Array<{ context: string; request: string }>,
				) => Array<{ context: string; request: string }>,
			) => void;
		};
	};
};

function userRequests(data: {
	request: string;
	dependencies?: Array<{ request?: string; userRequest?: string }>;
}): string[] {
	const fromDeps = (data.dependencies ?? []).flatMap((dep) =>
		[dep.userRequest, dep.request].filter(
			(value): value is string => typeof value === "string" && value.length > 0,
		),
	);
	return fromDeps.length > 0 ? fromDeps : [data.request];
}

function contextWouldLoadMark(dir: string, request: string): boolean {
	const resolved = path.resolve(dir, request);
	if (isMarkFile(resolved) || isAuthorBridge(resolved)) return true;
	try {
		if (!lstatSync(dir).isDirectory()) return false;
		for (const name of readdirSync(dir)) {
			if (!/author-style|authorStyle/.test(name) && !request.includes(name))
				continue;
			if (isMarkFile(path.join(dir, name))) return true;
		}
	} catch {
		return false;
	}
	return false;
}

function installBundlerGuards(compiler: WebpackLike): void {
	compiler.hooks.normalModuleFactory.tap("ignite-jsx", (factory) => {
		factory.hooks.afterResolve.tap("ignite-jsx", (data) => {
			const resource = data.createData?.resource;
			if (!resource) return;
			if (!isMarkFile(resource) && !isAuthorBridge(resource)) return;
			const issuer = data.contextInfo?.issuer;
			if (libraryImporter(issuer)) return;
			const requests = userRequests(data);
			if (
				requests.some(
					(request) =>
						request === AUTHOR_VIRTUAL ||
						request.includes("\0ignite-jsx:author-style"),
				)
			) {
				return;
			}
			if (requests.every((request) => allowIssuedFollowUp(request, issuer)))
				return;
			throw blockedAuthor(requests[0] ?? resource);
		});
	});
	compiler.hooks.contextModuleFactory.tap("ignite-jsx", (factory) => {
		const alternatives = factory.hooks.alternativeRequests;
		if (!alternatives?.tap) return;
		alternatives.tap("ignite-jsx", (requests) => {
			for (const request of requests) {
				if (contextWouldLoadMark(request.context, request.request)) {
					throw blockedAuthor(request.request);
				}
			}
			return requests;
		});
	});
}

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
	rollup: {
		async moduleParsed(info) {
			await guardParsedModule(this, info);
		},
	},
	vite: {
		async moduleParsed(info) {
			await guardParsedModule(this, info);
		},
	},
	rolldown: {
		async moduleParsed(info) {
			await guardParsedModule(this, info);
		},
	},
	webpack(compiler) {
		installBundlerGuards(compiler as unknown as WebpackLike);
	},
	rspack(compiler) {
		installBundlerGuards(compiler as unknown as WebpackLike);
	},
	esbuild: {
		onResolveFilter: /\.css\?raw/,
		onLoadFilter: /\.[cm]?[jt]sx?$/,
		setup(build) {
			const deny = (text: string) => ({ errors: [{ text }] });
			build.onResolve({ filter: AUTHOR_ID }, (args) => {
				if (args.pluginData?.igniteSkip) return null;
				if (args.path === AUTHOR_SOURCE) {
					return deny(blockedAuthor(args.path).message);
				}
				try {
					const resolved = resolveAuthorRequest(args.path, args.importer);
					if (!resolved) return null;
					return { path: resolved, namespace: "file" };
				} catch (error) {
					return deny(error instanceof Error ? error.message : String(error));
				}
			});
			build.onResolve({ filter: /.*/ }, async (args) => {
				if (args.pluginData?.igniteSkip) return null;
				if (args.path === AUTHOR_VIRTUAL || AUTHOR_ID.test(args.path))
					return null;
				if (args.path.startsWith("\0")) return null;
				const resolved = await build.resolve(args.path, {
					importer: args.importer,
					resolveDir: args.resolveDir,
					kind: args.kind,
					pluginData: { igniteSkip: true },
				});
				if (resolved.errors?.length || !resolved.path) return null;
				const real = realpathOf(resolved.path);
				if (!isMarkFile(real) && !isAuthorBridge(real)) return null;
				if (libraryImporter(args.importer)) return null;
				if (allowIssuedFollowUp(args.path, args.importer)) return null;
				return deny(blockedAuthor(args.path).message);
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

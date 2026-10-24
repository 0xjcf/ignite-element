/**
 * Node 22 gzip of the real JSX renderer with each spike policy patched in
 * memory. Does not edit packages/ or the PR size-test constants.
 *
 * No-host matches scripts/__tests__/host-jsx-size.test.mjs (vite lib, esbuild
 * minify, gzip level 6, __IGNITE_HOST_RUNTIME__ false).
 * Consumer-shaped matches the Vite production consumer (gzip level 9) but
 * imports the renderer source, not dist, so the absolute number is not the
 * official 8,790. The delta against this script's own baseline is the
 * comparison. Caps stay 7,564 and 8,810.
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { build } from "vite";

const nodeMajor = Number(process.versions.node.split(".", 1)[0]);
assert.ok(nodeMajor >= 22, `need Node 22, got ${process.versions.node}`);

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const guardPath = path.join(
	repoRoot,
	"packages/ignite-renderer/src/renderers/jsx/xssGuard.ts",
);
const rendererPath = path.join(
	repoRoot,
	"packages/ignite-renderer/src/renderers/jsx/renderer.ts",
);
const jsxRuntime = JSON.stringify(
	path.join(repoRoot, "packages/ignite-renderer/src/renderers/jsx/jsx-runtime.ts"),
);
const jsxRenderer = JSON.stringify(rendererPath);
const jsxEntry = JSON.stringify(
	path.join(repoRoot, "packages/ignite-renderer/src/renderers/ignite-jsx.ts"),
);

const NOHOST_CAP = 7564;
const CONSUMER_CAP = 8810;

function mustReplace(code, from, to, label) {
	const count = code.split(from).length - 1;
	if (count !== 1) {
		throw new Error(`${label} matched ${count} times`);
	}
	return code.replace(from, to);
}

function patchGuard(code, variant) {
	if (variant === "baseline") return code;
	let next = code;
	next = mustReplace(
		next,
		`	let full = "";
	const trustedAt: boolean[] = [];
	for (const child of children) {
		if (child.kind !== "text" || typeof child.value !== "string") continue;
		full += child.value;
		const trusted = child.trusted === true;
		for (let index = 0; index < child.value.length; index += 1) {
			trustedAt.push(trusted);
		}
	}`,
		`	let full = "";
	for (const child of children) {
		if (child.kind !== "text" || typeof child.value !== "string") continue;
		full += child.value;
	}`,
		"trustedAt loop",
	);
	next = mustReplace(
		next,
		`		if (untrustedCssBlocked(part)) {
			for (let index = span.start; index < span.end; index += 1) {
				if (!trustedAt[index]) {
					drop = true;
					break;
				}
			}
		}`,
		`		if (untrustedCssBlocked(part, scriptOnly)) drop = true;`,
		"trusted span",
	);
	next = mustReplace(
		next,
		`export function styleSheetFromChildren(
	children: ReadonlyArray<{ kind: string; value?: string; trusted?: boolean }>,
): { css: string; droppedUrl: boolean } {`,
		`export function styleSheetFromChildren(
	children: ReadonlyArray<{ kind: string; value?: string; trusted?: boolean }>,
	scriptOnly?: boolean,
): { css: string; droppedUrl: boolean } {`,
		"styleSheet signature",
	);
	next = mustReplace(
		next,
		`	if (
		!value ||
		typeof value !== "object" ||
		readTrustedStyle(value) !== undefined
	) {
		return value;
	}`,
		`	if (!value || typeof value !== "object") return value;`,
		"cssText trusted return",
	);
	next = mustReplace(
		next,
		`	const trusted = trustedLookup(value);
	if (typeof trusted === "string") return trusted;
	if (trusted === false) return false;
	if (value == null) return undefined;`,
		`	if (value == null) return undefined;`,
		"cssValue trusted",
	);
	next = mustReplace(
		next,
		`function untrustedCssBlocked(text: string): boolean {
	// Raw text catches a loader a string-delimited \`/*\` would hide.
	// Comment removal catches \`url /**/ (\`.
	return (
		text.includes("\\\\") ||
		CSS_LOADER.test(text) ||
		CSS_LOADER.test(withoutComments(text))
	);
}`,
		`const SCRIPTABLE =
	/(?:expression\\s*\\(|-moz-binding|(?:^|[^\\-\\w])behavior\\b)/i;
function untrustedCssBlocked(text: string, scriptOnly?: boolean): boolean {
	const pattern = scriptOnly ? SCRIPTABLE : CSS_LOADER;
	if (!scriptOnly && text.includes("\\\\")) return true;
	return pattern.test(text) || pattern.test(withoutComments(text));
}`,
		"untrustedCssBlocked",
	);
	if (variant === "a") {
		const loaderStart = next.indexOf("const CSS_LOADER =");
		const loaderEnd = next.indexOf(";", loaderStart);
		if (loaderStart < 0 || loaderEnd < 0) {
			throw new Error("narrow CSS_LOADER matched 0 times");
		}
		next =
			next.slice(0, loaderStart) +
			"const CSS_LOADER =\n\t/(?:expression\\s*\\(|-moz-binding|(?:^|[^-\\w])behavior\\b)/i;" +
			next.slice(loaderEnd + 1);
		next = mustReplace(
			next,
			`	if (!scriptOnly && text.includes("\\\\")) return true;
	return pattern.test(text) || pattern.test(withoutComments(text));`,
			`	return pattern.test(text) || pattern.test(withoutComments(text));`,
			"drop backslash",
		);
		next = mustReplace(
			next,
			`		untrustedCssBlocked(name + ":" + text) ||
		/^\\s*\\(/.test(text)`,
			`		untrustedCssBlocked(name + ":" + text)`,
			"drop paren guard",
		);
	}
	return next;
}

function patchRenderer(code, variant) {
	if (variant === "baseline") return code;
	let next = code;
	next = mustReplace(next, `\n	readTrustedStyle,\n`, "\n", "drop readTrustedStyle import");
	next = mustReplace(
		next,
		`	if (!isIgniteJsxElement(node)) {
		const trusted = readTrustedStyle(node);
		if (trusted !== undefined) {
			return [{ kind: "text", value: trusted, trusted: true }];
		}
		return [`,
		variant === "c"
			? `	if (!isIgniteJsxElement(node)) {
		const author = authorCss(node);
		if (author !== undefined) {
			return [{ kind: "text", value: author, trusted: true }];
		}
		return [`
			: `	if (!isIgniteJsxElement(node)) {
		return [`,
		"normalizeChild brand",
	);
	next = mustReplace(
		next,
		`	const trusted = readTrustedStyle(next);
	if (trusted !== undefined) {
		if (getContained(style, "cssText") !== trusted) {
			setContained(style, "cssText", trusted);
		}
		return;
	}

	if (typeof next === "object") {
		const prevIsMap =
			!!prev &&
			typeof prev === "object" &&
			readTrustedStyle(prev) === undefined;`,
		`	if (typeof next === "object") {
		const prevIsMap = !!prev && typeof prev === "object";`,
		"patchStyle brand",
	);
	if (variant === "b") {
		next = mustReplace(
			next,
			`		const sheet = styleSheetFromChildren(normalizedChildren);`,
			`		const sheet = styleSheetFromChildren(normalizedChildren, true);`,
			"B style element scriptOnly",
		);
	}
	if (variant === "c") {
		next = mustReplace(
			next,
			`		const sheet = styleSheetFromChildren(normalizedChildren);`,
			`		const authored = normalizedChildren.some((child) => child.kind === "text" && child.trusted === true) && normalizedChildren.every((child) => child.kind !== "text" || child.trusted === true);
		const sheet = styleSheetFromChildren(normalizedChildren, authored);`,
			"C author sheet",
		);
		next = mustReplace(
			next,
			`const hostRuntimeEnabled =`,
			`const AUTHOR_CSS = Symbol();
function authorCss(node: unknown): string | undefined {
	if (!node || typeof node !== "object") return undefined;
	const css = (node as Record<symbol, unknown>)[AUTHOR_CSS];
	return typeof css === "string" ? css : undefined;
}
const hostRuntimeEnabled =`,
			"C author symbol",
		);
	}
	if (next.includes("readTrustedStyle")) {
		throw new Error(`${variant} renderer still references readTrustedStyle`);
	}
	return next;
}

function policyPlugin(variant) {
	return {
		name: "spike-style-policy",
		enforce: "pre",
		transform(code, id) {
			if (id.endsWith("/xssGuard.ts")) return patchGuard(code, variant);
			if (id.endsWith("/jsx/renderer.ts")) return patchRenderer(code, variant);
			return null;
		},
	};
}

async function bundle(source, variant) {
	const dir = await mkdtemp(path.join(tmpdir(), "ignite-spike-style-"));
	const entry = path.join(dir, "entry.mjs");
	try {
		await writeFile(entry, source);
		const bundleResult = await build({
			configFile: false,
			define: {
				"process.env.NODE_ENV": JSON.stringify("production"),
				__IGNITE_DEV_WARNINGS__: JSON.stringify(false),
				__IGNITE_HOST_RUNTIME__: JSON.stringify(false),
			},
			plugins: [policyPlugin(variant)],
			build: {
				emptyOutDir: false,
				lib: { entry, fileName: "entry", formats: ["es"] },
				minify: "esbuild",
				rollupOptions: { output: { inlineDynamicImports: true } },
				sourcemap: false,
				target: "es2020",
				write: false,
			},
			logLevel: "silent",
			root: repoRoot,
		});
		const outputs = Array.isArray(bundleResult)
			? bundleResult.flatMap((item) => item.output)
			: bundleResult.output;
		return outputs
			.filter((output) => output.type === "chunk")
			.map((output) => output.code)
			.join("\n");
	} finally {
		await rm(dir, { force: true, recursive: true });
	}
}

const noHostEntry = `
	import { jsx } from ${jsxRuntime};
	import { renderIgniteJsx } from ${jsxRenderer};
	export function render(host) {
		return renderIgniteJsx(host, jsx("div", { children: "hello" }));
	}
`;

const consumerEntry = `
	import { jsx, mountIgniteJsxOnce } from ${jsxEntry};
	export function render(host) {
		return mountIgniteJsxOnce(host, jsx("div", { children: "hello" }));
	}
`;

const variants = ["baseline", "a", "b", "c"];
const results = [];
for (const variant of variants) {
	const noHost = await bundle(noHostEntry, variant);
	const consumer = await bundle(consumerEntry, variant);
	const row = {
		variant,
		noHostGzip6: gzipSync(noHost).byteLength,
		consumerSourceGzip9: gzipSync(Buffer.from(consumer), { level: 9 }).byteLength,
		noHostHasTrusted: noHost.includes("trustedStyle"),
		noHostHasWeakSet: noHost.includes("WeakSet"),
	};
	results.push(row);
	console.log(JSON.stringify(row));
}

const baseline = results[0];
const report = {
	node: process.version,
	caps: { noHostGzip6: NOHOST_CAP, consumerGzip9: CONSUMER_CAP },
	officialAtHead: { noHostGzip6: 7544, consumerDistGzip9: 8790 },
	note: "noHostGzip6 uses the official no-host entry and matched 7544 at baseline. consumerSourceGzip9 imports renderer source via mountIgniteJsxOnce, not the published dist chunk, so its absolute size is not the official 8790. estimatedOfficialConsumer = 8790 + consumerSourceDelta. Caps were not changed.",
	rows: results.map((row) => {
		const noHostDelta = row.noHostGzip6 - baseline.noHostGzip6;
		const consumerSourceDelta =
			row.consumerSourceGzip9 - baseline.consumerSourceGzip9;
		const estimatedOfficialConsumer = 8790 + consumerSourceDelta;
		return {
			...row,
			noHostDelta,
			consumerSourceDelta,
			estimatedOfficialConsumer,
			noHostFitsCap: row.noHostGzip6 <= NOHOST_CAP,
			estimatedConsumerFitsCap: estimatedOfficialConsumer <= CONSUMER_CAP,
		};
	}),
};
const out = path.join(here, "size-results.json");
await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(`wrote ${out}`);

const guard = await readFile(guardPath, "utf8");
const renderer = await readFile(rendererPath, "utf8");
for (const variant of variants) {
	patchGuard(guard, variant);
	patchRenderer(renderer, variant);
}

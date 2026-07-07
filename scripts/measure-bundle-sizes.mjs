#!/usr/bin/env node
import { gzipSync } from "node:zlib";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";

const repoRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const defaultPackageRoot = path.join(repoRoot, "packages", "ignite-element");
const transitivePeerPackages = ["@actor-web/runtime"];

function stripLeadingDotSlash(filePath) {
	return filePath.startsWith("./") ? filePath.slice(2) : filePath;
}

function specifierForSubpath(packageName, subpath) {
	return subpath === "." ? packageName : `${packageName}/${subpath.slice(2)}`;
}

function readStringFlag(rawArgs, name, defaultValue) {
	const assignmentPrefix = `${name}=`;
	const index = rawArgs.findIndex(
		(arg) => arg === name || arg.startsWith(assignmentPrefix),
	);
	if (index === -1) return defaultValue;

	const matchedArg = rawArgs[index];
	const value = matchedArg.startsWith(assignmentPrefix)
		? matchedArg.slice(assignmentPrefix.length)
		: rawArgs[index + 1];

	if (!value || value.startsWith("--")) {
		throw new Error(`${name} requires a value.`);
	}

	return value;
}

function collectExternalPackages(packageJson) {
	return [
		...new Set([
			...Object.keys(packageJson.peerDependencies ?? {}),
			...Object.keys(packageJson.peerDependenciesMeta ?? {}),
			...transitivePeerPackages,
		]),
	];
}

export function collectPublicEntrypoints(packageJson) {
	return Object.entries(packageJson.exports ?? {})
		.filter(([subpath]) => subpath !== "./package.json")
		.map(([subpath, exportEntry]) => {
			const importFile =
				typeof exportEntry === "object" && exportEntry !== null
					? (exportEntry.import ?? exportEntry.default)
					: undefined;

			if (typeof importFile !== "string") {
				throw new Error(
					`Package export ${subpath} does not expose an ESM file.`,
				);
			}

			const specifier = specifierForSubpath(packageJson.name, subpath);

			return {
				file: stripLeadingDotSlash(importFile),
				label: specifier,
				specifier,
				subpath,
			};
		});
}

export function formatBytes(bytes) {
	if (bytes < 1000) return `${bytes} B`;
	return `${(bytes / 1024).toFixed(2)} kB`;
}

export function renderMarkdownTable(results) {
	return [
		"| Entry point | Import | Minified | Gzip |",
		"| --- | --- | ---: | ---: |",
		...results.map(
			(result) =>
				`| ${result.label} | \`${result.specifier}\` | ${formatBytes(
					result.minifiedBytes,
				)} | ${formatBytes(result.gzipBytes)} |`,
		),
	].join("\n");
}

async function readPackageJson(packageRoot) {
	const source = await readFile(path.join(packageRoot, "package.json"), "utf8");
	return JSON.parse(source);
}

function isExternalPackage(id, externalPackages) {
	return externalPackages.some(
		(packageName) => id === packageName || id.startsWith(`${packageName}/`),
	);
}

async function bundleEntrypoint({
	entrypoint,
	externalPackages,
	packageRoot,
	repoRoot: root,
}) {
	const entryFile = path.join(packageRoot, entrypoint.file);
	const tempDir = await mkdtemp(path.join(os.tmpdir(), "ignite-bundle-size-"));
	const inputFile = path.join(tempDir, "entry.mjs");

	try {
		await writeFile(
			inputFile,
			`export * from ${JSON.stringify(pathToFileURL(entryFile).href)};\n`,
		);

		const bundle = await build({
			configFile: false,
			define: {
				"process.env.NODE_ENV": JSON.stringify("production"),
			},
			build: {
				emptyOutDir: false,
				lib: {
					entry: inputFile,
					fileName: "entry",
					formats: ["es"],
				},
				minify: "esbuild",
				rollupOptions: {
					external: (id) => isExternalPackage(id, externalPackages),
					output: {
						inlineDynamicImports: true,
					},
				},
				sourcemap: false,
				target: "es2020",
				write: false,
			},
			logLevel: "silent",
			root,
		});

		const outputs = Array.isArray(bundle)
			? bundle.flatMap((item) => item.output)
			: bundle.output;
		const code = outputs
			.filter((output) => output.type === "chunk")
			.map((output) => output.code)
			.join("\n");

		return {
			...entrypoint,
			gzipBytes: gzipSync(code, { level: 9 }).byteLength,
			minifiedBytes: Buffer.byteLength(code, "utf8"),
		};
	} finally {
		await rm(tempDir, { force: true, recursive: true });
	}
}

export async function measureEntrypoints({
	packageRoot = defaultPackageRoot,
	repoRoot: root = repoRoot,
} = {}) {
	const packageJson = await readPackageJson(packageRoot);
	const entrypoints = collectPublicEntrypoints(packageJson);
	const externalPackages = collectExternalPackages(packageJson);

	return Promise.all(
		entrypoints.map((entrypoint) =>
			bundleEntrypoint({
				entrypoint,
				externalPackages,
				packageRoot,
				repoRoot: root,
			}),
		),
	);
}

async function main() {
	const rawArgs = process.argv.slice(2);
	const packageRoot = path.resolve(
		repoRoot,
		readStringFlag(rawArgs, "--package-root", defaultPackageRoot),
	);
	const outPath = rawArgs.some(
		(arg) => arg === "--out" || arg.startsWith("--out="),
	)
		? path.resolve(repoRoot, readStringFlag(rawArgs, "--out"))
		: null;

	const packageJson = await readPackageJson(packageRoot);
	const entrypoints = collectPublicEntrypoints(packageJson);
	let output;

	if (rawArgs.includes("--list")) {
		output = entrypoints.map((entrypoint) => entrypoint.specifier).join("\n");
	} else {
		const results = await measureEntrypoints({ packageRoot, repoRoot });
		output = rawArgs.includes("--json")
			? `${JSON.stringify(results, null, 2)}\n`
			: `${renderMarkdownTable(results)}\n`;
	}

	if (outPath) {
		await writeFile(outPath, output);
		return;
	}

	process.stdout.write(output);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	try {
		await main();
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}

#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const examplesRoot = path.join(repoRoot, "examples");
const ignoredDirs = new Set([
	".git",
	".vite",
	"coverage",
	"dist",
	"node_modules",
]);
const testFilePattern = /\.test\.[cm]?[jt]sx?$/;
const configNames = [
	"vitest.config.ts",
	"vitest.config.mts",
	"vitest.config.mjs",
	"vitest.config.js",
	"vite.config.ts",
	"vite.config.mts",
	"vite.config.mjs",
	"vite.config.js",
];

const args = new Set(process.argv.slice(2));

async function findTestFiles(dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (!ignoredDirs.has(entry.name)) {
				files.push(...(await findTestFiles(fullPath)));
			}
			continue;
		}

		if (entry.isFile() && testFilePattern.test(entry.name)) {
			files.push(fullPath);
		}
	}

	return files;
}

function findExampleRoot(file) {
	let current = path.dirname(file);

	while (current.startsWith(examplesRoot)) {
		if (existsSync(path.join(current, "package.json"))) {
			return current;
		}
		current = path.dirname(current);
	}

	return null;
}

function findConfig(exampleRoot) {
	for (const configName of configNames) {
		const configPath = path.join(exampleRoot, configName);
		if (existsSync(configPath)) {
			return configPath;
		}
	}

	return null;
}

const testFiles = await findTestFiles(examplesRoot);
const exampleRoots = [...new Set(testFiles.map(findExampleRoot))]
	.filter(Boolean)
	.sort((left, right) => left.localeCompare(right));

if (exampleRoots.length === 0) {
	console.error("No example runtime tests were discovered under examples/.");
	process.exit(1);
}

if (args.has("--list")) {
	for (const exampleRoot of exampleRoots) {
		console.log(path.relative(repoRoot, exampleRoot));
	}
	process.exit(0);
}

const missingConfigs = exampleRoots
	.map((exampleRoot) => ({ config: findConfig(exampleRoot), exampleRoot }))
	.filter(({ config }) => config === null);

if (missingConfigs.length > 0) {
	for (const { exampleRoot } of missingConfigs) {
		console.error(
			`Example runtime tests need a Vite/Vitest config: ${path.relative(
				repoRoot,
				exampleRoot,
			)}`,
		);
	}
	process.exit(1);
}

const failedExamples = [];

for (const exampleRoot of exampleRoots) {
	const config = findConfig(exampleRoot);
	const relativeRoot = path.relative(repoRoot, exampleRoot);

	console.log(`\n==> ${relativeRoot}`);

	const result = spawnSync(
		"pnpm",
		[
			"--filter",
			"ignite-element",
			"exec",
			"vitest",
			"--run",
			"--root",
			exampleRoot,
			"--config",
			config,
		],
		{
			cwd: repoRoot,
			stdio: "inherit",
		},
	);

	if (result.status !== 0) {
		failedExamples.push(relativeRoot);
	}
}

if (failedExamples.length > 0) {
	console.error(`\nExample runtime tests failed: ${failedExamples.join(", ")}`);
	process.exit(1);
}

console.log(
	`\nExample runtime tests passed for ${exampleRoots.length} example root(s).`,
);

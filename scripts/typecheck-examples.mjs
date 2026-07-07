#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");

const examplesRootAssignmentPrefix = "--examples-root=";
const installModeAssignmentPrefix = "--install=";
const INSTALL_TIMEOUT_MS = 5 * 60 * 1_000;

class CliError extends Error {
	constructor(message) {
		super(message);
		this.name = "CliError";
	}
}

function failCli(message) {
	throw new CliError(message);
}

function isMissingPathValue(value) {
	return !value || value.startsWith("--");
}

function parseOptions(rawArgs = process.argv.slice(2)) {
	const args = new Set(rawArgs);
	const examplesRootArgIndex = rawArgs.findIndex(
		(arg) =>
			arg === "--examples-root" || arg.startsWith(examplesRootAssignmentPrefix),
	);
	let examplesRootArg;

	if (examplesRootArgIndex !== -1) {
		const matchedArg = rawArgs[examplesRootArgIndex];
		examplesRootArg = matchedArg.startsWith(examplesRootAssignmentPrefix)
			? matchedArg.slice(examplesRootAssignmentPrefix.length)
			: rawArgs[examplesRootArgIndex + 1];

		if (isMissingPathValue(examplesRootArg)) {
			failCli("--examples-root requires a path.");
		}
	}

	const examplesRoot =
		examplesRootArgIndex === -1
			? path.join(repoRoot, "examples")
			: path.resolve(repoRoot, examplesRootArg);
	const installModeArg = rawArgs.find(
		(arg) => arg === "--install" || arg.startsWith(installModeAssignmentPrefix),
	);
	if (installModeArg === "--install") {
		failCli("--install requires a value (always, missing, or never).");
	}
	const installMode = installModeArg
		? installModeArg.slice(installModeAssignmentPrefix.length)
		: args.has("--skip-install")
			? "never"
			: "always";

	if (!["always", "missing", "never"].includes(installMode)) {
		failCli("--install must be one of: always, missing, never.");
	}

	return { args, examplesRoot, installMode };
}

export async function discoverExampleRoots(
	root = path.join(repoRoot, "examples"),
	options = {},
) {
	const readDir = options.readdir ?? readdir;
	const fileExists = options.existsSync ?? existsSync;
	const fail =
		options.fail ??
		((message) => {
			failCli(message);
		});
	let categoryEntries;
	try {
		categoryEntries = await readDir(root, { withFileTypes: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return fail(`Unable to read examples root ${root}: ${message}`);
	}
	const exampleRoots = [];

	for (const categoryEntry of categoryEntries) {
		if (!categoryEntry.isDirectory() || categoryEntry.name.startsWith(".")) {
			continue;
		}

		const categoryRoot = path.join(root, categoryEntry.name);
		let exampleEntries;
		try {
			exampleEntries = await readDir(categoryRoot, { withFileTypes: true });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return fail(
				`Unable to read examples category ${categoryRoot}: ${message}`,
			);
		}

		for (const exampleEntry of exampleEntries) {
			if (!exampleEntry.isDirectory() || exampleEntry.name.startsWith(".")) {
				continue;
			}

			const exampleRoot = path.join(categoryRoot, exampleEntry.name);
			if (fileExists(path.join(exampleRoot, "package.json"))) {
				exampleRoots.push(exampleRoot);
			}
		}
	}

	return exampleRoots.sort((left, right) => left.localeCompare(right));
}

function shouldUseShell() {
	return process.platform === "win32";
}

function normalizeScriptPath(filePath) {
	const resolvedPath = path.resolve(filePath);
	return process.platform === "win32"
		? resolvedPath.toLowerCase()
		: resolvedPath;
}

function ensureDependencies(exampleRoot, installMode) {
	if (
		installMode === "never" ||
		(installMode === "missing" &&
			existsSync(path.join(exampleRoot, "node_modules")))
	) {
		return true;
	}

	const result = spawnSync(
		"pnpm",
		[
			"install",
			"--ignore-workspace",
			"--no-link-workspace-packages",
			"--no-frozen-lockfile",
		],
		{
			cwd: exampleRoot,
			env: { ...process.env, CI: process.env.CI ?? "true" },
			shell: shouldUseShell(),
			stdio: "inherit",
			timeout: INSTALL_TIMEOUT_MS,
		},
	);

	if (result.error) {
		console.error(
			`Failed to run pnpm install in ${exampleRoot}: ${result.error.message}`,
		);
	}

	return result.status === 0;
}

function runTypecheck(tsc, exampleRoot) {
	const tsconfig = path.join(exampleRoot, "tsconfig.json");

	if (!existsSync(tsconfig)) {
		console.error(
			`Example package is missing a tsconfig: ${path.relative(
				repoRoot,
				exampleRoot,
			)}`,
		);
		return false;
	}

	const result = spawnSync(process.execPath, [tsc, "--project", tsconfig], {
		cwd: repoRoot,
		stdio: "inherit",
	});

	if (result.error) {
		console.error(
			`Failed to run tsc for ${exampleRoot}: ${result.error.message}`,
		);
	}

	return result.status === 0;
}

async function main() {
	const { args, examplesRoot, installMode } = parseOptions();
	const exampleRoots = await discoverExampleRoots(examplesRoot);

	if (exampleRoots.length === 0) {
		failCli(
			`No example packages were discovered under ${path.relative(
				repoRoot,
				examplesRoot,
			)}/.`,
		);
	}

	if (args.has("--list")) {
		for (const exampleRoot of exampleRoots) {
			console.log(path.relative(repoRoot, exampleRoot));
		}
		return;
	}

	const tsc = path.join(
		repoRoot,
		"packages",
		"ignite-element",
		"node_modules",
		"typescript",
		"bin",
		"tsc",
	);

	if (!existsSync(tsc)) {
		failCli(
			`Error: tsc not found at ${path.relative(
				repoRoot,
				tsc,
			)}. Run pnpm install first.`,
		);
	}

	const failedExamples = [];

	for (const exampleRoot of exampleRoots) {
		const relativeRoot = path.relative(repoRoot, exampleRoot);
		console.log(`\n==> ${relativeRoot}`);

		if (!ensureDependencies(exampleRoot, installMode)) {
			failedExamples.push(relativeRoot);
			continue;
		}

		if (runTypecheck(tsc, exampleRoot)) {
			console.log(`PASS ${relativeRoot}`);
		} else {
			console.log(`FAIL ${relativeRoot}`);
			failedExamples.push(relativeRoot);
		}
	}

	if (failedExamples.length > 0) {
		failCli(`\nExample typecheck failed: ${failedExamples.join(", ")}`);
	}

	console.log(
		`\nExample typecheck passed for ${exampleRoots.length} example(s).`,
	);
}

if (
	process.argv[1] &&
	normalizeScriptPath(process.argv[1]) === normalizeScriptPath(scriptPath)
) {
	try {
		await main();
	} catch (error) {
		if (error instanceof CliError) {
			process.stderr.write(`${error.message}\n`);
			process.exitCode = 1;
		} else {
			throw error;
		}
	}
}

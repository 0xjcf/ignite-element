#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, rmSync, statSync } from "node:fs";
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

function readRepeatedPathFlag(rawArgs, name) {
	const values = [];
	const assignmentPrefix = `${name}=`;

	for (let index = 0; index < rawArgs.length; index += 1) {
		const arg = rawArgs[index];
		if (arg === name) {
			const value = rawArgs[index + 1];
			if (isMissingPathValue(value)) {
				failCli(`${name} requires a path.`);
			}
			values.push(path.resolve(repoRoot, value));
			index += 1;
			continue;
		}

		if (arg.startsWith(assignmentPrefix)) {
			const value = arg.slice(assignmentPrefix.length);
			if (isMissingPathValue(value)) {
				failCli(`${name} requires a path.`);
			}
			values.push(path.resolve(repoRoot, value));
		}
	}

	return values;
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
	const installModeArgIndex = rawArgs.findIndex(
		(arg) => arg === "--install" || arg.startsWith(installModeAssignmentPrefix),
	);
	let installMode = "missing";
	if (installModeArgIndex !== -1) {
		const installModeArg = rawArgs[installModeArgIndex];
		const installValue = installModeArg.startsWith(installModeAssignmentPrefix)
			? installModeArg.slice(installModeAssignmentPrefix.length)
			: rawArgs[installModeArgIndex + 1];
		if (isMissingPathValue(installValue)) {
			failCli("--install requires a value (always, missing, or never).");
		}
		installMode = installValue;
	} else if (args.has("--skip-install")) {
		installMode = "never";
	}

	if (!["always", "missing", "never"].includes(installMode)) {
		failCli("--install must be one of: always, missing, never.");
	}

	return {
		args,
		coveredPackageRoots: readRepeatedPathFlag(rawArgs, "--covers-package"),
		examplesRoot,
		installMode,
	};
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
		(installMode === "missing" && hasFreshDependencies(exampleRoot))
	) {
		return true;
	}

	const lockfile = path.join(exampleRoot, "pnpm-lock.yaml");
	const hadLockfile = existsSync(lockfile);
	const lockfileFlag = hadLockfile
		? "--frozen-lockfile"
		: "--no-frozen-lockfile";
	const result = spawnSync(
		"pnpm",
		[
			"install",
			"--ignore-workspace",
			"--no-link-workspace-packages",
			lockfileFlag,
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

	if (!hadLockfile && existsSync(lockfile)) {
		try {
			rmSync(lockfile, { force: true });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(
				`Failed to clean generated pnpm lockfile in ${exampleRoot}: ${message}`,
			);
			return false;
		}
	}

	return result.status === 0;
}

function hasFreshDependencies(exampleRoot) {
	const nodeModules = path.join(exampleRoot, "node_modules");
	const installMarker = path.join(nodeModules, ".modules.yaml");
	if (
		!existsSync(nodeModules) ||
		!existsSync(installMarker) ||
		!existsSync(getTypeScriptCompilerPath(exampleRoot))
	) {
		return false;
	}

	const installedAt = statSync(installMarker).mtimeMs;
	const dependencyInputs = [
		path.join(exampleRoot, "package.json"),
		path.join(exampleRoot, "pnpm-lock.yaml"),
	].filter((filePath) => existsSync(filePath));

	return dependencyInputs.every(
		(filePath) => statSync(filePath).mtimeMs <= installedAt,
	);
}

function getTypeScriptCompilerPath(exampleRoot) {
	return path.join(exampleRoot, "node_modules", "typescript", "bin", "tsc");
}

function resolveTypeScriptCompiler(exampleRoot) {
	const tsc = getTypeScriptCompilerPath(exampleRoot);

	if (!existsSync(tsc)) {
		console.error(
			`Example package is missing TypeScript: ${path.relative(
				repoRoot,
				exampleRoot,
			)}. Run this script with --install=missing or install the example dependencies.`,
		);
		return undefined;
	}

	return tsc;
}

function runTypecheck(exampleRoot) {
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

	const tsc = resolveTypeScriptCompiler(exampleRoot);
	if (!tsc) {
		return false;
	}

	const result = spawnSync(process.execPath, [tsc, "--project", tsconfig], {
		cwd: exampleRoot,
		stdio: "inherit",
		timeout: INSTALL_TIMEOUT_MS,
	});

	if (result.error) {
		console.error(
			`Failed to run tsc for ${exampleRoot}: ${result.error.message}`,
		);
	}

	return result.status === 0;
}

async function main() {
	const { args, coveredPackageRoots, examplesRoot, installMode } =
		parseOptions();
	const exampleRoots = await discoverExampleRoots(examplesRoot);

	if (exampleRoots.length === 0) {
		failCli(
			`No example packages were discovered under ${path.relative(
				repoRoot,
				examplesRoot,
			)}/.`,
		);
	}

	const hasCoveredPackageFilter = coveredPackageRoots.length > 0;
	const missingCoveredPackageRoots = coveredPackageRoots.filter(
		(coveredPackageRoot) => !exampleRoots.includes(coveredPackageRoot),
	);

	if (missingCoveredPackageRoots.length > 0) {
		for (const coveredPackageRoot of missingCoveredPackageRoots) {
			failCli(
				`Covered example package was not discovered: ${path.relative(
					repoRoot,
					coveredPackageRoot,
				)}`,
			);
		}
	}

	const filteredExampleRoots = hasCoveredPackageFilter
		? exampleRoots.filter((exampleRoot) =>
				coveredPackageRoots.includes(exampleRoot),
			)
		: exampleRoots;

	if (args.has("--list")) {
		for (const exampleRoot of filteredExampleRoots) {
			console.log(path.relative(repoRoot, exampleRoot));
		}
		return;
	}

	const failedExamples = [];

	for (const exampleRoot of filteredExampleRoots) {
		const relativeRoot = path.relative(repoRoot, exampleRoot);
		console.log(`\n==> ${relativeRoot}`);

		if (!ensureDependencies(exampleRoot, installMode)) {
			console.log(`FAIL ${relativeRoot}`);
			failedExamples.push(relativeRoot);
			continue;
		}

		if (runTypecheck(exampleRoot)) {
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
		`\nExample typecheck passed for ${filteredExampleRoots.length} example(s).`,
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

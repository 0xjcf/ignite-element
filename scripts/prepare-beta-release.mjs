import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const changesetConfigPath = path.join(repositoryRoot, ".changeset/config.json");

export const PREPARATION_STEPS = [
	"check-prerequisites",
	"changeset-version-without-commit",
	"format-version-output",
	"validate-reviewable-candidate",
];

export const RELEASE_PACKAGES = [
	{ directory: "packages/ignite-core", name: "@ignite-element/core" },
	{ directory: "packages/ignite-adapters", name: "@ignite-element/adapters" },
	{ directory: "packages/ignite-renderer", name: "@ignite-element/renderer" },
	{ directory: "packages/ignite-element", name: "ignite-element" },
];

function run(command, args, options = {}) {
	console.info(`[release:prepare] ${command} ${args.join(" ")}`);
	const result = spawnSync(command, args, {
		cwd: repositoryRoot,
		encoding: "utf8",
		stdio: "inherit",
		...options,
	});
	if (result.error) throw result.error;
	if (result.status !== 0)
		throw new Error(`${command} failed with exit code ${result.status}`);
}

function capture(command, args) {
	const result = spawnSync(command, args, {
		cwd: repositoryRoot,
		encoding: "utf8",
	});
	if (result.error) throw result.error;
	if (result.status !== 0)
		throw new Error(
			`${command} ${args.join(" ")} failed: ${result.stderr.trim()}`,
		);
	return result.stdout.trim();
}

function readPackageVersions() {
	return Object.fromEntries(
		RELEASE_PACKAGES.map(({ directory, name }) => [
			name,
			JSON.parse(
				fs.readFileSync(
					path.join(repositoryRoot, directory, "package.json"),
					"utf8",
				),
			).version,
		]),
	);
}

function pendingChangesets() {
	const preState = JSON.parse(
		fs.readFileSync(path.join(repositoryRoot, ".changeset/pre.json"), "utf8"),
	);
	const consumed = new Set(preState.changesets);
	return fs
		.readdirSync(path.join(repositoryRoot, ".changeset"))
		.filter((name) => name.endsWith(".md") && name !== "README.md")
		.map((name) => name.slice(0, -3))
		.filter((name) => !consumed.has(name));
}

function assertLockstepPrerelease(versions) {
	const unique = new Set(Object.values(versions));
	if (unique.size !== 1)
		throw new Error("release packages must have one lockstep version");
	const [version] = unique;
	if (!/^\d+\.\d+\.\d+-beta\.\d+$/.test(version))
		throw new Error(`release version is not a beta prerelease: ${version}`);
	return version;
}

function assertInternalDependencies(version) {
	for (const { directory, name } of RELEASE_PACKAGES) {
		const manifest = JSON.parse(
			fs.readFileSync(
				path.join(repositoryRoot, directory, "package.json"),
				"utf8",
			),
		);
		for (const [dependency, range] of Object.entries(
			manifest.dependencies ?? {},
		)) {
			if (!RELEASE_PACKAGES.some((candidate) => candidate.name === dependency))
				continue;
			if (range !== "workspace:*")
				throw new Error(
					`${name} must use workspace:* for ${dependency}; packed output resolves it to ${version}`,
				);
		}
	}
}

function assertCleanPrerequisites() {
	const branch = capture("git", ["branch", "--show-current"]);
	if (branch !== "beta")
		throw new Error(
			`version preparation requires local beta; received ${branch || "detached HEAD"}`,
		);
	if (capture("git", ["status", "--porcelain=v1"]) !== "")
		throw new Error("version preparation requires a clean worktree and index");
	const preState = JSON.parse(
		fs.readFileSync(path.join(repositoryRoot, ".changeset/pre.json"), "utf8"),
	);
	if (preState.mode !== "pre" || preState.tag !== "beta")
		throw new Error("Changesets must be in beta prerelease mode");
	const pending = pendingChangesets();
	if (pending.length === 0)
		throw new Error(
			"version preparation requires at least one unconsumed changeset",
		);
	return { pending, version: assertLockstepPrerelease(readPackageVersions()) };
}

function runChangesetVersionWithoutCommit() {
	const original = fs.readFileSync(changesetConfigPath);
	const config = JSON.parse(original.toString("utf8"));
	if (config.commit !== true)
		throw new Error(
			"expected Changesets commit policy to be enabled outside preparation",
		);
	const temporary = `${JSON.stringify({ ...config, commit: false }, null, "\t")}\n`;
	try {
		fs.writeFileSync(changesetConfigPath, temporary);
		run("pnpm", ["exec", "changeset", "version"]);
	} finally {
		fs.writeFileSync(changesetConfigPath, original);
	}
	if (!fs.readFileSync(changesetConfigPath).equals(original))
		throw new Error("Changesets configuration was not restored byte-for-byte");
}

function validateReviewableCandidate(before) {
	const staged = capture("git", ["diff", "--cached", "--name-only"]);
	if (staged)
		throw new Error("version preparation must leave the index unchanged");
	const after = assertLockstepPrerelease(readPackageVersions());
	if (after === before.version)
		throw new Error("Changesets did not advance the lockstep beta version");
	assertInternalDependencies(after);
	const allowed =
		/^(?:\.changeset\/pre\.json|\.changeset\/[^/]+\.md|packages\/ignite-(?:core|adapters|renderer|element)\/(?:package\.json|CHANGELOG\.md))$/;
	const changed = capture("git", ["status", "--porcelain=v1"])
		.split("\n")
		.filter(Boolean)
		.map((line) => line.slice(3));
	if (changed.length === 0 || changed.some((name) => !allowed.test(name)))
		throw new Error(`unexpected preparation output: ${changed.join(", ")}`);
	return { changed, pendingChangesets: before.pending, version: after };
}

export function prepareBetaRelease() {
	const before = assertCleanPrerequisites();
	runChangesetVersionWithoutCommit();
	run("pnpm", [
		"exec",
		"biome",
		"format",
		"--write",
		".changeset/pre.json",
		...RELEASE_PACKAGES.map(({ directory }) => `${directory}/package.json`),
	]);
	run("pnpm", [
		"exec",
		"markdownlint-cli2",
		"--fix",
		...RELEASE_PACKAGES.map(({ directory }) => `${directory}/CHANGELOG.md`),
	]);
	const result = validateReviewableCandidate(before);
	console.info(
		JSON.stringify(
			{ status: "reviewable-version-changes", ...result },
			null,
			2,
		),
	);
	return result;
}

function isMainModule() {
	return (
		process.argv[1] &&
		path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
	);
}

if (isMainModule()) {
	try {
		prepareBetaRelease();
	} catch (error) {
		console.error(`[release:prepare] ${error.message}`);
		process.exitCode = 1;
	}
}

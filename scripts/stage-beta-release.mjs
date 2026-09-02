import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const uuidPattern =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const RELEASE_PACKAGES = [
	{ directory: "packages/ignite-core", name: "@ignite-element/core" },
	{ directory: "packages/ignite-adapters", name: "@ignite-element/adapters" },
	{ directory: "packages/ignite-renderer", name: "@ignite-element/renderer" },
	{ directory: "packages/ignite-element", name: "ignite-element" },
];

const COMPLETE_VALIDATION = [
	["pnpm", ["run", "typecheck:full"]],
	["pnpm", ["run", "architecture:check"]],
	["pnpm", ["run", "test:full"]],
	["pnpm", ["run", "format:check"]],
	["pnpm", ["run", "lint"]],
];

function sha256(file) {
	return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function run(
	command,
	args,
	{ capture: shouldCapture = false, ...options } = {},
) {
	console.info(`[release:stage] ${command} ${args.join(" ")}`);
	const result = spawnSync(command, args, {
		cwd: repositoryRoot,
		encoding: "utf8",
		stdio: shouldCapture ? ["ignore", "pipe", "inherit"] : "inherit",
		...options,
	});
	if (result.error) throw result.error;
	if (result.status !== 0)
		throw new Error(`${command} failed with exit code ${result.status}`);
	return shouldCapture ? result.stdout : "";
}

function capture(command, args, options = {}) {
	const result = spawnSync(command, args, {
		cwd: repositoryRoot,
		encoding: "utf8",
		...options,
	});
	if (result.error) throw result.error;
	if (result.status !== 0)
		throw Object.assign(
			new Error(
				`${command} ${args.join(" ")} failed: ${(result.stderr ?? "").trim()}`,
			),
			{ result },
		);
	return result.stdout.trim();
}

function tarballName(packageName, version) {
	return `${packageName.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;
}

function readVersions() {
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

function pendingChangesets(preState) {
	const consumed = new Set(preState.changesets ?? []);
	return fs
		.readdirSync(path.join(repositoryRoot, ".changeset"))
		.filter((name) => name.endsWith(".md") && name !== "README.md")
		.map((name) => name.slice(0, -3))
		.filter((name) => !consumed.has(name));
}

export function assertStagingPreconditions({
	branchRef,
	clean,
	pendingChangesets: pending,
	preState,
	publicVersions,
	versions,
}) {
	if (branchRef !== "refs/heads/beta")
		throw new Error(`staging requires refs/heads/beta; received ${branchRef}`);
	if (!clean) throw new Error("staging requires a clean worktree and index");
	if (preState?.mode !== "pre" || preState?.tag !== "beta")
		throw new Error("Changesets must be in beta prerelease mode");
	if (pending.length !== 0)
		throw new Error(`unconsumed Changesets remain: ${pending.join(", ")}`);
	const unique = new Set(Object.values(versions));
	if (
		unique.size !== 1 ||
		!/^\d+\.\d+\.\d+-beta\.\d+$/.test([...unique][0] ?? "")
	)
		throw new Error(
			"release packages must have one lockstep beta prerelease version",
		);
	if (publicVersions.length !== 0)
		throw new Error(
			`target versions already exist publicly: ${publicVersions.join(", ")}`,
		);
	return [...unique][0];
}

export function createTarballManifest(candidates, baseDirectory) {
	if (candidates.length !== RELEASE_PACKAGES.length)
		throw new Error("exactly four tarballs are required");
	const byName = new Map(
		candidates.map((candidate) => [candidate.name, candidate]),
	);
	const packages = RELEASE_PACKAGES.map(({ name }) => {
		const candidate = byName.get(name);
		if (!candidate || !fs.existsSync(candidate.file))
			throw new Error(`missing tarball for ${name}`);
		const stat = fs.statSync(candidate.file);
		return {
			filename: path.relative(baseDirectory, candidate.file),
			name,
			sha256: sha256(candidate.file),
			size: stat.size,
			version: candidate.version,
		};
	});
	return { algorithm: "sha256", packages, schemaVersion: 1 };
}

export function assertTarballManifest(manifest, baseDirectory) {
	if (
		manifest?.schemaVersion !== 1 ||
		manifest?.algorithm !== "sha256" ||
		manifest.packages?.length !== 4
	)
		throw new Error("invalid four-package tarball manifest");
	for (const [index, definition] of RELEASE_PACKAGES.entries()) {
		const entry = manifest.packages[index];
		if (entry.name !== definition.name)
			throw new Error(`tarball order mismatch at ${definition.name}`);
		const file = path.resolve(baseDirectory, entry.filename);
		if (
			!file.startsWith(`${path.resolve(baseDirectory)}${path.sep}`) ||
			!fs.existsSync(file)
		)
			throw new Error(`missing tarball for ${entry.name}`);
		if (fs.statSync(file).size !== entry.size || sha256(file) !== entry.sha256)
			throw new Error(`SHA-256 mismatch for ${entry.name}`);
	}
	const versions = new Set(manifest.packages.map(({ version }) => version));
	if (versions.size !== 1) throw new Error("tarball versions are not lockstep");
	return manifest;
}

export function createStagePlan({ manifest, manifestPath }) {
	const baseDirectory = path.dirname(manifestPath);
	assertTarballManifest(manifest, baseDirectory);
	return {
		consumerValidation: {
			args: [
				path.join(repositoryRoot, "scripts/verify-packed-consumers.mjs"),
				"--tarball-manifest",
				manifestPath,
			],
			command: process.execPath,
		},
		stageCommands: manifest.packages.map((entry) => {
			const tarball = path.resolve(baseDirectory, entry.filename);
			return {
				args: [
					"stage",
					"publish",
					tarball,
					"--tag",
					"beta",
					"--provenance",
					"--access",
					"public",
					"--json",
				],
				command: "npm",
				name: entry.name,
				tarball,
				version: entry.version,
			};
		}),
	};
}

export function parseStagePublishReceipt(stdout, expected) {
	let value;
	try {
		value = JSON.parse(stdout);
	} catch {
		throw new Error(
			`npm stage publish did not return JSON for ${expected.name}`,
		);
	}
	const record = value?.[expected.name] ?? value;
	if (record?.name !== expected.name || record?.version !== expected.version)
		throw new Error(`stage receipt identity mismatch for ${expected.name}`);
	if (!uuidPattern.test(record.stageId ?? ""))
		throw new Error(
			`stage receipt for ${expected.name} is missing a valid stageId`,
		);
	return {
		name: expected.name,
		stageId: record.stageId,
		version: expected.version,
	};
}

export function executeStagePlan({
	beforeStage = () => {},
	onStageReceipt = () => {},
	plan,
	runCommand,
}) {
	if (plan.stageCommands.length !== RELEASE_PACKAGES.length)
		throw new Error(
			"stage plan must prepare all four packages before staging begins",
		);
	runCommand({ ...plan.consumerValidation, kind: "consumer-validation" });
	beforeStage();
	const receipts = [];
	for (const command of plan.stageCommands) {
		const stdout = runCommand({ ...command, kind: "stage-publish" });
		const stageReceipt = parseStagePublishReceipt(stdout, command);
		receipts.push(stageReceipt);
		onStageReceipt(stageReceipt, receipts);
	}
	return receipts;
}

function assertPackedInternalDependencies(tarballDirectory, manifest) {
	const names = new Set(RELEASE_PACKAGES.map(({ name }) => name));
	for (const entry of manifest.packages) {
		const packageJson = JSON.parse(
			capture("tar", [
				"-xOf",
				path.resolve(tarballDirectory, entry.filename),
				"package/package.json",
			]),
		);
		if (
			packageJson.name !== entry.name ||
			packageJson.version !== entry.version
		)
			throw new Error(`packed identity mismatch for ${entry.name}`);
		for (const [name, range] of Object.entries(
			packageJson.dependencies ?? {},
		)) {
			if (names.has(name) && range !== entry.version)
				throw new Error(
					`${entry.name} must depend on exact internal version ${entry.version}; received ${name}@${range}`,
				);
		}
	}
}

function targetAlreadyPublic(name, version) {
	try {
		capture("npm", [
			"view",
			`${name}@${version}`,
			"version",
			"--json",
			"--prefer-online",
		]);
		return true;
	} catch (error) {
		const detail = `${error.result?.stdout ?? ""}\n${error.result?.stderr ?? ""}`;
		if (/E404|404 Not Found|is not in this registry/.test(detail)) return false;
		throw error;
	}
}

function writeReceipt(outputDirectory, receipt) {
	fs.writeFileSync(
		path.join(outputDirectory, "receipt.json"),
		`${JSON.stringify(receipt, null, 2)}\n`,
	);
}

export function stageBetaRelease({ outputDirectory }) {
	const head = capture("git", ["rev-parse", "HEAD"]);
	const tree = capture("git", ["rev-parse", "HEAD^{tree}"]);
	if (process.env.GITHUB_SHA !== head)
		throw new Error(`GITHUB_SHA does not match checked-out HEAD ${head}`);
	const preState = JSON.parse(
		fs.readFileSync(path.join(repositoryRoot, ".changeset/pre.json"), "utf8"),
	);
	const versions = readVersions();
	const publicVersions = Object.entries(versions)
		.filter(([name, version]) => targetAlreadyPublic(name, version))
		.map(([name, version]) => `${name}@${version}`);
	const version = assertStagingPreconditions({
		branchRef: process.env.GITHUB_REF,
		clean: capture("git", ["status", "--porcelain=v1"]) === "",
		pendingChangesets: pendingChangesets(preState),
		preState,
		publicVersions,
		versions,
	});

	fs.mkdirSync(outputDirectory, { recursive: false });
	const tarballDirectory = path.join(outputDirectory, "tarballs");
	fs.mkdirSync(tarballDirectory);
	const candidates = RELEASE_PACKAGES.map(({ directory, name }) => {
		run("pnpm", [
			"--dir",
			directory,
			"pack",
			"--ignore-scripts",
			"--pack-destination",
			tarballDirectory,
		]);
		return {
			file: path.join(tarballDirectory, tarballName(name, version)),
			name,
			version,
		};
	});
	const manifest = createTarballManifest(candidates, tarballDirectory);
	assertPackedInternalDependencies(tarballDirectory, manifest);
	const manifestPath = path.join(tarballDirectory, "manifest.json");
	fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
	const plan = createStagePlan({ manifest, manifestPath });
	const receipt = {
		commit: head,
		stageIdentifiers: [],
		status: "validating",
		tarballs: manifest,
		tree,
		validation: [],
	};
	writeReceipt(outputDirectory, receipt);

	try {
		receipt.stageIdentifiers = executeStagePlan({
			beforeStage: () => {
				receipt.validation.push("exact-packed-consumers");
				for (const [command, args] of COMPLETE_VALIDATION) {
					run(command, args);
					receipt.validation.push(`${command} ${args.join(" ")}`);
				}
				if (capture("git", ["status", "--porcelain=v1"]) !== "")
					throw new Error("validation changed tracked repository content");
				receipt.status = "staging";
				writeReceipt(outputDirectory, receipt);
			},
			onStageReceipt: (_stageReceipt, receipts) => {
				receipt.stageIdentifiers = [...receipts];
				writeReceipt(outputDirectory, receipt);
			},
			plan,
			runCommand: (command) =>
				command.kind === "stage-publish"
					? run(command.command, command.args, { capture: true })
					: run(command.command, command.args),
		});
		receipt.status = "staged-awaiting-independent-review-and-operator-approval";
		writeReceipt(outputDirectory, receipt);
	} catch (error) {
		receipt.failure = error.message;
		receipt.status = "partial-staging-failed-closed";
		writeReceipt(outputDirectory, receipt);
		throw error;
	}
	return receipt;
}

function parseOutputDirectory() {
	const index = process.argv.indexOf("--output-dir");
	if (index === -1 || !process.argv[index + 1])
		throw new Error("--output-dir is required");
	return path.resolve(process.argv[index + 1]);
}

if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	try {
		stageBetaRelease({ outputDirectory: parseOutputDirectory() });
	} catch (error) {
		console.error(`[release:stage] ${error.message}`);
		process.exitCode = 1;
	}
}

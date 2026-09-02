import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const repositoryIdentity = {
	type: "git",
	url: "git+https://github.com/0xjcf/ignite-element.git",
};
const gitObjectPattern = /^[0-9a-f]{40}$/;
const sha256Pattern = /^(?:sha256:)?[0-9a-f]{64}$/;
const uuidPattern =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const RELEASE_PACKAGES = [
	{ directory: "packages/ignite-core", name: "@ignite-element/core" },
	{ directory: "packages/ignite-adapters", name: "@ignite-element/adapters" },
	{ directory: "packages/ignite-renderer", name: "@ignite-element/renderer" },
	{ directory: "packages/ignite-element", name: "ignite-element" },
];

const COMPLETE_VALIDATION = [
	["pnpm", ["run", "test:packages"]],
	["pnpm", ["run", "test:scripts"]],
	["pnpm", ["run", "architecture:check"]],
	["pnpm", ["run", "typecheck:full"]],
	["pnpm", ["run", "format:check"]],
	["pnpm", ["run", "lint"]],
	["pnpm", ["run", "test:full"]],
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
		!/^[0-9]+\.[0-9]+\.[0-9]+-beta\.[0-9]+$/.test([...unique][0] ?? "")
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

function assertRegularContainedFile(file, baseDirectory, label) {
	const resolvedBase = fs.realpathSync(baseDirectory);
	const resolvedFile = path.resolve(baseDirectory, file);
	if (!resolvedFile.startsWith(`${path.resolve(baseDirectory)}${path.sep}`))
		throw new Error(`${label} escapes the staging payload`);
	const stat = fs.lstatSync(resolvedFile);
	if (!stat.isFile() || stat.isSymbolicLink())
		throw new Error(`${label} must be a regular file`);
	if (!fs.realpathSync(resolvedFile).startsWith(`${resolvedBase}${path.sep}`))
		throw new Error(`${label} resolves outside the staging payload`);
	return resolvedFile;
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
		manifest.packages?.length !== RELEASE_PACKAGES.length
	)
		throw new Error("invalid four-package tarball manifest");
	for (const [index, definition] of RELEASE_PACKAGES.entries()) {
		const entry = manifest.packages[index];
		if (entry.name !== definition.name)
			throw new Error(`tarball order mismatch at ${definition.name}`);
		const file = path.resolve(baseDirectory, entry.filename);
		if (!fs.existsSync(file))
			throw new Error(`missing tarball for ${entry.name}`);
		assertRegularContainedFile(entry.filename, baseDirectory, entry.name);
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
	onStageReceipt = () => {},
	plan,
	runCommand,
}) {
	if (plan.stageCommands.length !== RELEASE_PACKAGES.length)
		throw new Error(
			"stage plan must contain all four packages before staging begins",
		);
	const receipts = [];
	for (const command of plan.stageCommands) {
		const stdout = runCommand({ ...command, kind: "stage-publish" });
		const stageReceipt = parseStagePublishReceipt(stdout, command);
		receipts.push(stageReceipt);
		onStageReceipt(stageReceipt, receipts);
	}
	return receipts;
}

export function assertPackedReleaseMetadata(tarballDirectory, manifest) {
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
		if (
			packageJson.repository?.type !== repositoryIdentity.type ||
			packageJson.repository?.url !== repositoryIdentity.url
		)
			throw new Error(`packed repository identity mismatch for ${entry.name}`);
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

function writeJson(file, value) {
	fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeReceipt(outputDirectory, receipt) {
	writeJson(path.join(outputDirectory, "receipt.json"), receipt);
}

function writeGitHubOutputs(githubOutput, values) {
	if (!githubOutput) return;
	for (const [name, value] of Object.entries(values))
		fs.appendFileSync(githubOutput, `${name}=${value}\n`);
}

function assertExactPayloadInventory(payloadDirectory, manifest) {
	const expected = new Set([
		"payload.json",
		"tarballs/manifest.json",
		...manifest.packages.map(({ filename }) => `tarballs/${filename}`),
	]);
	const actual = [];
	function walk(directory) {
		for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
			const absolute = path.join(directory, entry.name);
			if (entry.isDirectory()) walk(absolute);
			else actual.push(path.relative(payloadDirectory, absolute));
		}
	}
	walk(payloadDirectory);
	if (
		actual.length !== expected.size ||
		actual.some((entry) => !expected.has(entry))
	)
		throw new Error(
			`unexpected staging payload inventory: ${actual.join(", ")}`,
		);
}

export function assertPayloadBinding({
	artifactDigest,
	artifactId,
	expectedCommit,
	expectedPayloadDigest,
	expectedTree,
	payload,
	payloadDigest,
}) {
	if (!/^[1-9][0-9]*$/.test(artifactId))
		throw new Error("validation artifact ID is invalid");
	if (!sha256Pattern.test(artifactDigest))
		throw new Error("validation artifact digest is invalid");
	if (!sha256Pattern.test(expectedPayloadDigest))
		throw new Error("expected payload digest is invalid");
	if (payloadDigest !== expectedPayloadDigest.replace(/^sha256:/, ""))
		throw new Error("downloaded payload SHA-256 mismatch");
	if (
		!gitObjectPattern.test(expectedCommit) ||
		payload.commit !== expectedCommit
	)
		throw new Error("downloaded payload commit mismatch");
	if (!gitObjectPattern.test(expectedTree) || payload.tree !== expectedTree)
		throw new Error("downloaded payload tree mismatch");
	if (
		payload.schemaVersion !== 1 ||
		payload.repository !== "0xjcf/ignite-element" ||
		payload.branchRef !== "refs/heads/beta"
	)
		throw new Error("downloaded payload release identity mismatch");
	return {
		artifactDigest,
		artifactId,
		payloadDigest,
	};
}

export function prepareStagingPayload({
	githubOutput = process.env.GITHUB_OUTPUT,
	outputDirectory,
}) {
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

	if (fs.existsSync(outputDirectory))
		throw new Error(
			`staging payload directory already exists: ${outputDirectory}`,
		);
	fs.mkdirSync(outputDirectory);
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
	assertPackedReleaseMetadata(tarballDirectory, manifest);
	const manifestPath = path.join(tarballDirectory, "manifest.json");
	writeJson(manifestPath, manifest);

	const validation = ["pnpm run build"];
	run(process.execPath, [
		path.join(repositoryRoot, "scripts/verify-packed-consumers.mjs"),
		"--tarball-manifest",
		manifestPath,
	]);
	validation.push("exact-packed-consumers");
	for (const [command, args] of COMPLETE_VALIDATION) {
		run(command, args);
		validation.push(`${command} ${args.join(" ")}`);
	}
	if (capture("git", ["status", "--porcelain=v1"]) !== "")
		throw new Error("validation changed tracked repository content");

	const payload = {
		branchRef: process.env.GITHUB_REF,
		commit: head,
		manifest: {
			path: "tarballs/manifest.json",
			sha256: sha256(manifestPath),
		},
		repository: "0xjcf/ignite-element",
		schemaVersion: 1,
		status: "validated-awaiting-protected-staging",
		tree,
		validation,
		version,
	};
	const payloadPath = path.join(outputDirectory, "payload.json");
	writeJson(payloadPath, payload);
	const payloadDigest = sha256(payloadPath);
	writeGitHubOutputs(githubOutput, {
		commit: head,
		"payload-digest": payloadDigest,
		tree,
	});
	return { manifest, payload, payloadDigest };
}

export function stageValidatedPayload({
	artifactDigest,
	artifactId,
	expectedCommit,
	expectedPayloadDigest,
	expectedTree,
	payloadDirectory,
	receiptDirectory,
}) {
	const head = capture("git", ["rev-parse", "HEAD"]);
	const tree = capture("git", ["rev-parse", "HEAD^{tree}"]);
	if (process.env.GITHUB_REF !== "refs/heads/beta")
		throw new Error(
			`staging requires refs/heads/beta; received ${process.env.GITHUB_REF}`,
		);
	if (process.env.GITHUB_SHA !== head || head !== expectedCommit)
		throw new Error(`staging checkout does not match ${expectedCommit}`);
	if (tree !== expectedTree)
		throw new Error(`staging tree does not match ${expectedTree}`);
	if (capture("git", ["status", "--porcelain=v1"]) !== "")
		throw new Error("staging requires a clean checkout");
	if (process.version.split(".")[0] !== "v22")
		throw new Error(`staging requires Node 22; received ${process.version}`);
	const npmVersion = capture("npm", ["--version"]);
	if (npmVersion !== "11.19.1")
		throw new Error(`staging requires npm 11.19.1; received ${npmVersion}`);

	const payloadPath = assertRegularContainedFile(
		"payload.json",
		payloadDirectory,
		"payload.json",
	);
	const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
	const binding = assertPayloadBinding({
		artifactDigest,
		artifactId,
		expectedCommit,
		expectedPayloadDigest,
		expectedTree,
		payload,
		payloadDigest: sha256(payloadPath),
	});
	if (payload.manifest?.path !== "tarballs/manifest.json")
		throw new Error("downloaded payload manifest path is invalid");
	const manifestPath = assertRegularContainedFile(
		payload.manifest.path,
		payloadDirectory,
		"tarball manifest",
	);
	if (sha256(manifestPath) !== payload.manifest.sha256)
		throw new Error("downloaded tarball manifest SHA-256 mismatch");
	const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
	const tarballDirectory = path.dirname(manifestPath);
	assertTarballManifest(manifest, tarballDirectory);
	assertPackedReleaseMetadata(tarballDirectory, manifest);
	assertExactPayloadInventory(payloadDirectory, manifest);
	if (manifest.packages.some(({ version }) => version !== payload.version))
		throw new Error("downloaded payload version mismatch");

	if (fs.existsSync(receiptDirectory))
		throw new Error(
			`staging receipt directory already exists: ${receiptDirectory}`,
		);
	fs.mkdirSync(receiptDirectory);
	const receipt = {
		artifact: binding,
		commit: head,
		stageIdentifiers: [],
		status: "verified-awaiting-staging",
		tarballs: manifest,
		tree,
	};
	writeReceipt(receiptDirectory, receipt);

	try {
		const publicVersions = manifest.packages
			.filter(({ name, version }) => targetAlreadyPublic(name, version))
			.map(({ name, version }) => `${name}@${version}`);
		if (publicVersions.length !== 0)
			throw new Error(
				`target versions already exist publicly: ${publicVersions.join(", ")}`,
			);
		const plan = createStagePlan({ manifest, manifestPath });
		receipt.status = "staging";
		writeReceipt(receiptDirectory, receipt);
		receipt.stageIdentifiers = executeStagePlan({
			onStageReceipt: (_stageReceipt, receipts) => {
				receipt.stageIdentifiers = [...receipts];
				writeReceipt(receiptDirectory, receipt);
			},
			plan,
			runCommand: (command) =>
				run(command.command, command.args, { capture: true }),
		});
		receipt.status = "staged-awaiting-independent-review-and-operator-approval";
		writeReceipt(receiptDirectory, receipt);
	} catch (error) {
		receipt.failure = error.message;
		receipt.status = "partial-staging-failed-closed";
		writeReceipt(receiptDirectory, receipt);
		throw error;
	}
	return receipt;
}

function requiredArgument(name) {
	const index = process.argv.indexOf(name);
	if (index === -1 || !process.argv[index + 1])
		throw new Error(`${name} is required`);
	return process.argv[index + 1];
}

if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	try {
		const command = process.argv[2];
		if (command === "prepare") {
			prepareStagingPayload({
				outputDirectory: path.resolve(requiredArgument("--output-dir")),
			});
		} else if (command === "stage") {
			stageValidatedPayload({
				artifactDigest: requiredArgument("--expected-artifact-digest"),
				artifactId: requiredArgument("--expected-artifact-id"),
				expectedCommit: requiredArgument("--expected-commit"),
				expectedPayloadDigest: requiredArgument("--expected-payload-digest"),
				expectedTree: requiredArgument("--expected-tree"),
				payloadDirectory: path.resolve(requiredArgument("--payload-dir")),
				receiptDirectory: path.resolve(requiredArgument("--receipt-dir")),
			});
		} else {
			throw new Error(
				"usage: stage-beta-release.mjs <prepare|stage> [options]",
			);
		}
	} catch (error) {
		console.error(`[release:stage] ${error.message}`);
		process.exitCode = 1;
	}
}

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const packageNames = [
	"@ignite-element/core",
	"@ignite-element/adapters",
	"@ignite-element/renderer",
	"ignite-element",
];
const repositoryUrl = "git+https://github.com/0xjcf/ignite-element.git";
const actionPins = new Map([
	["actions/checkout", "fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09"],
	["pnpm/action-setup", "b906affcce14559ad1aafd4ab0e942779e9f58b1"],
	["actions/setup-node", "a0853c24544627f65ddf259abe73b1d18a591444"],
	["actions/upload-artifact", "ea165f8d65b6e75b540449e92b4886f43607fa02"],
	["actions/download-artifact", "634f93cb2916e3fdff6788551b99b062d0335ce0"],
]);

function read(relativePath) {
	return fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

function workflowJob(workflow, name) {
	const jobs = [...workflow.matchAll(/^ {2}([a-zA-Z0-9_-]+):\s*$/gm)];
	const index = jobs.findIndex((match) => match[1] === name);
	assert.notEqual(index, -1, `workflow must define the ${name} job`);
	return workflow.slice(jobs[index].index, jobs[index + 1]?.index);
}

function workflowActionSteps(job, action) {
	return job
		.split(/\n(?= {6}- )/)
		.filter((step) => step.includes(`uses: ${action}@`));
}

function workflowNamedSteps(job) {
	return job
		.split(/\n(?= {6}- )/)
		.filter((step) => step.startsWith("      - "));
}

function workflowRunScript(step) {
	const marker = "        run: |\n";
	const start = step.indexOf(marker);
	assert.notEqual(start, -1, "workflow step must contain a literal run block");
	return step
		.slice(start + marker.length)
		.split("\n")
		.map((line) => (line.startsWith("          ") ? line.slice(10) : line))
		.join("\n");
}

function runGit(cwd, args) {
	const result = spawnSync("git", args, { cwd, encoding: "utf8" });
	assert.equal(
		result.status,
		0,
		`git ${args.join(" ")} failed: ${result.stderr}`,
	);
	return result.stdout;
}

function writeFixtureFile(directory, relativePath, content) {
	const file = path.join(directory, relativePath);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, content);
}

function initializeGitFixture(prefix) {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
	runGit(directory, ["init", "-b", "beta"]);
	runGit(directory, ["config", "user.email", "release-test@example.com"]);
	runGit(directory, ["config", "user.name", "Release Test"]);
	return directory;
}

function commitFixture(directory) {
	runGit(directory, ["add", "."]);
	runGit(directory, ["commit", "-m", "fixture"]);
}

function createPorcelainFixture() {
	const directory = initializeGitFixture("ignite-porcelain-test-");
	for (const relativePath of [
		".changeset/pre.json",
		"packages/ignite-core/package.json",
		"filename with spaces.txt",
		"trailing-space ",
		"embedded\nnewline.txt",
	]) {
		writeFixtureFile(directory, relativePath, "before\n");
	}
	commitFixture(directory);
	for (const relativePath of [
		".changeset/pre.json",
		"packages/ignite-core/package.json",
		"filename with spaces.txt",
		"trailing-space ",
		"embedded\nnewline.txt",
	]) {
		writeFixtureFile(directory, relativePath, "after\n");
	}
	writeFixtureFile(directory, "ordinary untracked.txt", "untracked\n");
	return directory;
}

function createPreparationFixture() {
	const directory = initializeGitFixture("ignite-release-prepare-test-");
	fs.mkdirSync(path.join(directory, "scripts"), { recursive: true });
	fs.copyFileSync(
		path.join(repositoryRoot, "scripts/prepare-beta-release.mjs"),
		path.join(directory, "scripts/prepare-beta-release.mjs"),
	);
	writeFixtureFile(directory, "package.json", '{"type":"module"}\n');
	writeFixtureFile(directory, ".changeset/config.json", '{"commit":true}\n');
	writeFixtureFile(
		directory,
		".changeset/pre.json",
		'{"mode":"pre","tag":"beta","changesets":[]}\n',
	);
	writeFixtureFile(
		directory,
		".changeset/leading-dot.md",
		'---\n"ignite-element": patch\n---\n\nFixture.\n',
	);
	for (const [packageDirectory, name, dependencies] of [
		["ignite-core", "@ignite-element/core", undefined],
		[
			"ignite-adapters",
			"@ignite-element/adapters",
			{ "@ignite-element/core": "workspace:*" },
		],
		["ignite-renderer", "@ignite-element/renderer", undefined],
		[
			"ignite-element",
			"ignite-element",
			{
				"@ignite-element/adapters": "workspace:*",
				"@ignite-element/core": "workspace:*",
				"@ignite-element/renderer": "workspace:*",
			},
		],
	]) {
		writeFixtureFile(
			directory,
			`packages/${packageDirectory}/package.json`,
			`${JSON.stringify({ dependencies, name, version: "3.0.0-beta.10" })}\n`,
		);
	}
	const fakePnpm = path.join(directory, "bin/pnpm");
	writeFixtureFile(
		directory,
		"bin/pnpm",
		`#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
if (args[0] === "exec" && args[1] === "changeset" && args[2] === "version") {
	const prePath = path.join(process.cwd(), ".changeset/pre.json");
	const pre = JSON.parse(fs.readFileSync(prePath, "utf8"));
	pre.changesets.push("leading-dot");
	fs.writeFileSync(prePath, JSON.stringify(pre, null, "\\t") + "\\n");
	for (const directory of ["ignite-core", "ignite-adapters", "ignite-renderer", "ignite-element"]) {
		const manifestPath = path.join(process.cwd(), "packages", directory, "package.json");
		const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
		manifest.version = "3.0.0-beta.11";
		fs.writeFileSync(manifestPath, JSON.stringify(manifest) + "\\n");
	}
}
`,
	);
	fs.chmodSync(fakePnpm, 0o755);
	commitFixture(directory);
	return directory;
}

describe("v3 beta staged-release boundary", () => {
	it("removes obsolete token-refresh automation and credentials", () => {
		for (const relativePath of [
			".github/workflows/refresh-token.yml",
			"scripts/refresh-npm-token.js",
			"scripts/__tests__/refresh-npm-token.test.js",
		]) {
			assert.equal(
				fs.existsSync(path.join(repositoryRoot, relativePath)),
				false,
			);
		}
	});

	it("keeps package lifecycle hooks unable to publish or stage", () => {
		for (const directory of [
			"ignite-core",
			"ignite-adapters",
			"ignite-renderer",
			"ignite-element",
		]) {
			const manifest = JSON.parse(read(`packages/${directory}/package.json`));
			assert.equal(manifest.scripts?.postrelease, undefined);
			for (const [name, command] of Object.entries(manifest.scripts ?? {})) {
				assert.doesNotMatch(
					command,
					/(?:pnpm|npm)\s+(?:stage\s+)?publish|changeset\s+publish/,
					`${manifest.name} ${name} must not publish or stage`,
				);
			}
		}
	});

	it("keeps general CI validation-only", () => {
		const workflow = read(".github/workflows/ci.yml");
		assert.doesNotMatch(
			workflow,
			/NPM_TOKEN|changesets\/action|\bnpm\s+(?:stage\s+)?publish\b|\bpnpm\s+publish\b|\bchangeset\s+publish\b|\bdist-tag\b/,
		);
		assert.doesNotMatch(workflow, /^\s{2}release:\s*$/m);
	});

	it("defines the guarded OIDC-only staging workflow", () => {
		const workflow = read(".github/workflows/publish.yml");
		assert.match(workflow, /workflow_dispatch:/);
		assert.match(workflow, /github\.ref\s*==\s*'refs\/heads\/beta'/);
		assert.match(workflow, /environment:\s*npm-stage/);
		assert.match(workflow, /contents:\s*read/);
		assert.match(workflow, /id-token:\s*write/);
		assert.match(workflow, /node-version:\s*["']?22["']?/);
		assert.match(workflow, /npm(?:@|\s+)11\.19\.1/);
		assert.match(workflow, /pnpm install --frozen-lockfile/);
		assert.doesNotMatch(workflow, /NPM_TOKEN|stage\s+approve|npm\s+publish/);
	});

	it("declares the exact repository identity on all release packages", () => {
		for (const directory of [
			"ignite-core",
			"ignite-adapters",
			"ignite-renderer",
			"ignite-element",
		]) {
			const manifest = JSON.parse(read(`packages/${directory}/package.json`));
			assert.deepEqual(manifest.repository, {
				type: "git",
				url: repositoryUrl,
			});
		}
	});

	it("pins every release action to its authenticated full commit SHA", () => {
		const workflow = read(".github/workflows/publish.yml");
		const actions = [...workflow.matchAll(/^\s*uses:\s*([^@\s]+)@([^\s#]+)/gm)];
		assert.ok(actions.length >= 5, "split workflow must use reviewed actions");
		for (const [, action, revision] of actions) {
			assert.match(revision, /^[0-9a-f]{40}$/);
			assert.equal(
				revision,
				actionPins.get(action),
				`${action} pin is unreviewed`,
			);
		}
	});

	it("serializes staging runs without cancelling an in-flight release", () => {
		const workflow = read(".github/workflows/publish.yml");
		assert.match(workflow, /^concurrency:\n {2}group: ignite-v3-beta-stage$/m);
		assert.match(workflow, /^ {2}cancel-in-progress: false$/m);
	});

	it("keeps OIDC authority only in the protected staging job", () => {
		const workflow = read(".github/workflows/publish.yml");
		const validate = workflowJob(workflow, "validate");
		const stage = workflowJob(workflow, "stage");
		assert.match(validate, /permissions:\n\s+contents: read/);
		assert.doesNotMatch(validate, /id-token:\s*write/);
		assert.match(stage, /permissions:\n\s+contents: read\n\s+id-token: write/);
		assert.match(stage, /needs:\s*validate/);
	});

	it("keeps the protected npm environment only in the staging job", () => {
		const workflow = read(".github/workflows/publish.yml");
		const validate = workflowJob(workflow, "validate");
		const stage = workflowJob(workflow, "stage");
		assert.doesNotMatch(validate, /environment:/);
		assert.match(stage, /environment:\s*npm-stage/);
	});

	it("disables package-manager caching in both release jobs", () => {
		const workflow = read(".github/workflows/publish.yml");
		const jobs = [
			["validate", workflowJob(workflow, "validate")],
			["stage", workflowJob(workflow, "stage")],
		];
		let setupNodeUses = 0;
		for (const [name, job] of jobs) {
			const setupNodeSteps = workflowActionSteps(job, "actions/setup-node");
			assert.equal(
				setupNodeSteps.length,
				1,
				`${name} must contain exactly one setup-node step`,
			);
			setupNodeUses += setupNodeSteps.length;
			assert.match(
				setupNodeSteps[0],
				/^ {10}package-manager-cache: false$/m,
				`${name} setup-node must explicitly disable package-manager caching`,
			);
			assert.doesNotMatch(job, /^\s+cache:\s/m);
			assert.doesNotMatch(job, /actions\/cache@/);
		}
		assert.equal(setupNodeUses, 2);
	});

	it("binds staging to the exact downloaded validation artifact", () => {
		const workflow = read(".github/workflows/publish.yml");
		const validate = workflowJob(workflow, "validate");
		const stage = workflowJob(workflow, "stage");
		for (const output of [
			"artifact-id",
			"artifact-digest",
			"payload-digest",
			"commit",
			"tree",
		]) {
			assert.match(validate, new RegExp(`${output}:`));
		}
		assert.match(stage, /actions\/download-artifact@[0-9a-f]{40}/);
		assert.match(
			stage,
			/artifact-ids:\s*\$\{\{ needs\.validate\.outputs\.artifact-id \}\}/,
		);
		for (const argument of [
			"--expected-artifact-id",
			"--expected-artifact-digest",
			"--expected-payload-digest",
			"--expected-commit",
			"--expected-tree",
			"--payload-dir",
		]) {
			assert.match(stage, new RegExp(argument));
		}
		assert.doesNotMatch(stage, /pnpm\s+install|pnpm\s+run|changeset/);
	});

	it("uploads a fail-closed fallback when staging produces no receipt", () => {
		const workflow = read(".github/workflows/publish.yml");
		const stage = workflowJob(workflow, "stage");
		const steps = workflowNamedSteps(stage);
		const uploadIndex = steps.findIndex((step) =>
			step.startsWith(
				"      - name: Upload bounded incremental staging receipt\n",
			),
		);
		assert.notEqual(uploadIndex, -1, "staging receipt upload step is required");
		assert.equal(
			steps[uploadIndex],
			`      - name: Upload bounded incremental staging receipt
        if: always()
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
        with:
          name: ignite-beta-stage-receipt-\${{ github.sha }}
          path: \${{ runner.temp }}/ignite-beta-stage-receipt
          if-no-files-found: error
          retention-days: 14
`,
			"the existing upload step must remain byte-for-byte unchanged",
		);

		const fallbackIndex = steps.findIndex((step) =>
			step.startsWith(
				"      - name: Create fallback staging failure receipt\n",
			),
		);
		assert.notEqual(fallbackIndex, -1, "fallback receipt step is required");
		assert.equal(
			fallbackIndex + 1,
			uploadIndex,
			"fallback receipt step must immediately precede receipt upload",
		);

		const fallback = steps[fallbackIndex];
		assert.match(fallback, /^ {8}if: \$\{\{ always\(\) \}\}$/m);
		assert.match(
			fallback,
			/^ {10}STAGE_OUTCOME: \$\{\{ steps\.staging\.outcome \}\}$/m,
		);
		assert.match(
			fallback,
			/^ {10}STAGE_RECEIPT_FILE: \$\{\{ runner\.temp \}\}\/ignite-beta-stage-receipt\/receipt\.json$/m,
		);
		assert.match(fallback, /writeFileSync\([\s\S]*flag: "wx"/);
		assert.doesNotMatch(fallback, /continue-on-error|\|\| true/);
		assert.doesNotMatch(
			fallback,
			/\b(?:npm|pnpm)\s+(?:stage\s+)?(?:publish|approve|reject)|\bdist-tag\b/,
		);

		const script = workflowRunScript(fallback);
		const directory = fs.mkdtempSync(
			path.join(os.tmpdir(), "ignite-fallback-receipt-test-"),
		);
		const receiptFile = path.join(directory, "receipt.json");
		const environment = {
			...process.env,
			STAGE_COMMIT: "1".repeat(40),
			STAGE_OUTCOME: "success",
			STAGE_RECEIPT_FILE: receiptFile,
			STAGE_RUN_ATTEMPT: "2",
			STAGE_RUN_ID: "123456789",
		};
		try {
			const existingBytes = Buffer.from(
				'{"schemaVersion":1,"kind":"incremental-stage-receipt","stageId":"preserve-me"}\n',
			);
			fs.writeFileSync(receiptFile, existingBytes);
			const existingResult = spawnSync(
				"bash",
				["-e", "-o", "pipefail", "-c", script],
				{ encoding: "utf8", env: environment },
			);
			assert.equal(existingResult.status, 0, existingResult.stderr);
			assert.deepEqual(fs.readFileSync(receiptFile), existingBytes);

			fs.rmSync(receiptFile);
			const missingResult = spawnSync(
				"bash",
				["-e", "-o", "pipefail", "-c", script],
				{ encoding: "utf8", env: environment },
			);
			assert.notEqual(
				missingResult.status,
				0,
				"a missing receipt must fail even after a successful staging outcome",
			);
			const fallbackBytes = fs.readFileSync(receiptFile, "utf8");
			assert.ok(fallbackBytes.endsWith("\n"));
			assert.deepEqual(JSON.parse(fallbackBytes), {
				schemaVersion: 1,
				kind: "ignite-element-npm-stage-failure",
				status: "failure",
				reason: "staging-receipt-not-produced",
				stageOutcome: "success",
				commit: "1".repeat(40),
				runId: "123456789",
				runAttempt: "2",
			});
			assert.doesNotMatch(
				fallbackBytes,
				/stageId|packages?|registry|credential|stderr|token/i,
			);

			const createdBytes = fs.readFileSync(receiptFile);
			const secondResult = spawnSync(
				"bash",
				["-e", "-o", "pipefail", "-c", script],
				{ encoding: "utf8", env: environment },
			);
			assert.equal(secondResult.status, 0, secondResult.stderr);
			assert.deepEqual(fs.readFileSync(receiptFile), createdBytes);
		} finally {
			fs.rmSync(directory, { recursive: true, force: true });
		}
	});

	it("fails closed when downloaded payload identity or hashes differ", async () => {
		const { assertPayloadBinding } = await import("./stage-beta-release.mjs");
		const commit = "1".repeat(40);
		const tree = "2".repeat(40);
		const payloadDigest = "3".repeat(64);
		const valid = {
			artifactDigest: "4".repeat(64),
			artifactId: "12345",
			expectedCommit: commit,
			expectedPayloadDigest: payloadDigest,
			expectedTree: tree,
			payload: {
				branchRef: "refs/heads/beta",
				commit,
				repository: "0xjcf/ignite-element",
				schemaVersion: 1,
				tree,
			},
			payloadDigest,
		};
		assert.doesNotThrow(() => assertPayloadBinding(valid));
		for (const candidate of [
			{ ...valid, artifactId: "not-an-id" },
			{ ...valid, artifactDigest: "short" },
			{ ...valid, payloadDigest: "5".repeat(64) },
			{
				...valid,
				payload: { ...valid.payload, commit: "6".repeat(40) },
			},
			{ ...valid, payload: { ...valid.payload, tree: "7".repeat(40) } },
		]) {
			assert.throws(() => assertPayloadBinding(candidate));
		}
	});

	it("documents default-branch registration and four-package trusted publishing", () => {
		const documentation = read("docs/v3-beta-staged-release.md");
		for (const required of [
			"Provider: GitHub Actions",
			"Owner/organization: 0xjcf",
			"Repository: ignite-element",
			"Workflow filename: publish.yml",
			"Environment: npm-stage",
			"Allowed action: npm stage publish only",
		]) {
			assert.match(documentation, new RegExp(required));
		}
		assert.match(documentation, /default branch `main`/);
		assert.match(documentation, /does not specify the Git branch/);
		assert.match(documentation, /GitHub owns the `beta` ref guard/);
		assert.match(documentation, /branch protection|ruleset/);
		assert.match(
			documentation,
			/Require two-factor authentication and disallow tokens/,
		);
		assert.match(documentation, /npm stage list --json/);
		assert.match(documentation, /gh workflow run publish\.yml --ref beta/);
	});

	it("forbids direct publication and stage approval in executable release surfaces", () => {
		const executableReleaseSurfaces = [
			".github/workflows/publish.yml",
			"scripts/prepare-beta-release.mjs",
			"scripts/stage-beta-release.mjs",
			"package.json",
			"packages/ignite-core/package.json",
			"packages/ignite-adapters/package.json",
			"packages/ignite-renderer/package.json",
			"packages/ignite-element/package.json",
		]
			.map(read)
			.join("\n");
		assert.doesNotMatch(
			executableReleaseSurfaces,
			/\bnpm\s+publish\b|\bpnpm\s+publish\b|\bchangeset\s+publish\b|\bnpm\s+stage\s+approve\b/,
		);
	});

	it("separates reviewable version preparation from staging", async () => {
		const { PREPARATION_STEPS } = await import("./prepare-beta-release.mjs");
		assert.deepEqual(PREPARATION_STEPS, [
			"check-prerequisites",
			"changeset-version-without-commit",
			"format-version-output",
			"validate-reviewable-candidate",
		]);
		assert.doesNotMatch(
			read("scripts/prepare-beta-release.mjs"),
			/\b(?:npm|pnpm)\s+(?:stage\s+)?publish\b|stage\s+approve|git\s+(?:commit|amend|tag|push)|--no-verify/,
		);
		assert.doesNotMatch(
			read("scripts/stage-beta-release.mjs"),
			/changeset\s+version|stage\s+approve|git\s+(?:commit|amend|tag|push)|--no-verify/,
		);
	});

	it("flows four exact validated tarballs into staging", async () => {
		const { createTarballManifest, createStagePlan } = await import(
			"./stage-beta-release.mjs"
		);
		const directory = fs.mkdtempSync(
			path.join(os.tmpdir(), "ignite-stage-test-"),
		);
		try {
			const candidates = packageNames.map((name, index) => {
				const file = path.join(directory, `package-${index}.tgz`);
				fs.writeFileSync(file, `tarball-${index}`);
				return { file, name, version: "3.0.0-beta.10" };
			});
			const manifest = createTarballManifest(candidates, directory);
			const manifestPath = path.join(directory, "tarballs.json");
			const plan = createStagePlan({ manifest, manifestPath });
			assert.deepEqual(
				manifest.packages.map(({ name }) => name),
				packageNames,
			);
			assert.equal(plan.consumerValidation, undefined);
			assert.deepEqual(
				plan.stageCommands.map(({ tarball }) => tarball),
				candidates.map(({ file }) => file),
			);
			for (const command of plan.stageCommands) {
				assert.deepEqual(command.args.slice(0, 2), ["stage", "publish"]);
				for (const required of ["--json", "--provenance", "--tag", "beta"])
					assert.ok(command.args.includes(required));
				assert.ok(!command.args.includes("approve"));
			}
		} finally {
			fs.rmSync(directory, { recursive: true, force: true });
		}
	});

	it("fails closed for a missing or changed reviewed tarball", async () => {
		const { assertTarballManifest, createTarballManifest } = await import(
			"./stage-beta-release.mjs"
		);
		const directory = fs.mkdtempSync(
			path.join(os.tmpdir(), "ignite-stage-hash-test-"),
		);
		try {
			const candidates = packageNames.map((name, index) => {
				const file = path.join(directory, `package-${index}.tgz`);
				fs.writeFileSync(file, `tarball-${index}`);
				return { file, name, version: "3.0.0-beta.10" };
			});
			const manifest = createTarballManifest(candidates, directory);
			fs.writeFileSync(candidates[2].file, "changed");
			assert.throws(
				() => assertTarballManifest(manifest, directory),
				/SHA-256 mismatch/,
			);
			fs.rmSync(candidates[2].file);
			assert.throws(
				() => assertTarballManifest(manifest, directory),
				/missing tarball/,
			);
		} finally {
			fs.rmSync(directory, { recursive: true, force: true });
		}
	});

	it("captures structured stage identifiers and rejects a missing ID", async () => {
		const { parseStagePublishReceipt } = await import(
			"./stage-beta-release.mjs"
		);
		const stageId = "7c0c4f9c-e72d-4ac0-81be-d32e79884c7b";
		assert.deepEqual(
			parseStagePublishReceipt(
				JSON.stringify({
					name: "@ignite-element/core",
					version: "3.0.0-beta.10",
					stageId,
				}),
				{ name: "@ignite-element/core", version: "3.0.0-beta.10" },
			),
			{ name: "@ignite-element/core", stageId, version: "3.0.0-beta.10" },
		);
		assert.throws(
			() =>
				parseStagePublishReceipt(
					JSON.stringify({
						name: "@ignite-element/core",
						version: "3.0.0-beta.10",
					}),
					{ name: "@ignite-element/core", version: "3.0.0-beta.10" },
				),
			/missing a valid stageId/,
		);
	});

	it("tests staging order through an injected runner and stops on failure", async () => {
		const { createStagePlan, createTarballManifest, executeStagePlan } =
			await import("./stage-beta-release.mjs");
		const directory = fs.mkdtempSync(
			path.join(os.tmpdir(), "ignite-stage-runner-test-"),
		);
		try {
			const candidates = packageNames.map((name, index) => {
				const file = path.join(directory, `package-${index}.tgz`);
				fs.writeFileSync(file, `tarball-${index}`);
				return { file, name, version: "3.0.0-beta.10" };
			});
			const manifest = createTarballManifest(candidates, directory);
			const plan = createStagePlan({
				manifest,
				manifestPath: path.join(directory, "tarballs.json"),
			});
			const calls = [];
			const receipts = executeStagePlan({
				plan,
				runCommand: (command) => {
					calls.push(command);
					const index = packageNames.indexOf(command.name);
					return JSON.stringify({
						name: command.name,
						version: command.version,
						stageId: `00000000-0000-4000-8000-00000000000${index}`,
					});
				},
			});
			assert.deepEqual(
				calls.map(({ kind }) => kind),
				["stage-publish", "stage-publish", "stage-publish", "stage-publish"],
			);
			assert.deepEqual(
				receipts.map(({ name }) => name),
				packageNames,
			);

			let attempted = 0;
			assert.throws(
				() =>
					executeStagePlan({
						plan,
						runCommand: (command) => {
							attempted += 1;
							if (attempted === 3) throw new Error("registry unavailable");
							return JSON.stringify({
								name: command.name,
								version: command.version,
								stageId: `10000000-0000-4000-8000-00000000000${attempted}`,
							});
						},
					}),
				/registry unavailable/,
			);
			assert.equal(attempted, 3);
		} finally {
			fs.rmSync(directory, { recursive: true, force: true });
		}
	});

	it("rejects invalid branch, custody, version, Changesets, and registry state", async () => {
		const { assertStagingPreconditions } = await import(
			"./stage-beta-release.mjs"
		);
		const valid = {
			branchRef: "refs/heads/beta",
			clean: true,
			pendingChangesets: [],
			preState: { mode: "pre", tag: "beta" },
			publicVersions: [],
			versions: Object.fromEntries(
				packageNames.map((name) => [name, "3.0.0-beta.10"]),
			),
		};
		assert.doesNotThrow(() => assertStagingPreconditions(valid));
		for (const candidate of [
			{ ...valid, branchRef: "refs/heads/main" },
			{ ...valid, clean: false },
			{
				...valid,
				versions: { ...valid.versions, "ignite-element": "3.0.0-beta.9" },
			},
			{ ...valid, pendingChangesets: ["unconsumed"] },
			{ ...valid, publicVersions: ["@ignite-element/core@3.0.0-beta.10"] },
		])
			assert.throws(() => assertStagingPreconditions(candidate));
	});

	it("verifies the explicit post-approval tag policy", async () => {
		const { assertApprovedRelease } = await import("./verify-beta-release.mjs");
		const version = "3.0.0-beta.10";
		const metadata = Object.fromEntries(
			packageNames.map((name) => [
				name,
				{
					dependencies:
						name === "ignite-element"
							? {
									"@ignite-element/adapters": version,
									"@ignite-element/core": version,
									"@ignite-element/renderer": version,
								}
							: {},
					dist: {
						attestations: { url: "https://registry.example/attestation" },
					},
					tags: {
						beta: version,
						latest: name === "ignite-element" ? "2.2.2" : version,
					},
					version,
				},
			]),
		);
		assert.doesNotThrow(() =>
			assertApprovedRelease({ expectedVersion: version, metadata }),
		);
		metadata["ignite-element"].tags.latest = version;
		assert.throws(
			() => assertApprovedRelease({ expectedVersion: version, metadata }),
			/facade latest/,
		);
	});
});

describe("lossless porcelain status parsing", () => {
	it("preserves the first leading-dot path during real beta preparation", async () => {
		const directory = createPreparationFixture();
		const originalPath = process.env.PATH;
		try {
			process.env.PATH = `${path.join(directory, "bin")}${path.delimiter}${originalPath}`;
			const moduleUrl = pathToFileURL(
				path.join(directory, "scripts/prepare-beta-release.mjs"),
			);
			const { prepareBetaRelease } = await import(
				`${moduleUrl.href}?fixture=${Date.now()}`
			);
			assert.doesNotThrow(
				() => prepareBetaRelease(),
				".changeset/pre.json must remain an allowed leading-dot path",
			);
		} finally {
			process.env.PATH = originalPath;
			fs.rmSync(directory, { recursive: true, force: true });
		}
	});

	it("parses real NUL-delimited records without changing path bytes", async () => {
		const directory = createPorcelainFixture();
		try {
			const { parsePorcelainStatus } = await import(
				`./prepare-beta-release.mjs?parser=${Date.now()}`
			);
			const raw = runGit(directory, [
				"status",
				"--porcelain=v1",
				"-z",
				"--untracked-files=all",
			]);
			const paths = parsePorcelainStatus(raw);
			assert.equal(paths[0], ".changeset/pre.json");
			for (const expected of [
				"packages/ignite-core/package.json",
				"filename with spaces.txt",
				"trailing-space ",
				"embedded\nnewline.txt",
				"ordinary untracked.txt",
			]) {
				assert.ok(paths.includes(expected), `missing exact path ${expected}`);
			}

			const records = raw.split("\0");
			assert.equal(records.pop(), "");
			const reordered = `${[records.at(-1), ...records.slice(0, -1)].join("\0")}\0`;
			assert.deepEqual(
				new Set(parsePorcelainStatus(reordered)),
				new Set(paths),
			);
		} finally {
			fs.rmSync(directory, { recursive: true, force: true });
		}
	});

	it("returns an empty path list for a clean real repository", async () => {
		const directory = initializeGitFixture("ignite-porcelain-clean-test-");
		try {
			writeFixtureFile(directory, "tracked.txt", "tracked\n");
			commitFixture(directory);
			const { parsePorcelainStatus } = await import(
				`./prepare-beta-release.mjs?clean=${Date.now()}`
			);
			assert.deepEqual(
				parsePorcelainStatus(
					runGit(directory, [
						"status",
						"--porcelain=v1",
						"-z",
						"--untracked-files=all",
					]),
				),
				[],
			);
		} finally {
			fs.rmSync(directory, { recursive: true, force: true });
		}
	});

	it("fails closed for rename, copy, and malformed records", async () => {
		const directory = initializeGitFixture("ignite-porcelain-rename-test-");
		try {
			writeFixtureFile(directory, "before.txt", "tracked\n");
			commitFixture(directory);
			runGit(directory, ["mv", "before.txt", "after.txt"]);
			const { parsePorcelainStatus } = await import(
				`./prepare-beta-release.mjs?rename=${Date.now()}`
			);
			assert.throws(
				() =>
					parsePorcelainStatus(
						runGit(directory, [
							"status",
							"--porcelain=v1",
							"-z",
							"--untracked-files=all",
						]),
					),
				/rename or copy/,
			);
			assert.throws(
				() => parsePorcelainStatus("C  copied.txt\0source.txt\0"),
				/rename or copy/,
			);
			assert.throws(() => parsePorcelainStatus("M! invalid.txt\0"));
			assert.throws(() => parsePorcelainStatus("M  missing-nul.txt"));
		} finally {
			fs.rmSync(directory, { recursive: true, force: true });
		}
	});
});

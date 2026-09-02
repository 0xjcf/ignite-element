import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

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
	[
		"actions/download-artifact",
		"634f93cb2916e3fdff6788551b99b062d0335ce0",
	],
]);

function read(relativePath) {
	return fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

function workflowJob(workflow, name) {
	const jobs = [...workflow.matchAll(/^  ([a-zA-Z0-9_-]+):\s*$/gm)];
	const index = jobs.findIndex((match) => match[1] === name);
	assert.notEqual(index, -1, `workflow must define the ${name} job`);
	return workflow.slice(jobs[index].index, jobs[index + 1]?.index);
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
			assert.equal(revision, actionPins.get(action), `${action} pin is unreviewed`);
		}
	});

	it("serializes staging runs without cancelling an in-flight release", () => {
		const workflow = read(".github/workflows/publish.yml");
		assert.match(workflow, /^concurrency:\n  group: ignite-v3-beta-stage$/m);
		assert.match(workflow, /^  cancel-in-progress: false$/m);
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
		assert.doesNotMatch(workflow, /^\s+cache:\s/m);
		assert.doesNotMatch(workflow, /actions\/cache@/);
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
		assert.match(stage, /artifact-ids:\s*\$\{\{ needs\.validate\.outputs\.artifact-id \}\}/);
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
		assert.match(documentation, /Require two-factor authentication and disallow tokens/);
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

	it("flows four exact tarballs from consumer validation to staging", async () => {
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
			assert.deepEqual(plan.consumerValidation.args, [
				path.join(repositoryRoot, "scripts/verify-packed-consumers.mjs"),
				"--tarball-manifest",
				manifestPath,
			]);
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
					if (command.kind === "consumer-validation") return "";
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
				[
					"consumer-validation",
					"stage-publish",
					"stage-publish",
					"stage-publish",
					"stage-publish",
				],
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
							if (command.kind === "consumer-validation") return "";
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

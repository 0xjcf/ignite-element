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

function read(relativePath) {
	return fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
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
		const manifest = JSON.parse(read("packages/ignite-element/package.json"));
		assert.equal(manifest.scripts.postrelease, undefined);
		for (const [name, command] of Object.entries(manifest.scripts)) {
			assert.doesNotMatch(
				command,
				/(?:pnpm|npm)\s+(?:stage\s+)?publish|changeset\s+publish/,
				`${name} must not publish or stage`,
			);
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

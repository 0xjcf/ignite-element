import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	assertBetaDistTags,
	createBetaPublishPlan,
	createDistTagReadCommand,
	createDistTagRecoveryInstructions,
	verifyBetaDistTagsWithRetry,
} from "./release-beta.mjs";

const releasePackages = [
	{ name: "ignite-element", version: "3.0.0-beta.9" },
	{ name: "@ignite-element/core", version: "3.0.0-beta.9" },
	{ name: "@ignite-element/adapters", version: "3.0.0-beta.9" },
	{ name: "@ignite-element/renderer", version: "3.0.0-beta.9" },
];

const expectedTags = {
	"ignite-element": {
		beta: "3.0.0-beta.9",
		latest: "2.2.2",
	},
	"@ignite-element/core": {
		beta: "3.0.0-beta.9",
		latest: "3.0.0-beta.9",
	},
	"@ignite-element/adapters": {
		beta: "3.0.0-beta.9",
		latest: "3.0.0-beta.9",
	},
	"@ignite-element/renderer": {
		beta: "3.0.0-beta.9",
		latest: "3.0.0-beta.9",
	},
};

const staleTags = {
	...expectedTags,
	"@ignite-element/core": {
		beta: "3.0.0-beta.2",
		latest: "3.0.0-beta.8",
	},
};

describe("release-beta", () => {
	it("keeps the dry-run plan inert", () => {
		const plan = createBetaPublishPlan({
			dryRun: true,
			preMode: true,
			releasePackages,
		});

		assert.equal(
			plan.publishCommand,
			"pnpm -r publish --dry-run --no-git-checks --tag beta",
		);
		assert.deepEqual(plan.distTagCommands, []);
		assert.doesNotMatch(plan.publishCommand, /changeset publish|npm dist-tag/);
	});

	it("repairs the beta tag for every lockstep package after a real publish", () => {
		const plan = createBetaPublishPlan({
			dryRun: false,
			preMode: true,
			releasePackages,
		});

		assert.equal(plan.publishCommand, "pnpm changeset publish");
		assert.deepEqual(plan.distTagCommands, [
			"npm dist-tag add ignite-element@3.0.0-beta.9 beta",
			"npm dist-tag add @ignite-element/core@3.0.0-beta.9 beta",
			"npm dist-tag add @ignite-element/adapters@3.0.0-beta.9 beta",
			"npm dist-tag add @ignite-element/renderer@3.0.0-beta.9 beta",
		]);
	});

	it("rejects a non-lockstep or non-prerelease publish plan", () => {
		assert.throws(
			() =>
				createBetaPublishPlan({
					dryRun: false,
					preMode: true,
					releasePackages: releasePackages.map((pkg) =>
						pkg.name === "@ignite-element/core"
							? { ...pkg, version: "3.0.0-beta.8" }
							: pkg,
					),
				}),
			/lockstep prerelease version/,
		);
		assert.throws(
			() =>
				createBetaPublishPlan({
					dryRun: false,
					preMode: true,
					releasePackages: releasePackages.map((pkg) => ({
						...pkg,
						version: "$(unsafe)-beta.9",
					})),
				}),
			/lockstep prerelease version/,
		);
	});

	it("accepts repaired beta tags while preserving the main stable latest tag", () => {
		assert.doesNotThrow(() =>
			assertBetaDistTags({
				expectedVersion: "3.0.0-beta.9",
				mainLatestBefore: "2.2.2",
				tagsByPackage: expectedTags,
			}),
		);
	});

	it("rejects stale scoped beta tags or a moved main latest tag", () => {
		assert.throws(
			() =>
				assertBetaDistTags({
					expectedVersion: "3.0.0-beta.9",
					mainLatestBefore: "2.2.2",
					tagsByPackage: {
						...expectedTags,
						"ignite-element": {
							beta: "3.0.0-beta.9",
							latest: "3.0.0-beta.9",
						},
						"@ignite-element/core": {
							beta: "3.0.0-beta.2",
							latest: "3.0.0-beta.9",
						},
					},
				}),
			/beta tag|stable latest tag/,
		);
	});

	it("forces dist-tag reads to prefer the online npm registry", () => {
		assert.equal(
			createDistTagReadCommand("@ignite-element/core"),
			"npm view @ignite-element/core dist-tags --json --prefer-online",
		);
	});

	it("retries stale registry snapshots until the expected tags converge", async () => {
		const snapshots = [staleTags, expectedTags];
		const waits = [];

		const result = await verifyBetaDistTagsWithRetry({
			expectedVersion: "3.0.0-beta.9",
			mainLatestBefore: "2.2.2",
			maxAttempts: 3,
			readTags: () => snapshots.shift(),
			retryDelayMs: 25,
			wait: async (delayMs) => waits.push(delayMs),
		});

		assert.equal(result.status, "verified");
		assert.equal(result.attempts, 2);
		assert.deepEqual(waits, [25]);
	});

	it("returns a persistent mismatch fact after the bounded retry budget", async () => {
		let reads = 0;
		const waits = [];

		const result = await verifyBetaDistTagsWithRetry({
			expectedVersion: "3.0.0-beta.9",
			mainLatestBefore: "2.2.2",
			maxAttempts: 3,
			readTags: () => {
				reads += 1;
				return staleTags;
			},
			retryDelayMs: 25,
			wait: async (delayMs) => waits.push(delayMs),
		});

		assert.equal(result.status, "failed");
		assert.equal(result.attempts, 3);
		assert.equal(reads, 3);
		assert.deepEqual(waits, [25, 25]);
		assert.match(result.error.message, /Dist-tag verification failed/);
	});

	it("puts an online recheck before repair commands for verification failures", () => {
		const distTagCommands = [
			"npm dist-tag add ignite-element@3.0.0-beta.9 beta",
		];
		const verificationInstructions = createDistTagRecoveryInstructions({
			distTagCommands,
			kind: "verification",
		});
		const writeInstructions = createDistTagRecoveryInstructions({
			distTagCommands,
			kind: "write",
		});

		const recheckIndex = verificationInstructions.findIndex((line) =>
			line.includes("npm view"),
		);
		const repairIndex = verificationInstructions.findIndex((line) =>
			line.includes("npm dist-tag add"),
		);
		assert.ok(recheckIndex < repairIndex);
		assert.match(verificationInstructions.join("\n"), /recheck/i);
		assert.doesNotMatch(writeInstructions.join("\n"), /recheck/i);
		assert.match(writeInstructions.join("\n"), /fresh npm OTP/i);
	});
});

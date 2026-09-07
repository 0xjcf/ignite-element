import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// These are trusted test-only defaults, not values copied from the caller.
// Reapply them after sanitizing every handoff, including discovery and nested fixtures.
const isolatedConfig = {
	GIT_CONFIG_GLOBAL: os.devNull,
	GIT_CONFIG_SYSTEM: os.devNull,
	GIT_CONFIG_NOSYSTEM: "1",
};

// Hooks export repository-local routing and config. Discover Git's own list
// without letting those inputs poison discovery; never mutate process.env.
export function fixtureGitEnvironment(input = process.env) {
	const discoveryEnv = Object.fromEntries(
		Object.entries(input).filter(([key]) => !key.startsWith("GIT_")),
	);
	const result = spawnSync("git", ["rev-parse", "--local-env-vars"], {
		env: { ...discoveryEnv, ...isolatedConfig },
		encoding: "utf8",
		timeout: 10000,
	});
	assert.equal(
		result.error,
		undefined,
		"fixture Git environment discovery must launch",
	);
	assert.equal(
		result.signal,
		null,
		"fixture Git environment discovery must complete",
	);
	assert.equal(
		result.status,
		0,
		`fixture Git environment discovery failed: ${result.stderr}`,
	);
	const names = result.stdout.trim().split("\n");
	assert.ok(
		names.includes("GIT_DIR") &&
			names.every((name) => /^GIT_[A-Z_]+$/.test(name)),
		"fixture Git environment discovery returned invalid names",
	);
	const local = new Set(names);
	return {
		...Object.fromEntries(
			Object.entries(input).filter(
				([key]) => !local.has(key) && !/^GIT_CONFIG(?:_|$)/.test(key),
			),
		),
		...isolatedConfig,
	};
}

// Authenticate ownership after init, before identity, index, or commit writes.
export function assertFixtureGitOwnership(directory, env) {
	const expected = path.join(fs.realpathSync(directory), ".git");
	for (const [args, target] of [
		[["--absolute-git-dir"], expected],
		[["--path-format=absolute", "--git-common-dir"], expected],
		[
			["--path-format=absolute", "--git-path", "index"],
			path.join(expected, "index"),
		],
	]) {
		const result = spawnSync("git", ["rev-parse", ...args], {
			cwd: directory,
			env,
			encoding: "utf8",
			timeout: 10000,
		});
		assert.equal(
			result.error,
			undefined,
			"fixture Git ownership check must launch",
		);
		assert.equal(result.signal, null);
		assert.equal(
			result.status,
			0,
			`fixture Git ownership check failed: ${result.stderr}`,
		);
		assert.equal(
			result.stdout.trim(),
			target,
			"fixture must own its Git metadata",
		);
	}
}

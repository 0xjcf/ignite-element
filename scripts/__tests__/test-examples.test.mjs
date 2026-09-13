import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

const expectedExampleRoots = [
	"examples/adapters/mobx",
	"examples/adapters/redux",
	"examples/adapters/xstate",
	"examples/agents/smart-home",
	"examples/agents/voice-workbench",
	"examples/apps/dashboard-with-shared-state",
	"examples/apps/form-with-validation",
	"examples/apps/nested-child-router",
	"examples/apps/shared-controller",
	"examples/apps/spa-router",
];
const expectedCoverageArgs = expectedExampleRoots.flatMap((exampleRoot) => [
	"--covers-package",
	exampleRoot,
]);

function runProvisioning(lock) {
	const root = mkdtempSync(path.join(tmpdir(), "ignite-frozen-example-"));
	try {
		const example = path.join(root, "examples/counter");
		const bin = path.join(root, "bin");
		mkdirSync(example, { recursive: true });
		mkdirSync(bin);
		writeFileSync(path.join(example, "package.json"), '{"name":"counter"}');
		writeFileSync(path.join(example, "counter.test.ts"), "");
		writeFileSync(path.join(example, "vitest.config.ts"), "export default {};");
		const lockPath = path.join(example, "pnpm-lock.yaml");
		if (lock !== undefined) writeFileSync(lockPath, lock);
		const log = path.join(root, "calls.jsonl");
		const executable = path.join(bin, "pnpm");
		writeFileSync(
			executable,
			`#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(args) + '\\n');
if (args[0] === 'install' && args.includes('--frozen-lockfile') && fs.readFileSync('pnpm-lock.yaml', 'utf8') === 'stale') {
  console.error('ERR_PNPM_OUTDATED_LOCKFILE: fixture lock does not match manifest');
  process.exit(1);
}
`,
		);
		chmodSync(executable, 0o755);
		const result = spawnSync(
			process.execPath,
			[
				"scripts/test-examples.mjs",
				"--examples-root",
				path.join(root, "examples"),
			],
			{
				env: {
					...process.env,
					PATH: `${bin}${path.delimiter}${process.env.PATH}`,
				},
				encoding: "utf8",
			},
		);
		assert.ifError(result.error);
		return {
			status: result.status,
			output: result.stdout + result.stderr,
			calls: existsSync(log)
				? readFileSync(log, "utf8")
						.trim()
						.split("\n")
						.map((line) => JSON.parse(line))
				: [],
			lock: existsSync(lockPath) ? readFileSync(lockPath, "utf8") : undefined,
		};
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

describe("frozen example provisioning", () => {
	it("requires a lockfile before launching pnpm", () => {
		const result = runProvisioning(undefined);
		assert.equal(result.status, 1);
		assert.match(result.output, /requires an existing pnpm-lock.yaml/);
		assert.deepEqual(result.calls, []);
		assert.equal(result.lock, undefined);
	});
	it("installs frozen with isolated workspace linkage and preserves lock bytes", () => {
		const result = runProvisioning("lockfileVersion: '9.0'\n");
		assert.equal(result.status, 0, result.output);
		assert.deepEqual(result.calls[0], [
			"install",
			"--ignore-workspace",
			"--no-link-workspace-packages",
			"--frozen-lockfile",
		]);
		assert.equal(result.calls.length, 2);
		assert.ok(result.calls[1].includes("vitest"));
		assert.equal(result.lock, "lockfileVersion: '9.0'\n");
	});
	it("surfaces stale-lock failure without running tests or changing the lock", () => {
		const result = runProvisioning("stale");
		assert.equal(result.status, 1);
		assert.match(result.output, /ERR_PNPM_OUTDATED_LOCKFILE/);
		assert.equal(result.calls.length, 1);
		assert.equal(result.lock, "stale");
	});
});

describe("test-examples", () => {
	it("admits every runtime-tested example to the root and FAS full lanes", () => {
		const packageJson = JSON.parse(
			readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
		);
		const fasConfig = JSON.parse(
			readFileSync(new URL("../../.fas-config.json", import.meta.url), "utf8"),
		);

		assert.equal(packageJson.scripts.test, "pnpm run test:full");
		for (const exampleRoot of expectedExampleRoots) {
			const coverageArgument = `--covers-package ${exampleRoot}`;
			assert.match(
				packageJson.scripts["test:full"],
				new RegExp(coverageArgument),
			);
			assert.match(fasConfig.testCommand, new RegExp(coverageArgument));
		}
	});

	it("discovers example roots with runtime tests", () => {
		const output = execFileSync(
			"node",
			["scripts/test-examples.mjs", "--list"],
			{
				encoding: "utf8",
			},
		);

		assert.deepEqual(output.trim().split("\n"), expectedExampleRoots);
	});

	it("supports equals syntax for the examples root", () => {
		const output = execFileSync(
			"node",
			["scripts/test-examples.mjs", "--list", "--examples-root=examples"],
			{
				encoding: "utf8",
			},
		);

		assert.deepEqual(output.trim().split("\n"), expectedExampleRoots);
	});

	it("validates covered example packages are discovered", () => {
		const output = execFileSync(
			"node",
			[
				"scripts/test-examples.mjs",
				"--list",
				"--require-covered-packages-match-discovered",
				...expectedCoverageArgs,
			],
			{
				encoding: "utf8",
			},
		);

		assert.deepEqual(output.trim().split("\n"), expectedExampleRoots);
	});

	it("lists only the covered packages when a focused runtime lane is requested", () => {
		const output = execFileSync(
			"node",
			[
				"scripts/test-examples.mjs",
				"--list",
				"--covers-package",
				"examples/adapters/redux",
				"--covers-package",
				"examples/adapters/mobx",
			],
			{
				encoding: "utf8",
			},
		);

		assert.deepEqual(output.trim().split("\n"), [
			"examples/adapters/mobx",
			"examples/adapters/redux",
		]);
	});

	it("fails when a runtime test is outside an example package", () => {
		const examplesRoot = mkdtempSync(path.join(tmpdir(), "ignite-examples-"));
		const orphanDir = path.join(examplesRoot, "orphan", "src");

		mkdirSync(orphanDir, { recursive: true });
		writeFileSync(path.join(orphanDir, "orphan.test.ts"), "");

		try {
			assert.throws(
				() =>
					execFileSync(
						"node",
						["scripts/test-examples.mjs", "--examples-root", examplesRoot],
						{
							encoding: "utf8",
							stderr: "pipe",
						},
					),
				(error) => {
					assert.equal(error.status, 1);
					assert.match(
						String(error.stderr),
						/Runtime test is not inside an example package: /,
					);
					return true;
				},
			);
		} finally {
			rmSync(examplesRoot, { force: true, recursive: true });
		}
	});

	it("rejects path-valued flags without a path", () => {
		assert.throws(
			() =>
				execFileSync(
					"node",
					["scripts/test-examples.mjs", "--examples-root", "--list"],
					{
						encoding: "utf8",
						stderr: "pipe",
					},
				),
			(error) => {
				assert.equal(error.status, 1);
				assert.match(String(error.stderr), /--examples-root requires a path\./);
				return true;
			},
		);

		assert.throws(
			() =>
				execFileSync(
					"node",
					["scripts/test-examples.mjs", "--list", "--covers-package", "--list"],
					{
						encoding: "utf8",
						stderr: "pipe",
					},
				),
			(error) => {
				assert.equal(error.status, 1);
				assert.match(
					String(error.stderr),
					/--covers-package requires a path\./,
				);
				return true;
			},
		);
	});

	it("fails when a covered example package has no runtime tests", () => {
		const examplesRoot = mkdtempSync(path.join(tmpdir(), "ignite-examples-"));
		const testedExampleDir = path.join(examplesRoot, "tested", "src");
		const uncoveredExampleRoot = path.join(examplesRoot, "uncovered");

		mkdirSync(testedExampleDir, { recursive: true });
		mkdirSync(uncoveredExampleRoot, { recursive: true });
		writeFileSync(
			path.join(examplesRoot, "tested", "package.json"),
			'{"name":"tested-example"}',
		);
		writeFileSync(path.join(testedExampleDir, "tested.test.ts"), "");
		writeFileSync(
			path.join(uncoveredExampleRoot, "package.json"),
			'{"name":"uncovered-example"}',
		);

		try {
			assert.throws(
				() =>
					execFileSync(
						"node",
						[
							"scripts/test-examples.mjs",
							"--examples-root",
							examplesRoot,
							"--list",
							"--covers-package",
							uncoveredExampleRoot,
						],
						{
							encoding: "utf8",
							stderr: "pipe",
						},
					),
				(error) => {
					assert.equal(error.status, 1);
					assert.match(
						String(error.stderr),
						/Covered example package was not discovered with runtime tests: /,
					);
					return true;
				},
			);
		} finally {
			rmSync(examplesRoot, { force: true, recursive: true });
		}
	});

	it("fails when exact covered packages drift from discovered examples", () => {
		assert.throws(
			() =>
				execFileSync(
					"node",
					[
						"scripts/test-examples.mjs",
						"--list",
						"--require-covered-packages-match-discovered",
						...expectedCoverageArgs.slice(0, -2),
					],
					{
						encoding: "utf8",
						stderr: "pipe",
					},
				),
			(error) => {
				assert.equal(error.status, 1);
				assert.match(
					String(error.stderr),
					/Covered example package list is missing discovered runtime tests: /,
				);
				return true;
			},
		);
	});
});

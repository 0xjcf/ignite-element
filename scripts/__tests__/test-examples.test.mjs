import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

const expectedExampleRoots = [
	"examples/adapters/mobx",
	"examples/adapters/redux",
	"examples/adapters/xstate",
	"examples/agents/smart-home",
	"examples/apps/dashboard-with-shared-state",
	"examples/apps/form-with-validation",
	"examples/apps/nested-child-router",
	"examples/apps/spa-router",
];
const expectedCoverageArgs = expectedExampleRoots.flatMap((exampleRoot) => [
	"--covers-package",
	exampleRoot,
]);

describe("test-examples", () => {
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

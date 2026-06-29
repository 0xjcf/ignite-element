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
	"examples/apps/form-with-validation",
	"examples/apps/spa-router",
];

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
});

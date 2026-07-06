import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
	"examples/frameworks/react",
	"examples/frameworks/svelte",
	"examples/frameworks/vue",
];

describe("typecheck-examples", () => {
	it("discovers self-contained example packages", () => {
		const output = execFileSync(
			"node",
			["scripts/typecheck-examples.mjs", "--list"],
			{
				encoding: "utf8",
			},
		);

		assert.deepEqual(output.trim().split("\n"), expectedExampleRoots);
	});

	it("supports equals syntax for the examples root", () => {
		const output = execFileSync(
			"node",
			["scripts/typecheck-examples.mjs", "--list", "--examples-root=examples"],
			{
				encoding: "utf8",
			},
		);

		assert.deepEqual(output.trim().split("\n"), expectedExampleRoots);
	});

	it("rejects invalid options", () => {
		assert.throws(
			() =>
				execFileSync(
					"node",
					["scripts/typecheck-examples.mjs", "--examples-root", "--list"],
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
					["scripts/typecheck-examples.mjs", "--install=prompt"],
					{
						encoding: "utf8",
						stderr: "pipe",
					},
				),
			(error) => {
				assert.equal(error.status, 1);
				assert.match(
					String(error.stderr),
					/--install must be one of: always, missing, never\./,
				);
				return true;
			},
		);
	});
});

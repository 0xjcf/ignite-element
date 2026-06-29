import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
});

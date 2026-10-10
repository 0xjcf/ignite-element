import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../..",
);

test("published declarations resolve under node16 and NodeNext", () => {
	const result = spawnSync(
		process.execPath,
		["scripts/check-nodenext-declarations.mjs"],
		{
			cwd: repositoryRoot,
			encoding: "utf8",
		},
	);
	assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

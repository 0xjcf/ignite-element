import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";

test("real test:node wrapper runs all nine intended script-hardening tests", () => {
	const result = spawnSync("pnpm", ["run", "test:node"], {
		cwd: fileURLToPath(new URL("../../", import.meta.url)),
		encoding: "utf8",
		env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
	});
	assert.equal(result.status, 0, result.stdout + result.stderr);
	assert.match(result.stdout, /script-hardening\.test\.js/);
	assert.match(stripVTControlCharacters(result.stdout), /9 passed/);
});

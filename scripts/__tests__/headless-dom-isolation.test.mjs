import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const probe = fileURLToPath(
	new URL("./fixtures/headless-dom-probe.mjs", import.meta.url),
);
const root = new URL(
	"../../packages/ignite-element/dist/ignite-element.es.js",
	import.meta.url,
).href;
for (const scenario of ["import", "root"])
	test(`fresh Node ${scenario} has no fabricated browser globals`, () => {
		const result = spawnSync(process.execPath, [probe, root, scenario], {
			encoding: "utf8",
		});
		assert.equal(result.status, 0, result.stdout + result.stderr);
	});
for (const [scenario, diagnostic] of [
	["fake-control", /browser globals changed/],
	["access-control", /premature browser access detected/],
])
	test(`probe rejects ${scenario}`, () => {
		const result = spawnSync(process.execPath, [probe, root, scenario], {
			encoding: "utf8",
		});
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, diagnostic);
	});

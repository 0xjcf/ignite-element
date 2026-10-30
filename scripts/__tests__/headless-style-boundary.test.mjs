import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { build } from "vite";

it("omits stylesheet delivery from a built headless core without changing its entrypoint", async () => {
	const work = mkdtempSync(path.join(tmpdir(), "ignite-headless-style-"));
	const entry = path.join(work, "consumer.mjs");
	const xstate = fileURLToPath(
		new URL("../../packages/ignite-element/dist/xstate.es.js", import.meta.url),
	);
	writeFileSync(
		entry,
		`import {igniteCore} from ${JSON.stringify(xstate)};
import {createMachine,assign} from 'xstate';
const machine=createMachine({context:{count:0},on:{INCREMENT:{actions:assign({count:({context})=>context.count+1})}}});
const core=igniteCore({source:machine,states:snapshot=>({count:snapshot.context.count}),commands:({source})=>({increment:()=>source.send({type:'INCREMENT'})})});
globalThis.__igniteAudit={watch:core.watch,execute:core.execute,dispose:core.dispose};`,
	);
	try {
		const result = await build({
			configFile: false,
			logLevel: "silent",
			build: {
				write: false,
				target: "es2020",
				minify: "esbuild",
				rollupOptions: {
					input: entry,
					external: [
						"xstate",
						"lit-html",
						"react",
						"redux",
						"@reduxjs/toolkit",
						"mobx",
						"@actor-web/runtime",
					],
					output: { format: "es" },
				},
			},
		});
		const chunks = (Array.isArray(result) ? result : [result])
			.flatMap((item) => item.output)
			.filter((item) => item.type === "chunk");
		assert.equal(chunks.length, 1);
		const code = chunks[0].code;
		assert.ok(
			gzipSync(code, { level: 9 }).length < 21_826,
			"must improve the stage-one gzip checkpoint under the same profile",
		);
		// Resolve the external selected peer only for execution; measurement
		// above uses the same bare peer import as the recorded audit profile.
		const require = createRequire(
			new URL("../../packages/ignite-element/package.json", import.meta.url),
		);
		const executable = path.join(work, "executable.mjs");
		writeFileSync(
			executable,
			code.replace(
				/from\s*["']xstate["']/g,
				`from ${JSON.stringify(pathToFileURL(require.resolve("xstate")).href)}`,
			),
		);
		execFileSync(
			process.execPath,
			[
				"--input-type=module",
				"--eval",
				`
import assert from 'node:assert/strict';
await import(${JSON.stringify(pathToFileURL(executable).href)});
assert.equal(globalThis[Symbol.for('ignite-element.style-inject')], undefined);
globalThis.__igniteAudit.dispose();`,
			],
			{ stdio: "pipe" },
		);
	} finally {
		rmSync(work, { recursive: true, force: true });
	}
});

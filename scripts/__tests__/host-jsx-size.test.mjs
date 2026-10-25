import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { gzipSync } from "node:zlib";
import { build } from "vite";

const nodeMajor = Number(process.versions.node.split(".", 1)[0]);
assert.ok(
	nodeMajor >= 22,
	`JSX gzip caps are Node 22 measurements. This process is Node ${process.versions.node}.`,
);

const repoRoot = path.resolve(import.meta.dirname, "../..");

async function bundle(source, hostRuntime) {
	const dir = await mkdtemp(path.join(tmpdir(), "ignite-host-jsx-"));
	const entry = path.join(dir, "entry.mjs");
	try {
		await writeFile(entry, source);
		const bundleResult = await build({
			configFile: false,
			define: {
				"process.env.NODE_ENV": JSON.stringify("production"),
				__IGNITE_DEV_WARNINGS__: JSON.stringify(false),
				__IGNITE_HOST_RUNTIME__: JSON.stringify(hostRuntime),
			},
			build: {
				emptyOutDir: false,
				lib: { entry, fileName: "entry", formats: ["es"] },
				minify: "esbuild",
				rollupOptions: { output: { inlineDynamicImports: true } },
				sourcemap: false,
				target: "es2020",
				write: false,
			},
			logLevel: "silent",
			root: repoRoot,
		});
		const outputs = Array.isArray(bundleResult)
			? bundleResult.flatMap((item) => item.output)
			: bundleResult.output;
		return outputs
			.filter((output) => output.type === "chunk")
			.map((output) => output.code)
			.join("\n");
	} finally {
		await rm(dir, { force: true, recursive: true });
	}
}

const jsxRuntime = JSON.stringify(
	`${repoRoot}/packages/ignite-renderer/src/renderers/jsx/jsx-runtime.ts`,
);
const jsxRenderer = JSON.stringify(
	`${repoRoot}/packages/ignite-renderer/src/renderers/jsx/renderer.ts`,
);
const hostRuntime = JSON.stringify(
	`${repoRoot}/packages/ignite-renderer/src/renderers/jsx/hosts.ts`,
);

describe("JSX host runtime size", () => {
	it("keeps the host runtime out of a no-host JSX bundle", async () => {
		const code = await bundle(
			`
			import { jsx } from ${jsxRuntime};
			import { renderIgniteJsx } from ${jsxRenderer};
			export function render(host) {
				return renderIgniteJsx(host, jsx("div", { children: "hello" }));
			}
		`,
			false,
		);
		const gzip = gzipSync(code).byteLength;
		assert.equal(code.includes("prefers-reduced-motion"), false);
		assert.equal(code.includes("Host mount failed"), false);
		assert.ok(gzip > 0);
		// Existing default gzip (level 6), not the consumer's level 9 method.
		// Jose approved the exact 4173 B cost of committed refs and native
		// select correctness, then the exact 4355 B for PR #168: the render-tree
		// publish hook (commit ordering), the exact-name property sink table, and
		// SMIL commit ordering (approved for native select correctness and sink
		// blocking), then the exact 4480 B for PR #168's restructure: one guarded
		// write helper that rechecks ownership before every DOM write, and
		// detached roots claiming ownership at creation.
		// Then 4510 B: the round-9 fixes for three Codex threads (blocked URL across
		// spellings, listener sets after drops, never-committed own setters) cost 27 B.
		// Then 4560 B (Jose pre-approved up to 4560): the round-11 fixes for six
		// Codex threads (custom-element construction rechecked through the write
		// helper, a private unwinding sentinel, explicit fallback-attribute state
		// that removes a stale attribute before an upgraded setter) cost 49 B.
		// Then 4580 B (Jose pre-approved up to 4590): the round-12 fix for the
		// spelling-keyed fallback marker (an alias handing its marker to the
		// spelling that stays) reads 4576 B on the rebuilt dist.
		// Then 4670 B (Jose approved): the round-14 fixes (act lookup recheck,
		// off-list volume/playbackRate/currentTime, ref self-unmount with a
		// disposer) read 4666 B on the rebuilt dist.
		// Then 4700 B (Jose approved up to 4710): the round-15 fixes (controlled
		// phase ownership check, per-call ref teardown marker, per-commit host
		// tools) read 4692 B on the rebuilt dist.
		// Then 4730 B (Jose approved up to 4740): the round-18 ref-queue guard
		// (commits made by this renderer instance) reads 4722 B on the rebuilt dist.
		// Host exclusion and build settings stay the same.
		// Then 4790 B (Jose approved): the round-21 act() finally, composition via
		// act(), stale-read catch and reporter containment read 4781 B.
		// Then 4800 B (Jose approved up to 4820): the round-23 detach-time
		// commit guard reads 4793 B.
		// Then 4810 B (Jose approved up to 4820): the round-25 file-input skip
		// reads 4802 B.
		// Then 6500 B (Jose approved on PR #180): the JSX XSS guard.
		// Then 7100 B (Jose approved in chat on PR #180): the re-review fixes.
		// Then 7200 B (Jose, 2026-10-22): "settle the object-style gap first and increase the budget".
		// Then 7500 B (Jose, 2026-10-23): "Yes to the replies, raise the caps and ship N11".
		// Measured again after the author-style mark left the no-host bundle: 7465 B.
		// Capturing WeakSet.prototype.has and add reads 7491 B. Cap stays 7500 B.
		assert.ok(gzip <= 7500, `no-host JSX gzip ${gzip} is above 7500`);
	});

	it("includes the host runtime when the internal module is imported", async () => {
		const code = await bundle(
			`
			import { jsx } from ${jsxRuntime};
			import { renderIgniteJsx } from ${jsxRenderer};
			import { describeIgniteHosts } from ${hostRuntime};
			export function render(host) {
				describeIgniteHosts({}, {});
				return renderIgniteJsx(host, jsx("canvas", { use: "scene" }));
			}
		`,
			true,
		);
		const gzip = gzipSync(code).byteLength;
		assert.equal(code.includes("Host mount failed"), true);
		assert.equal(code.includes("Unknown host"), false);
		assert.ok(gzip > 4173, `host JSX gzip ${gzip} dropped the host runtime`);
	});
});

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { gzipSync } from "node:zlib";
import { build } from "vite";

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
		assert.ok(
			gzip < 3600,
			`no-host JSX gzip ${gzip} includes the host runtime`,
		);
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
		assert.ok(gzip > 3600, `host JSX gzip ${gzip} dropped the host runtime`);
	});
});

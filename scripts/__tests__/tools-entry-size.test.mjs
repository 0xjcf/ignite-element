import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { gzipSync } from "node:zlib";
import { build } from "vite";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const packageRoot = path.join(repoRoot, "packages/ignite-element");

/** Published `ignite-element/tools` production entry. Gzip level 9. */
const TOOLS_ENTRY_GZIP = 5000;

const external = [
	"@ignite-element/core",
	"@ignite-element/renderer",
	"@ignite-element/adapters",
	"@ignite-element/adapters/actor-web",
	"lit-html",
	"xstate",
	"mobx",
	"redux",
	"@reduxjs/toolkit",
	"react",
	"react-dom",
	"react/jsx-runtime",
	"node:fs",
	"node:path",
	"node:url",
];

async function bundleToolsEntry() {
	const outDir = await mkdtemp(path.join(tmpdir(), "ignite-tools-entry-"));
	try {
		await build({
			configFile: false,
			root: packageRoot,
			define: {
				"process.env.NODE_ENV": JSON.stringify("production"),
				__IGNITE_DEV_WARNINGS__: JSON.stringify(false),
				__IGNITE_HOST_RUNTIME__: JSON.stringify(true),
			},
			build: {
				emptyOutDir: true,
				lib: {
					entry: path.join(packageRoot, "src/tools/index.ts"),
					fileName: () => "tools.es.js",
					formats: ["es"],
					name: "ignite-element",
				},
				minify: "esbuild",
				outDir,
				rollupOptions: { external },
				sourcemap: false,
				write: true,
			},
			logLevel: "silent",
		});
		return await readFile(path.join(outDir, "tools.es.js"));
	} finally {
		await rm(outDir, { force: true, recursive: true });
	}
}

describe("igniteTools entry size", () => {
	it("keeps the tools production entry within 5000 B gzip", async () => {
		const code = await bundleToolsEntry();
		const gzip = gzipSync(code, { level: 9 }).byteLength;
		assert.ok(
			gzip <= TOOLS_ENTRY_GZIP,
			`tools entry gzip ${gzip} exceeds ${TOOLS_ENTRY_GZIP}`,
		);
	});
});

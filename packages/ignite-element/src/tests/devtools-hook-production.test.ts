// @vitest-environment node

import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, type Plugin, type Rollup } from "vite";
import { describe, expect, it } from "vitest";
import { preserveDevtoolsNodeEnv } from "../../preserveDevtoolsNodeEnv";

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));

async function productionBundle(
	entry: string,
	plugins: Plugin[] = [],
): Promise<string> {
	const result = await build({
		configFile: false,
		define: {
			"process.env.NODE_ENV": JSON.stringify("production"),
		},
		plugins,
		logLevel: "silent",
		build: {
			lib: {
				entry,
				fileName: "entry",
				formats: ["es"],
			},
			minify: "esbuild",
			rollupOptions: {
				external: (id) => id.includes("node_modules"),
			},
			write: false,
		},
	});
	const builds = Array.isArray(result) ? result : [result];
	return builds
		.flatMap((item) => ("output" in item ? item.output : []))
		.filter((output): output is Rollup.OutputChunk => output.type === "chunk")
		.map((output) => output.code)
		.join("\n");
}

describe("production build drops the devtools hook", () => {
	it("omits the hook and the tag warning from normal entrypoints", async () => {
		const runtime = await productionBundle(source("../xstate.ts"));
		const root = await productionBundle(source("../index.ts"));
		for (const code of [runtime, root]) {
			expect(code).not.toContain("devtools-core-");
			expect(code).not.toContain("devtoolsDelivery");
			expect(code).not.toContain("installDevtoolsHook");
			expect(code).not.toContain("already defined by a different component");
		}
	}, 60_000);

	it("ships installDevtoolsHook as a production no-op", async () => {
		const code = await productionBundle(source("../devtools-hook.ts"));
		expect(code).toContain("installDevtoolsHook");
		expect(code).not.toContain("devtools-core-");
		expect(code).not.toContain("devtoolsDelivery");
		expect(code).not.toContain("already defined by a different component");
	}, 30_000);

	it("keeps a runtime NODE_ENV check in the published hook entry", async () => {
		const code = await productionBundle(source("../devtools-hook.ts"), [
			preserveDevtoolsNodeEnv(),
		]);
		expect(code).toContain("installDevtoolsHook");
		expect(code).toContain("process.env.NODE_ENV");
		expect(code).toContain("devtools-core-");
		expect(code).not.toContain("__IGNITE_NODE_ENV__");
	}, 30_000);

	it("keeps runtime checks in the published library build", async () => {
		const outDir = await mkdtemp(join(tmpdir(), "ignite-devtools-build-"));
		try {
			await build({
				configFile: source("../../vite.config.ts"),
				logLevel: "silent",
				build: { emptyOutDir: true, outDir },
			});
			const names = await readdir(outDir);
			const factoryName = names.find((name) =>
				name.startsWith("createIgniteComponentFactory-"),
			);
			expect(factoryName).toBeTypeOf("string");
			const hook = await readFile(join(outDir, "devtools-hook.es.js"), "utf8");
			const factory = await readFile(join(outDir, factoryName ?? ""), "utf8");
			const root = await readFile(join(outDir, "ignite-element.es.js"), "utf8");
			expect(hook).toContain("process.env.NODE_ENV");
			expect(hook).toContain("devtools-core-");
			expect(hook).not.toContain("__IGNITE_NODE_ENV__");
			for (const code of [factory, root]) {
				expect(code).toContain("process.env.NODE_ENV");
				expect(code).toContain("already defined by a different component");
				expect(code).not.toContain("devtools-core-");
				expect(code).not.toContain("__IGNITE_NODE_ENV__");
			}
		} finally {
			await rm(outDir, { force: true, recursive: true });
		}
	}, 60_000);
});

// @vitest-environment node

import { fileURLToPath } from "node:url";
import { build, type Rollup } from "vite";
import { describe, expect, it } from "vitest";

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));

async function productionBundle(entry: string): Promise<string> {
	const result = await build({
		configFile: false,
		define: {
			"process.env.NODE_ENV": JSON.stringify("production"),
		},
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
});

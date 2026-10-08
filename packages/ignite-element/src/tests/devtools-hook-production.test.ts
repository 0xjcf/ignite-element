// @vitest-environment node

import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
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

async function artifactContains(dir: string, marker: string): Promise<boolean> {
	const entries = await readdir(dir, { recursive: true });
	for (const entry of entries) {
		const file = String(entry);
		if (!file.endsWith(".js")) continue;
		const code = await readFile(join(dir, file), "utf8");
		if (code.includes(marker)) return true;
	}
	return false;
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
			expect(code).not.toContain("publishCommand");
			expect(code).not.toContain("pushOrigin");
		}
	}, 60_000);

	it("ships installDevtoolsHook as a production no-op", async () => {
		const code = await productionBundle(source("../devtools-hook.ts"));
		expect(code).toContain("installDevtoolsHook");
		expect(code).not.toContain("devtools-core-");
		expect(code).not.toContain("devtoolsDelivery");
		expect(code).not.toContain("already defined by a different component");
	}, 30_000);

	it("delivers events from the development artifact and ignores the production artifact", async () => {
		// Artifacts and the driver must live inside this package so Node can
		// resolve xstate and the sibling Ignite packages from their file URLs.
		const outDir = await mkdtemp(
			join(source("../.."), ".tmp-devtools-artifacts-"),
		);
		const previousBuild = process.env.IGNITE_DEVTOOLS_BUILD;
		const previousSkip = process.env.IGNITE_SKIP_DTS;
		try {
			process.env.IGNITE_SKIP_DTS = "1";
			delete process.env.IGNITE_DEVTOOLS_BUILD;
			await build({
				configFile: source("../../vite.config.ts"),
				logLevel: "silent",
				build: { emptyOutDir: true, outDir: join(outDir, "production") },
			});
			process.env.IGNITE_DEVTOOLS_BUILD = "development";
			await build({
				configFile: source("../../vite.config.ts"),
				logLevel: "silent",
				build: { emptyOutDir: true, outDir: join(outDir, "development") },
			});

			const productionHook = await readFile(
				join(outDir, "production/devtools-hook.es.js"),
				"utf8",
			);
			const developmentHook = await readFile(
				join(outDir, "development/devtools-hook.es.js"),
				"utf8",
			);
			expect(productionHook).toContain("installDevtoolsHook");
			expect(productionHook).not.toContain("devtools-core-");
			expect(developmentHook).toContain("devtools-core-");
			expect(
				await artifactContains(
					join(outDir, "production"),
					"ignite-element.devtools",
				),
			).toBe(false);
			expect(
				await artifactContains(
					join(outDir, "production"),
					"already defined by a different component",
				),
			).toBe(false);
			expect(
				await artifactContains(
					join(outDir, "development"),
					"ignite-element.devtools",
				),
			).toBe(true);

			const script = join(outDir, "deliver.mjs");
			await writeFile(
				script,
				`
import { emit, setup } from "xstate";
const [runtimeFile, hookFile] = process.argv.slice(2);
const { igniteCore } = await import(runtimeFile);
const { installDevtoolsHook } = await import(hookFile);
const records = [];
const commands = [];
installDevtoolsHook({
  event(record) {
    records.push(record.type + ":" + record.origin);
  },
  command(record) {
    commands.push(record.command + ":" + record.origin);
  },
});
const machine = setup({
  types: { context: {}, events: {}, emitted: {} },
}).createMachine({
  context: { count: 0 },
  initial: "active",
  states: {
    active: {
      on: {
        INC: { actions: emit({ type: "ignoredTick" }) },
        RESET: { actions: emit({ type: "counterReset", count: 0 }) },
      },
    },
  },
});
const core = igniteCore({
  source: machine,
  states: () => ({ ready: true }),
  commands: ({ source }) => ({
    increment: () => source.send({ type: "INC" }),
    reset: () => source.send({ type: "RESET" }),
  }),
  events: (event) => ({ counterReset: event() }),
});
core.on("counterReset", () => {});
await core.execute({ command: "increment" });
await core.execute({ command: "reset" });
core.dispose();
process.stdout.write(records.join(",") + "\\n" + commands.join(",") + "\\n");
`,
			);
			const deliver = (directory: string) =>
				execFileSync(
					process.execPath,
					[
						script,
						join(directory, "xstate.es.js"),
						join(directory, "devtools-hook.es.js"),
					],
					{ cwd: source("../.."), encoding: "utf8" },
				).trim();
			expect(deliver(join(outDir, "development"))).toBe(
				"counterReset:native\nincrement:execute,reset:execute",
			);
			expect(deliver(join(outDir, "production"))).toBe("");
		} finally {
			if (previousBuild === undefined) delete process.env.IGNITE_DEVTOOLS_BUILD;
			else process.env.IGNITE_DEVTOOLS_BUILD = previousBuild;
			if (previousSkip === undefined) delete process.env.IGNITE_SKIP_DTS;
			else process.env.IGNITE_SKIP_DTS = previousSkip;
			await rm(outDir, { force: true, recursive: true });
		}
	}, 90_000);
});

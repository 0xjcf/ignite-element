import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import esbuild from "esbuild";
import fc from "fast-check";
import { build } from "vite";
import { expect, it } from "vitest";
import igniteEsbuild from "./esbuild.js";
import igniteVite from "./vite.js";

it("R2: ordinary require-shaped objects and non-loader module methods preserve data", async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.constantFrom("tools", "helpers", "services"),
			fc.constantFrom("dot", "literal", "variable"),
			async (name, spelling) => {
				const dir = realpathSync(
					mkdtempSync(path.join(tmpdir(), "ignite-member-data-")),
				);
				try {
					const entry = path.join(dir, "entry.cjs");
					const method = {
						dot: "module.toString",
						literal: 'module["toString"]',
						variable: "module[methodName]",
					}[spelling];
					writeFileSync(
						entry,
						`const ${name} = { require: value => Boolean(value) }; const methodName = "toString"; const data = "author-style-is-data"; module.exports = { local: ${name}.require(data), moduleData: ${method}(data), data };`,
					);
					const bundled = await esbuild.build({
						absWorkingDir: dir,
						entryPoints: [entry],
						bundle: true,
						write: false,
						platform: "node",
						format: "esm",
						plugins: [igniteEsbuild()],
						logLevel: "silent",
					});
					expect(
						bundled.outputFiles.map((file) => file.text).join("\n"),
					).toContain("author-style-is-data");
					const ssr = await build({
						root: dir,
						configFile: false,
						logLevel: "silent",
						plugins: [igniteVite()],
						build: { ssr: entry, write: false, minify: false },
					});
					const outputs = Array.isArray(ssr) ? ssr : [ssr];
					expect(
						outputs
							.flatMap((result) => ("output" in result ? result.output : []))
							.map((output) => ("code" in output ? output.code : ""))
							.join("\n"),
					).toContain("author-style-is-data");
				} finally {
					rmSync(dir, { recursive: true, force: true });
				}
			},
		),
		{
			seed: 20261109,
			numRuns: 8,
			examples: [
				["tools", "dot"],
				["helpers", "literal"],
				["services", "variable"],
			],
		},
	);
});

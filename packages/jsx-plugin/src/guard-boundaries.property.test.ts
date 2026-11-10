import {
	mkdirSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import fc from "fast-check";
import { type RollupOptions, rollup } from "rollup";
import { describe, expect, it } from "vitest";
import igniteRollup from "./rollup.js";

const profile = { seed: 20261109, numRuns: 8 };

async function fixture(check: (dir: string) => Promise<void>) {
	const dir = realpathSync(
		mkdtempSync(path.join(tmpdir(), "ignite-guard-port-")),
	);
	try {
		mkdirSync(path.join(dir, "src"));
		await check(dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

async function build(options: RollupOptions) {
	const bundle = await rollup(options);
	try {
		await bundle.generate({ format: "es" });
	} finally {
		await bundle.close();
	}
}

describe("reviewed guard boundary rules", () => {
	it("R1: the transform hook refuses private aliases resolved by the actual host port", async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.constantFrom("import", "export", "require"),
				async (form) => {
					await fixture(async (dir) => {
						const entry = path.join(dir, "src", "entry.js");
						const mark = path.join(dir, "author-style-mark.es.js");
						writeFileSync(mark, "export const value = 1;");
						writeFileSync(
							entry,
							form === "import"
								? 'import { value } from "guard-alias"; export { value };'
								: form === "export"
									? 'export { value } from "guard-alias";'
									: 'const value = require("guard-alias"); export { value };',
						);
						const plugin = igniteRollup();
						const transform = (Array.isArray(plugin) ? plugin : [plugin]).find(
							(candidate) => candidate.transform,
						)?.transform;
						if (!transform)
							throw new Error("Ignite must supply its transform boundary");
						// Exercise this boundary with a real Rollup resolver/context. Full
						// plugin tests separately cover later guards; they must not mask it.
						await expect(
							build({
								input: entry,
								plugins: [
									{ name: "guard-transform-boundary", transform },
									{
										name: "private-alias-port",
										resolveId(id) {
											return id === "guard-alias" ? mark : null;
										},
									},
								],
							}),
						).rejects.toThrow(/cannot mark CSS/);
					});
				},
			),
			{ ...profile, examples: [["import"], ["export"], ["require"]] },
		);
	});

	it("R1/R2: post-transform module facts reject real imports and preserve ordinary template data", async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.constantFrom("import", "call", "construct"),
				async (form) => {
					await fixture(async (dir) => {
						const entry = path.join(dir, "src", "entry.js");
						writeFileSync(entry, "export const load = () => null;");
						const output =
							form === "import"
								? `export const load = suffix => import(\`./author-style-\${suffix}.es.js\`);`
								: form === "call"
									? `const ordinary = value => value; export const load = suffix => ordinary(\`./author-style-\${suffix}.es.js\`);`
									: `export const load = suffix => new Error(\`./author-style-\${suffix}.es.js\`);`;
						const result = build({
							input: entry,
							plugins: [
								igniteRollup(),
								{
									name: "later-source-producer",
									transform(_code, id) {
										return id === entry ? output : null;
									},
								},
							],
						});
						if (form === "import")
							await expect(result).rejects.toThrow(/cannot mark CSS/);
						else await result;
					});
				},
			),
			{ ...profile, examples: [["import"], ["call"], ["construct"]] },
		);
	});
});

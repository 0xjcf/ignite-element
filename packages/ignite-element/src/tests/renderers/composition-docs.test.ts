import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The handbook must name every event that ends composition suppression, read
// from the code so the two cannot drift.
describe("composition suppression docs", () => {
	const root = resolve(process.cwd(), "../..");
	const code = readFileSync(
		resolve(root, "packages/ignite-renderer/src/renderers/jsx/renderer.ts"),
		"utf8",
	);
	const doc = readFileSync(
		resolve(root, "docs/site/src/content/docs/handbook/views.mdx"),
		"utf8",
	);
	it("lists compositionend, blur, focus and disconnect", () => {
		const ending = [...code.matchAll(/addEventListener\("(\w+)", end\)/g)].map(
			(m) => m[1],
		);
		expect(ending.sort()).toEqual(["blur", "compositionend", "focus"]);
		for (const event of ending) expect(doc).toContain(`\`${event}\``);
		expect(doc).toContain("disconnecting the element");
		expect(code).toMatch(/!element\.isConnected|element\.isConnected/);
	});
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import { mountIgniteJsx, renderIgniteJsx } from "../../renderers/jsx/renderer";

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
		const list = /for \(const type of \[([^\]]+)\]\)/.exec(code)?.[1] ?? "";
		const ending = [...list.matchAll(/"(\w+)"/g)].map((m) => m[1]);
		expect(ending.sort()).toEqual(["blur", "compositionend", "focus"]);
		for (const event of ending) expect(doc).toContain(`\`${event}\``);
		expect(doc).toContain("disconnecting the element");
		expect(code).toMatch(/!element\.isConnected|element\.isConnected/);
	});

	it.each(["compositionend", "blur", "focus"])(
		"%s ends the suppression so the next render writes value",
		(event) => {
			const host = document.createElement("div");
			let tree = mountIgniteJsx(host, jsx("input", { value: "a" }));
			const input = host.querySelector("input") as HTMLInputElement;
			document.body.append(host);
			input.focus();
			input.dispatchEvent(new Event("compositionstart"));
			tree = renderIgniteJsx(host, jsx("input", { value: "b" }), tree);
			expect(input.value).toBe("a");
			input.dispatchEvent(new Event(event));
			renderIgniteJsx(host, jsx("input", { value: "b" }), tree);
			expect(input.value).toBe("b");
			host.remove();
		},
	);
});

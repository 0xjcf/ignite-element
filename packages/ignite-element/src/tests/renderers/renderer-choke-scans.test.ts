import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Round 20 (PR #168). Scans for the renderer and strategy choke points.
const dir = resolve(__dirname, "../../../../ignite-renderer/src/renderers/jsx");
const renderer = readFileSync(resolve(dir, "renderer.ts"), "utf8");
const strategy = readFileSync(
	resolve(dir, "IgniteJsxRenderStrategy.ts"),
	"utf8",
);
const fn = (src: string, head: string) => {
	const start = src.indexOf(head);
	return start < 0 ? "" : src.slice(start, src.indexOf("\n}\n", start));
};

describe("renderer.ts publish and report choke points", () => {
	it("the root publish is preceded by an unconditional live()", () => {
		const body = fn(renderer, "function renderIgniteJsxNow(");
		expect(body).toMatch(
			/\blive\(\);\s*(\/\/[^\n]*\n\s*)*\(host as Owned\)\[owner\]/,
		);
	});
	it("a contained callback's error report is followed by live()", () => {
		const body = fn(renderer, "function invokeContained(");
		expect(body).toMatch(/reportRendererError\(node, error\);[\s\S]*live\(\)/);
	});
});

describe("IgniteJsxRenderStrategy detach", () => {
	it("holds the strategy writing while cleanups run, so renders queue", () => {
		const body = fn(strategy, "detach(): void");
		const writing = body.indexOf("this.writing = true");
		const unmount = body.indexOf("unmountIgniteSubtree(");
		expect(writing).toBeGreaterThan(-1);
		expect(writing).toBeLessThan(unmount);
		expect(body).toMatch(/finally/);
	});
});

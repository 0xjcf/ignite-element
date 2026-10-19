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

describe("renderer.ts publish choke point", () => {
	it("the root publish is preceded by an unconditional live()", () => {
		const body = fn(renderer, "function renderIgniteJsxNow(");
		expect(body).toMatch(
			/\blive\(\);\s*(\/\/[^\n]*\n\s*)*\(host as Owned\)\[owner\]/,
		);
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

describe("renderer.ts round-21 choke points", () => {
	it("has no `native:` bypass left for a DOM call", () => {
		expect(renderer.match(/native:/g)).toBeNull();
	});
	it("act() rechecks in a finally, so a throw after a supersession is the abort", () => {
		const body = fn(renderer, "function act<");
		expect(body).toMatch(/try \{[\s\S]*\} finally \{\s*live\(\);/);
	});
	it("commitRender rechecks before it rethrows a render error", () => {
		const body = fn(renderer, "function commitRender<");
		expect(body).toMatch(
			/catch \(error\) \{[\s\S]*?live\(\);[\s\S]*?throw error/,
		);
	});
	it("reporters contain every logger and handler failure", () => {
		const body = fn(renderer, "function reportRendererError(");
		expect(body).not.toMatch(/\bconsole\.error\(/);
		expect(renderer.match(/\bconsole\.error\(/g)?.length).toBe(1);
		const log = fn(renderer, "function logError(");
		expect(log).toMatch(/try \{[\s\S]*console\.error[\s\S]*\} catch/);
		expect(body).toMatch(/try \{[\s\S]*getRootNode[\s\S]*\} catch/);
	});
});

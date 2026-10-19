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
		expect(body).toMatch(
			/try \{[\s\S]*\} finally \{\s*(\/\/[^\n]*\n\s*)*live\(\);/,
		);
	});
	it("commitRender rechecks staleness before it rethrows a render error", () => {
		const body = fn(renderer, "function commitRender<");
		expect(body).toMatch(
			/catch \(error\) \{[\s\S]*?stale\(\)[\s\S]*?throw error/,
		);
	});
	it("the reporter contains every logger, lookup and handler failure", () => {
		const body = fn(renderer, "function reportRendererError(");
		expect(renderer.match(/\bconsole\.error\(/g)?.length).toBe(1);
		expect(body).toMatch(/try \{\s*console\.error[\s\S]*?\} catch/);
		expect(body).toMatch(
			/try \{[\s\S]*getRootNode[\s\S]*handler\.call[\s\S]*\} catch/,
		);
	});
});

describe("renderer.ts round-22 choke points", () => {
	it("composition state is cleared only after a live() that follows the focus reads", () => {
		const body = fn(renderer, "function assignControlled(");
		expect(body).toMatch(
			/matches\(":focus"\)[^\n]*\n\s*live\(\);\s*composing\.set\(element, false\)/,
		);
	});
	it("the controlled phase treats a stale throw as the abort", () => {
		const body = fn(renderer, "function commitRender<");
		expect(body).toMatch(
			/for \(const commit of queues\[0\]\)[\s\S]*?catch \(error\) \{\s*if \(error !== abort && !stale\(\)\) throw error;/,
		);
	});
});

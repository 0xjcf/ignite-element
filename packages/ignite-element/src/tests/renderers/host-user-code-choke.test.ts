import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// ROOT RULE (PR #168 reentrancy family). Any read or call that can reach
// user-controlled code (a getter, a thenable, an overridable method, a ref, a
// callback, an abort listener) goes through the one choke point of its module,
// which rechecks ownership before and after it: act() in renderer.ts, touch()
// in hosts.ts. Host definition callbacks are the contained exception: each is
// wrapped in its own try/catch and marked `// callback:`.
//
// This scan removes every balanced touch(...) call from hosts.ts and fails on
// any remaining raw touchpoint.
const src = readFileSync(
	resolve(__dirname, "../../../../ignite-renderer/src/renderers/jsx/hosts.ts"),
	"utf8",
);

function stripCalls(text: string, name: string): string {
	let out = text;
	for (;;) {
		const at = out.indexOf(`${name}(`);
		if (at < 0) return out;
		let depth = 0;
		let end = at + name.length;
		for (; end < out.length; end++) {
			if (out[end] === "(") depth++;
			else if (out[end] === ")" && --depth === 0) break;
		}
		out = `${out.slice(0, at)}${out.slice(end + 1)}`;
	}
}

describe("hosts.ts user-code touchpoints", () => {
	it("has no raw touchpoint outside touch()", () => {
		const start = src.indexOf("function touch<");
		const choke =
			start < 0 ? "" : src.slice(start, src.indexOf("\n}\n", start));
		const rest = stripCalls(src.replace(choke, ""), "touch");
		const raw =
			/\b(element|node|child|root)\.(getAttribute|setAttribute|removeAttribute|hasAttribute|append|remove|children|childNodes|getRootNode|ownerDocument|textContent|createElement|getElementById|style|id)\b|"then" in|\.then\b|\.abort\(\)|\bPromise\.resolve\(/;
		const offenders = rest
			.split("\n")
			.filter((line) => !line.trim().startsWith("//") && raw.test(line))
			.filter((line) => !/native:/.test(line))
			.map((line) => line.trim());
		expect(offenders).toEqual([]);
	});
	it("marks every definition callback", () => {
		const calls =
			/\b(definition|host|record\.definition)\.(select|mount|update|dispose|describe|equals)\(/;
		const offenders = src
			.split("\n")
			.filter((line) => calls.test(line) && !/callback:/.test(line))
			.map((line) => line.trim());
		expect(offenders).toEqual([]);
	});
});

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
	it("passes the record into every description helper", () => {
		// Round 19: a helper that took the element only judged staleness inside a
		// commit, so an async settle (no commit) ran on after a getter superseded.
		const from = src.indexOf("function descriptionIdTaken");
		const to = src.indexOf("function ownName");
		const helpers = src.slice(from, to);
		expect(helpers).not.toMatch(/touch\(\s*element,\s*undefined/);
		expect(helpers).not.toMatch(
			/\b(descriptionId|descriptionNode|clearDescription|editDescribedBy|forgetDescriptionId|descriptionIdTaken)\(element(, (id|existing))?\)/,
		);
	});
	it("reaches console.* and then-reads only through touch() or a marker", () => {
		const rest = stripCalls(src, "touch");
		const offenders = rest
			.split("\n")
			.filter(
				(line) =>
					!line.trim().startsWith("//") &&
					/\bconsole\.(warn|error|log|info|debug)\(/.test(line) &&
					!/(native|reported):/.test(line),
			)
			.map((line) => line.trim());
		expect(offenders).toEqual([]);
	});
	it("allows one interceptable operation per touch()", () => {
		// Round 20: a check runs after the callback, so the second operation of a
		// bundle ran stale. Count `name.member` accesses on DOM-ish values.
		const bad: string[] = [];
		let from = 0;
		for (;;) {
			const at = src.indexOf("touch(", from);
			if (at < 0) break;
			let depth = 0;
			let end = at + 5;
			for (; end < src.length; end++) {
				if (src[end] === "(") depth++;
				else if (src[end] === ")" && --depth === 0) break;
			}
			from = end;
			const call = src.slice(at, end + 1);
			if (/^touch\(\s*$/.test(call) || call.startsWith("touch<")) continue;
			const body = call.replace(/"[^"]*"/g, '""');
			let ops = 0;
			for (const match of body.matchAll(
				/\b(element|node|child|root|fresh|target|doc|current|value|result)((?:\.[A-Za-z]+)+)/g,
			)) {
				ops += (match[2] ?? "")
					.split(".")
					.filter(
						(part) => part && part !== "length" && part !== "controller",
					).length;
			}
			if (ops > 1) bad.push(call.replace(/\s+/g, " ").slice(0, 100));
		}
		expect(bad).toEqual([]);
	});
	it("rechecks ownership when the touched operation throws", () => {
		const start = src.indexOf("function touch<");
		const body = src.slice(start, src.indexOf("\n}\n", start));
		expect(body).toMatch(/catch/);
		expect(body.match(/hostLive\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
	});
	it("versions a retained record and compares the version", () => {
		expect(src).toMatch(/\bgen: number\b/);
		expect(src).toMatch(/\.gen\s*(\+=|\+\+)|\.gen = /);
		const from = src.indexOf("function superseded(");
		expect(src.slice(from, src.indexOf("\n}\n", from))).toMatch(/gen/);
	});
	it("rechecks after a host error report", () => {
		const start = src.indexOf("function reportHostError(");
		const body = src.slice(start, src.indexOf("\n}\n", start));
		expect(body).toMatch(/console\.error[^\n]*\n\s*hostLive\(\)/);
	});
});

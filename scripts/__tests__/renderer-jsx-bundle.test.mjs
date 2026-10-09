import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { gzipSync } from "node:zlib";

describe("published renderer jsx bundle", () => {
	it("drops process.env.NODE_ENV and dev warning strings", () => {
		const source = readFileSync(
			"packages/ignite-renderer/dist/jsx.es.js",
			"utf8",
		);
		assert.equal(source.includes("process.env.NODE_ENV"), false);
		assert.equal(source.includes("Duplicate key"), false);
		assert.equal(source.includes("Mixed keyed and unkeyed"), false);
		assert.equal(source.includes("requires a single element"), false);
		assert.equal(source.includes("is deprecated and will be removed"), false);
		const gzipBytes = gzipSync(Buffer.from(source), { level: 9 }).byteLength;
		assert.ok(gzipBytes > 0);
	});
});

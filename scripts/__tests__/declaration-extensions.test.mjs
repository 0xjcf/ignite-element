import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { rewritePackageDeclarations } from "../rewrite-declaration-extensions.mjs";

const vlqChars =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function decodeMappings(mappings) {
	const lines = [];
	for (const line of mappings.split(";")) {
		const segments = [];
		let generated = 0;
		let sourceIndex = 0;
		let sourceLine = 0;
		let sourceColumn = 0;
		if (line.length > 0) {
			for (const segment of line.split(",")) {
				const values = decodeSegment(segment);
				generated += values[0];
				if (values.length > 1) {
					sourceIndex += values[1];
					sourceLine += values[2];
					sourceColumn += values[3];
				}
				segments.push({
					generatedColumn: generated,
					sourceIndex,
					sourceLine,
					sourceColumn,
				});
			}
		}
		lines.push(segments);
	}
	return lines;
}

function decodeSegment(segment) {
	const values = [];
	let index = 0;
	while (index < segment.length) {
		let value = 0;
		let shift = 0;
		let digit = 0;
		do {
			digit = vlqChars.indexOf(segment[index]);
			index += 1;
			value += (digit & 31) << shift;
			shift += 5;
		} while (digit & 32);
		const negated = value & 1;
		value >>>= 1;
		values.push(negated ? -value : value);
	}
	return values;
}

const publishedPackages = [
	"packages/ignite-core",
	"packages/ignite-adapters",
	"packages/ignite-renderer",
	"packages/ignite-element",
];

test("declaration maps follow rewritten import columns", () => {
	const root = mkdtempSync(join(tmpdir(), "ignite-declaration-maps-"));
	try {
		const types = join(root, "dist", "types");
		mkdirSync(types, { recursive: true });
		const source = 'import("./other").Name;import("./other").Second;\n';
		writeFileSync(join(types, "other.d.ts"), "export const value = 1;\n");
		writeFileSync(join(types, "entry.d.ts"), source);
		writeFileSync(
			join(types, "entry.d.ts.map"),
			`${JSON.stringify({
				version: 3,
				file: "entry.d.ts",
				sources: ["../../src/entry.ts"],
				names: [],
				// Name is generated column 18. Second is generated column 41.
				mappings: "AAAA,kBAKI,uBAAM",
			})}\n`,
		);

		rewritePackageDeclarations(root);
		rewritePackageDeclarations(root);

		const rewritten = readFileSync(join(types, "entry.d.ts"), "utf8");
		const map = JSON.parse(readFileSync(join(types, "entry.d.ts.map"), "utf8"));
		const segments = decodeMappings(map.mappings)[0];
		assert.equal(segments[0].generatedColumn, 0);
		assert.equal(
			segments[1].generatedColumn,
			rewritten.indexOf("Name"),
			"Name must stay mapped after the inserted .js",
		);
		assert.equal(segments[1].sourceLine, 5);
		assert.equal(segments[1].sourceColumn, 4);
		assert.equal(
			segments[2].generatedColumn,
			rewritten.indexOf("Second"),
			"a later identifier must include every insertion on the line",
		);
		assert.equal(segments[2].sourceLine, 5);
		assert.equal(segments[2].sourceColumn, 10);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("standalone build:types and build:js rewrite declarations", () => {
	for (const directory of publishedPackages) {
		const manifest = JSON.parse(
			readFileSync(join(directory, "package.json"), "utf8"),
		);
		assertRewriteAfterEmit(
			manifest.scripts["build:types"],
			"tsc",
			`${manifest.name} build:types`,
		);
		assertRewriteAfterEmit(
			manifest.scripts["build:js"],
			"vite build",
			`${manifest.name} build:js`,
		);
	}
});

function assertRewriteAfterEmit(script, emit, label) {
	const emitAt = script.lastIndexOf(emit);
	const rewriteAt = script.lastIndexOf("rewrite-declaration-extensions.mjs");
	assert.ok(emitAt >= 0, `${label} must emit declarations with ${emit}`);
	assert.ok(
		rewriteAt > emitAt,
		`${label} must rewrite extensionless imports after ${emit}`,
	);
}

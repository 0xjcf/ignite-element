import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	collectPublicEntrypoints,
	formatBytes,
	renderMarkdownTable,
} from "../measure-bundle-sizes.mjs";

describe("measure-bundle-sizes", () => {
	it("collects current public ESM entrypoints from package exports", () => {
		const packageJson = {
			name: "ignite-element",
			exports: {
				".": { import: "./dist/ignite-element.es.js" },
				"./xstate": { import: "./dist/xstate.es.js" },
				"./jsx": { import: "./dist/jsx/index.es.js" },
				"./react": { import: "./dist/react.es.js" },
				"./package.json": "./package.json",
			},
		};

		assert.deepEqual(collectPublicEntrypoints(packageJson), [
			{
				file: "dist/ignite-element.es.js",
				label: "ignite-element",
				subpath: ".",
				specifier: "ignite-element",
			},
			{
				file: "dist/xstate.es.js",
				label: "ignite-element/xstate",
				subpath: "./xstate",
				specifier: "ignite-element/xstate",
			},
			{
				file: "dist/jsx/index.es.js",
				label: "ignite-element/jsx",
				subpath: "./jsx",
				specifier: "ignite-element/jsx",
			},
			{
				file: "dist/react.es.js",
				label: "ignite-element/react",
				subpath: "./react",
				specifier: "ignite-element/react",
			},
		]);
	});

	it("formats byte counts for docs tables", () => {
		assert.equal(formatBytes(0), "0 B");
		assert.equal(formatBytes(999), "999 B");
		assert.equal(formatBytes(1536), "1.50 kB");
	});

	it("renders a stable markdown table for docs", () => {
		const markdown = renderMarkdownTable([
			{
				gzipBytes: 1536,
				label: "ignite-element/xstate",
				minifiedBytes: 4096,
				specifier: "ignite-element/xstate",
			},
		]);

		assert.equal(
			markdown,
			[
				"| Entry point | Import | Minified | Gzip |",
				"| --- | --- | ---: | ---: |",
				"| ignite-element/xstate | `ignite-element/xstate` | 4.00 kB | 1.50 kB |",
			].join("\n"),
		);
	});
});

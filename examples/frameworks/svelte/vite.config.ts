import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

const resolvePath = (path: string) =>
	fileURLToPath(new URL(path, import.meta.url));

const igniteElementSourceRoot = resolvePath(
	"../../../packages/ignite-element/src/",
);
// Example-fixture wiring for this monorepo so the demo runs against local
// SOURCE (not built `dist/`) and can't drift from a stale build. Not public
// consumer import guidance.
const adaptersSrc = resolvePath("../../../packages/ignite-adapters/src");
const rendererSrc = resolvePath("../../../packages/ignite-renderer/src");

export default defineConfig({
	// No compiler config is needed for custom elements — Svelte consumes any
	// hyphenated tag through the standard browser surface out of the box. (Vue
	// needs `isCustomElement`; Angular needs `CUSTOM_ELEMENTS_SCHEMA`.) That
	// absence is the point of this demo.
	plugins: [svelte()],
	server: {
		port: 8093,
	},
	resolve: {
		alias: [
			{
				find: "@ignite-element/core",
				replacement: resolvePath("../../../packages/ignite-core/src/index.ts"),
			},
			{
				find: "@ignite-element/adapters/redux",
				replacement: `${adaptersSrc}/redux.ts`,
			},
			{
				find: "@ignite-element/adapters",
				replacement: `${adaptersSrc}/index.ts`,
			},
			{
				find: "@ignite-element/renderer/lit",
				replacement: `${rendererSrc}/renderers/lit.ts`,
			},
			{
				find: "@ignite-element/renderer/jsx",
				replacement: `${rendererSrc}/renderers/ignite-jsx.ts`,
			},
			{
				find: "@ignite-element/renderer",
				replacement: `${rendererSrc}/index.ts`,
			},
			{
				find: /^ignite-element\/(.+)$/,
				replacement: `${igniteElementSourceRoot}$1`,
			},
			{
				find: "ignite-element",
				replacement: resolvePath(
					"../../../packages/ignite-element/src/index.ts",
				),
			},
		],
	},
});

import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

const resolvePath = (path: string) =>
	fileURLToPath(new URL(path, import.meta.url));

const igniteElementSourceRoot = resolvePath("../../../");
// Example-fixture wiring for this monorepo so the demo runs against local
// SOURCE (not built `dist/`) and can't drift from a stale build. Not public
// consumer import guidance.
const adaptersSrc = resolvePath("../../../../../ignite-adapters/src");
const rendererSrc = resolvePath("../../../../../ignite-renderer/src");

export default defineConfig({
	plugins: [
		vue({
			template: {
				compilerOptions: {
					// The one required Vue config: treat any hyphenated tag as a custom
					// element so Vue does not try to resolve <ignite-toggle> as a Vue
					// component (it would warn and skip rendering otherwise).
					isCustomElement: (tag) => tag.includes("-"),
				},
			},
		}),
	],
	server: {
		port: 8092,
	},
	resolve: {
		alias: [
			{
				find: "@ignite-element/core",
				replacement: resolvePath("../../../../../ignite-core/src/index.ts"),
			},
			{
				find: "@ignite-element/adapters/xstate",
				replacement: `${adaptersSrc}/xstate.ts`,
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
				replacement: resolvePath("../../../index.ts"),
			},
		],
	},
});

import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const resolvePath = (path: string) =>
	fileURLToPath(new URL(path, import.meta.url));

const igniteElementSourceRoot = resolvePath("../../../");
// Example-fixture wiring for this monorepo so the demo can exercise local
// source files. Not public consumer import guidance. The `@ignite-element/*`
// workspace packages are aliased to SOURCE (not built `dist/`) so the demo
// always runs against current source and can't drift from a stale build.
const adaptersSrc = resolvePath("../../../../../ignite-adapters/src");
const rendererSrc = resolvePath("../../../../../ignite-renderer/src");

export default defineConfig({
	root: resolvePath("./src"),
	esbuild: {
		jsx: "automatic",
		jsxImportSource: "../../../renderers/jsx",
	},
	server: {
		port: 8080,
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
				find: "@ignite-element/adapters/redux",
				replacement: `${adaptersSrc}/redux.ts`,
			},
			{
				find: "@ignite-element/adapters/mobx",
				replacement: `${adaptersSrc}/mobx.ts`,
			},
			{
				find: "@ignite-element/adapters/actor-web",
				replacement: `${adaptersSrc}/actor-web.ts`,
			},
			{
				find: "@ignite-element/adapters",
				replacement: `${adaptersSrc}/index.ts`,
			},
			{
				find: "@ignite-element/renderer/jsx-runtime",
				replacement: `${rendererSrc}/jsx/jsx-runtime.ts`,
			},
			{
				find: "@ignite-element/renderer/jsx-dev-runtime",
				replacement: `${rendererSrc}/jsx/jsx-dev-runtime.ts`,
			},
			{
				find: "@ignite-element/renderer/jsx/index",
				replacement: `${rendererSrc}/jsx/index.ts`,
			},
			{
				find: "@ignite-element/renderer/jsx",
				replacement: `${rendererSrc}/renderers/ignite-jsx.ts`,
			},
			{
				find: "@ignite-element/renderer/lit",
				replacement: `${rendererSrc}/renderers/lit.ts`,
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

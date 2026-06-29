/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const resolvePath = (path: string) =>
	fileURLToPath(new URL(path, import.meta.url));

// Example-fixture wiring for this monorepo so the demo runs against current
// SOURCE (not a possibly-stale `dist/`, and not the published package — which
// doesn't carry `ignite-element/tools/anthropic` until the next beta). In a real
// app you import the published `ignite-element` package directly. Mirrors the
// alias set used by the other examples. Order matters: more-specific subpaths
// must precede the package roots.
const igniteElementSrc = resolvePath("../../../packages/ignite-element/src/");
const adaptersSrc = resolvePath("../../../packages/ignite-adapters/src");
const rendererSrc = resolvePath("../../../packages/ignite-renderer/src");

export default defineConfig({
	resolve: {
		alias: [
			{
				find: "@ignite-element/core",
				replacement: resolvePath("../../../packages/ignite-core/src/index.ts"),
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
				replacement: `${igniteElementSrc}$1`,
			},
			{
				find: "ignite-element",
				replacement: `${igniteElementSrc}index.ts`,
			},
		],
	},
	test: {
		// `node`, NOT jsdom — the smart-home agent runs fully headless. This is the
		// end-to-end proof of the DOM-free agent runtime: getSchema/execute/on/
		// watchView work here with zero DOM polyfill.
		environment: "node",
		include: ["src/**/*.test.ts"],
	},
});

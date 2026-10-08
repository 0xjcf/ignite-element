import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const resolvePath = (path: string) =>
	fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
	resolve: {
		alias: [
			{
				find: "ignite-element/",
				replacement: resolvePath("../ignite-element/src/"),
			},
			{
				find: "ignite-element",
				replacement: resolvePath("../ignite-element/src/index.ts"),
			},
			{
				find: "@ignite-element/core",
				replacement: resolvePath("../ignite-core/src/index.ts"),
			},
			{
				find: "@ignite-element/adapters/xstate",
				replacement: resolvePath("../ignite-adapters/src/xstate.ts"),
			},
			{
				find: "@ignite-element/adapters",
				replacement: resolvePath("../ignite-adapters/src/index.ts"),
			},
			{
				find: "@ignite-element/renderer/jsx-runtime",
				replacement: resolvePath("../ignite-renderer/src/jsx/jsx-runtime.ts"),
			},
			{
				find: "@ignite-element/renderer/jsx-dev-runtime",
				replacement: resolvePath(
					"../ignite-renderer/src/jsx/jsx-dev-runtime.ts",
				),
			},
			{
				find: "@ignite-element/renderer/jsx/index",
				replacement: resolvePath("../ignite-renderer/src/jsx/index.ts"),
			},
			{
				find: "@ignite-element/renderer/jsx",
				replacement: resolvePath(
					"../ignite-renderer/src/renderers/ignite-jsx.ts",
				),
			},
			{
				find: "@ignite-element/renderer/lit",
				replacement: resolvePath("../ignite-renderer/src/renderers/lit.ts"),
			},
			{
				find: "@ignite-element/renderer",
				replacement: resolvePath("../ignite-renderer/src/index.ts"),
			},
		],
	},
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
	},
});

import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

const resolvePath = (path: string) =>
	fileURLToPath(new URL(path, import.meta.url));

export default mergeConfig(
	viteConfig,
	defineConfig({
		esbuild: {
			jsx: "automatic",
			jsxImportSource: "./src/renderers/jsx",
		},
		resolve: {
			alias: [
				{
					find: "ignite-element",
					replacement: resolvePath("./src/index.ts"),
				},
				{
					find: "ignite-element/",
					replacement: resolvePath("./src/"),
				},
				{
					find: "ignite-core",
					replacement: resolvePath("../ignite-core/src/index.ts"),
				},
				{
					find: "ignite-adapters/xstate",
					replacement: resolvePath("../ignite-adapters/src/xstate.ts"),
				},
				{
					find: "ignite-adapters/redux",
					replacement: resolvePath("../ignite-adapters/src/redux.ts"),
				},
				{
					find: "ignite-adapters/mobx",
					replacement: resolvePath("../ignite-adapters/src/mobx.ts"),
				},
				{
					find: "ignite-adapters",
					replacement: resolvePath("../ignite-adapters/src/index.ts"),
				},
				{
					find: "ignite-renderer/jsx",
					replacement: resolvePath(
						"../ignite-renderer/src/renderers/ignite-jsx.ts",
					),
				},
				{
					find: "ignite-renderer/lit",
					replacement: resolvePath("../ignite-renderer/src/renderers/lit.ts"),
				},
				{
					find: "ignite-renderer/jsx-runtime",
					replacement: resolvePath("../ignite-renderer/src/jsx/jsx-runtime.ts"),
				},
				{
					find: "ignite-renderer/jsx-dev-runtime",
					replacement: resolvePath(
						"../ignite-renderer/src/jsx/jsx-dev-runtime.ts",
					),
				},
				{
					find: "ignite-renderer/jsx/index",
					replacement: resolvePath("../ignite-renderer/src/jsx/index.ts"),
				},
				{
					find: "ignite-renderer",
					replacement: resolvePath("../ignite-renderer/src/index.ts"),
				},
			],
		},
		test: {
			environment: "jsdom",
			include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
			setupFiles: "./vitest.setup.ts",
			coverage: {
				exclude: [
					"src/examples/**",
					"**/*.config.{js,ts}",
					"vite.config.ts",
					"vitest.config.ts",
					"vite-env.d.ts",
					"dist/**",
					"src/index.ts",
					"src/**/*.d.ts",
					"scripts",
					"commitlint.config.cjs",
				],
			},
		},
	}),
);

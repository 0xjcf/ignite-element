import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const packageRoot = new URL("../../packages/ignite-element/", import.meta.url);
const workspaceRoot = new URL("../../", import.meta.url);
const resolvePath = (path: string) => fileURLToPath(new URL(path, packageRoot));
const requireFromPackage = createRequire(resolvePath("./package.json"));

export default defineConfig({
	root: fileURLToPath(packageRoot),
	server: {
		fs: { allow: [fileURLToPath(workspaceRoot)] },
	},
	define: {
		__IGNITE_DEV_WARNINGS__: "false",
		__IGNITE_HOST_RUNTIME__: "true",
	},
	esbuild: {
		jsx: "automatic",
		jsxImportSource: "react",
	},
	plugins: [
		{
			name: "spike-resolve-from-ignite-element",
			enforce: "pre",
			resolveId(id) {
				const external =
					id === "react" ||
					id === "react-dom" ||
					id === "xstate" ||
					id === "scheduler" ||
					id.startsWith("react/") ||
					id.startsWith("react-dom/") ||
					id.startsWith("scheduler/") ||
					id.startsWith("@testing-library/");
				if (!external) return null;
				try {
					return requireFromPackage.resolve(id);
				} catch {
					return null;
				}
			},
		},
	],
	resolve: {
		alias: [
			{ find: "ignite-element/", replacement: resolvePath("./src/") },
			{ find: "ignite-element", replacement: resolvePath("./src/index.ts") },
			{
				find: "@ignite-element/core",
				replacement: resolvePath("../ignite-core/src/index.ts"),
			},
			{
				find: "@ignite-element/adapters/actor-web",
				replacement: resolvePath("../ignite-adapters/src/actor-web.ts"),
			},
			{
				find: "@ignite-element/adapters/xstate",
				replacement: resolvePath("../ignite-adapters/src/xstate.ts"),
			},
			{
				find: "@ignite-element/adapters/redux",
				replacement: resolvePath("../ignite-adapters/src/redux.ts"),
			},
			{
				find: "@ignite-element/adapters/mobx",
				replacement: resolvePath("../ignite-adapters/src/mobx.ts"),
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
		environment: "jsdom",
		include: [
			fileURLToPath(new URL("./src/**/*.test.ts", import.meta.url)),
			fileURLToPath(new URL("./src/**/*.test.tsx", import.meta.url)),
		],
	},
});

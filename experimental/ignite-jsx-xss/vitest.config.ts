import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { igniteDevWarningsDefine } from "../../configs/vite/devWarnings";

const resolvePath = (path: string) =>
	fileURLToPath(new URL(path, import.meta.url));
const rendererSrc = resolvePath("../../packages/ignite-renderer/src/");

export default defineConfig({
	root: resolvePath("../../packages/ignite-element"),
	define: {
		...igniteDevWarningsDefine,
		__IGNITE_HOST_RUNTIME__: "true",
	},
	resolve: {
		alias: [
			{
				find: "@ignite-element/renderer/jsx-runtime",
				replacement: `${rendererSrc}jsx/jsx-runtime.ts`,
			},
			{
				find: "@ignite-element/renderer/jsx-dev-runtime",
				replacement: `${rendererSrc}jsx/jsx-dev-runtime.ts`,
			},
			{
				find: "@ignite-element/renderer/jsx/index",
				replacement: `${rendererSrc}jsx/index.ts`,
			},
			{
				find: "@ignite-element/renderer/jsx",
				replacement: `${rendererSrc}renderers/ignite-jsx.ts`,
			},
			{
				find: "@ignite-element/renderer",
				replacement: `${rendererSrc}index.ts`,
			},
			{
				find: "@ignite-element/core",
				replacement: resolvePath("../../packages/ignite-core/src/index.ts"),
			},
		],
	},
	server: {
		fs: {
			allow: [resolvePath("../..")],
		},
	},
	test: {
		environment: "jsdom",
		include: [resolvePath("./src/xss.test.ts")],
		exclude: [],
	},
});

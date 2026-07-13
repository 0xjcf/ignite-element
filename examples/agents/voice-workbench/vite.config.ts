import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const resolvePath = (path: string) =>
	fileURLToPath(new URL(path, import.meta.url));

const igniteElementSourceRoot = resolvePath(
	"../../../packages/ignite-element/src/",
);
const adaptersSourceRoot = resolvePath("../../../packages/ignite-adapters/src");
const rendererSourceRoot = resolvePath("../../../packages/ignite-renderer/src");

export default defineConfig({
	build: {
		rollupOptions: {
			input: {
				main: resolvePath("./index.html"),
				parity: resolvePath("./parity.html"),
			},
		},
	},
	test: { environment: "node" },
	resolve: {
		alias: [
			{
				find: "@ignite-element/core",
				replacement: resolvePath("../../../packages/ignite-core/src/index.ts"),
			},
			{
				find: "@ignite-element/adapters/xstate",
				replacement: `${adaptersSourceRoot}/xstate.ts`,
			},
			{
				find: "@ignite-element/adapters",
				replacement: `${adaptersSourceRoot}/index.ts`,
			},
			{
				find: "@ignite-element/renderer/jsx-runtime",
				replacement: `${rendererSourceRoot}/jsx/jsx-runtime.ts`,
			},
			{
				find: "@ignite-element/renderer/jsx-dev-runtime",
				replacement: `${rendererSourceRoot}/jsx/jsx-dev-runtime.ts`,
			},
			{
				find: "@ignite-element/renderer/jsx",
				replacement: `${rendererSourceRoot}/renderers/ignite-jsx.ts`,
			},
			{
				find: "@ignite-element/renderer",
				replacement: `${rendererSourceRoot}/index.ts`,
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

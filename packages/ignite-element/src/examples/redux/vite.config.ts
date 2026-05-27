import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { igniteConfigVitePlugin } from "../../plugins/viteIgniteConfigPlugin";

const resolvePath = (path: string) =>
	fileURLToPath(new URL(path, import.meta.url));

const igniteElementSourceRoot = resolvePath("../../");
// These aliases and the JSX import source below are example-fixture wiring for
// this monorepo so the demo can exercise local source files. They are not
// public consumer import guidance.
const igniteConfigPlugin = igniteConfigVitePlugin({
	// Vite root points to ./src; provide absolute path so the shared config loads.
	configPath: resolvePath("./ignite.config.ts"),
});

export default defineConfig({
	root: resolvePath("./src"),
	esbuild: {
		jsx: "automatic",
		jsxImportSource: "../../renderers/jsx",
	},
	server: {
		port: 8080,
	},
	resolve: {
		alias: [
			{
				find: /^ignite-element\/(.+)$/,
				replacement: `${igniteElementSourceRoot}$1`,
			},
			{
				find: "ignite-element",
				replacement: resolvePath("../../index.ts"),
			},
		],
	},
	plugins: [igniteConfigPlugin],
});

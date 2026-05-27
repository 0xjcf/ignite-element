import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { igniteConfigVitePlugin } from "../../plugins/viteIgniteConfigPlugin";

const resolvePath = (path: string) =>
	fileURLToPath(new URL(path, import.meta.url));

const igniteElementSourceRoot = resolvePath("../../");
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

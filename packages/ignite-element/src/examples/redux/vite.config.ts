import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { igniteConfigVitePlugin } from "../../plugins/viteIgniteConfigPlugin";

const resolvePath = (path: string) =>
	fileURLToPath(new URL(path, import.meta.url));

const igniteConfigPlugin = igniteConfigVitePlugin({
	// Vite root points to ./src; provide absolute path so the shared config loads.
	configPath: resolve(__dirname, "ignite.config.ts"),
});

export default defineConfig({
	root: resolve(__dirname, "src"),
	esbuild: {
		jsx: "automatic",
		jsxImportSource: "../../renderers/jsx",
	},
	server: {
		port: 8080,
	},
	resolve: {
		alias: {
			"ignite-element/config/loadIgniteConfig": resolvePath(
				"../../config/loadIgniteConfig.ts",
			),
			"ignite-element": resolvePath("../../index.ts"),
			"ignite-element/": resolvePath("../../"),
		},
	},
	plugins: [igniteConfigPlugin],
});

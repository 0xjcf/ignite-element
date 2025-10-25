import { resolve } from "node:path";
import { defineConfig } from "vite";
import { igniteConfigVitePlugin } from "../../plugins/viteIgniteConfigPlugin";

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
	plugins: [igniteConfigPlugin],
});

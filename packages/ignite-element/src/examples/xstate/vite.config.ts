import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { igniteConfigVitePlugin } from "../../plugins/viteIgniteConfigPlugin";

const resolvePath = (path: string) =>
	fileURLToPath(new URL(path, import.meta.url));

const igniteConfigPlugin = igniteConfigVitePlugin();

export default defineConfig({
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

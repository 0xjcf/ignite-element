import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { igniteConfigVitePlugin } from "../../plugins/viteIgniteConfigPlugin";

const resolvePath = (path: string) =>
	fileURLToPath(new URL(path, import.meta.url));

const igniteElementSourceRoot = resolvePath("../../");

export default defineConfig({
	server: {
		port: 8080,
	},
	resolve: {
		alias: [
			{
				find: "ignite-adapters/mobx",
				replacement: resolvePath("../../../../ignite-adapters/src/mobx.ts"),
			},
			{
				find: "ignite-element/config/loadIgniteConfig",
				replacement: resolvePath("../../config/loadIgniteConfig.ts"),
			},
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
	plugins: [igniteConfigVitePlugin()],
});

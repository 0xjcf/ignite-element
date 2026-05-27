import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { igniteConfigVitePlugin } from "../../plugins/viteIgniteConfigPlugin";

const resolvePath = (path: string) =>
	fileURLToPath(new URL(path, import.meta.url));

const igniteElementSourceRoot = resolvePath("../../");
// These aliases are example-fixture wiring for this monorepo so the demo can
// exercise local source files. They are not public consumer import guidance.
const igniteConfigPlugin = igniteConfigVitePlugin();

export default defineConfig({
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

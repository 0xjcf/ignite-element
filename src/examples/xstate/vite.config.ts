import { defineConfig } from "vite";
import { igniteConfigVitePlugin } from "../../plugins/viteIgniteConfigPlugin";

const igniteConfigPlugin = igniteConfigVitePlugin();

export default defineConfig({
	server: {
		port: 8080,
	},
	plugins: [igniteConfigPlugin],
});

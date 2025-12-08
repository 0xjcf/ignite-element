import { defineConfig } from "vite";
import { igniteConfigVitePlugin } from "../../plugins/viteIgniteConfigPlugin";

export default defineConfig({
	server: {
		port: 8080,
	},
	plugins: [igniteConfigVitePlugin()],
});

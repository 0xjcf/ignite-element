import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
	root: resolve(__dirname, "src"),
	server: {
		port: 8080,
	},
});

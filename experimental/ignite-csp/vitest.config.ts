import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const workspace = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
	root: fileURLToPath(
		new URL("../../packages/ignite-element", import.meta.url),
	),
	define: {
		__IGNITE_DEV_WARNINGS__: "true",
	},
	server: {
		fs: {
			allow: [workspace],
		},
	},
	test: {
		environment: "node",
		include: [fileURLToPath(new URL("./src/**/*.test.ts", import.meta.url))],
	},
});

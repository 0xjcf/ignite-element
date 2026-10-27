import { defineConfig } from "vitest/config";

export default defineConfig({
	define: {
		__IGNITE_DEV_WARNINGS__: "true",
		__IGNITE_HOST_RUNTIME__: "false",
	},
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
	},
});

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	root: fileURLToPath(new URL("../../", import.meta.url)),
	test: {
		environment: "node", // Use Node.js environment
		globals: true, // Enable Vitest globals like describe, it, and expect.
		include: ["scripts/__tests__/**/*.test.js"], // Only run tests in the scripts directory
	},
});

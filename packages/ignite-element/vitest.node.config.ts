import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node", // Use Node.js environment
		globals: true, // Enable Vitest globals like describe, it, and expect.
		include: ["scripts/__tests__/**/*.test.js"], // Only run tests in the scripts directory
	},
});

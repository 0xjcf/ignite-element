import { defineConfig, mergeConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node", // Use Node.js environment
    globals: true, // Enable global imports like vi, describe, etc.
    include: ["scripts/__tests__/**/*.test.ts"], // Only run tests in the scripts directory
  },
});

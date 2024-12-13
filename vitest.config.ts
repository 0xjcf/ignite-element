import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom", // Use jsdom for package tests
      include: ["src/**/*.test.ts"], // Include only tests in the src directory
    },
  })
);

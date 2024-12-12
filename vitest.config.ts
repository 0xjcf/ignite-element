import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: "jsdom",
      coverage: {
        exclude: [
          "src/examples/**",          // Exclude everything in src/examples/
          "**/*.config.{js,ts}",      // Exclude all .config.js and .config.ts files
          "vite.config.ts",           // Exclude vite.config.ts
          "vitest.config.ts",         // Exclude vitest.config.ts
          "vite-env.d.ts",            // Exclude vite-env.d.ts
          "dist/**",                  // Exclude everything in the dist directory
          "src/index.ts",             // Exclude index.ts if it's just an entry point
          "src/**/*.d.ts",            // Exclude all .d.ts files
        ]
      }
    },
  })
);

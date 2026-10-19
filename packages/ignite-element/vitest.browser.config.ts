import { defineConfig } from "vitest/config";

// Suites that launch Chromium. They are excluded from the default config, so
// `pnpm test` runs without a browser install. Run `pnpm test:browser` after
// `pnpm exec playwright install chromium`.
export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.browser.test.ts"],
	},
});

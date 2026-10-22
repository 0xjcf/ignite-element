import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(
	fileURLToPath(
		new URL("../../packages/ignite-element/package.json", import.meta.url),
	),
);
const { defineConfig, devices } = require("@playwright/test");

const packageDir = fileURLToPath(
	new URL("../../packages/ignite-element", import.meta.url),
);

export default defineConfig({
	testDir: "./probes",
	fullyParallel: false,
	workers: 1,
	retries: 0,
	forbidOnly: !!process.env.CI,
	reporter: "line",
	outputDir: "/tmp/ignite-csp-playwright",
	timeout: 60_000,
	use: {
		trace: "off",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: {
		command:
			"pnpm --dir ../../examples/adapters/xstate run build:css && pnpm exec vite ../../examples/adapters/xstate --config ../../examples/adapters/xstate/vite.config.ts --host 127.0.0.1 --port 8091 --strictPort",
		cwd: packageDir,
		url: "http://127.0.0.1:8091",
		reuseExistingServer: false,
		timeout: 120_000,
	},
});

import { defineConfig } from "vitest/config";
export default defineConfig({
	resolve: { dedupe: ["react", "react-dom"] },
	test: {
		environment: "jsdom",
		server: { deps: { inline: ["ignite-element"] } },
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
	},
});

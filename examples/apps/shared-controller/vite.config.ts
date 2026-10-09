import { defineConfig } from "vitest/config";
import { igniteDevWarningsDefine } from "../../../configs/vite/devWarnings";
export default defineConfig({
	define: igniteDevWarningsDefine,
	resolve: { dedupe: ["react", "react-dom"] },
	test: {
		environment: "jsdom",
		server: { deps: { inline: ["ignite-element"] } },
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
	},
});

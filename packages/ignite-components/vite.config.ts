import { defineConfig } from "vite";
import { createLibConfig } from "../../configs/vite/lib";

export default defineConfig({
	...createLibConfig({
		name: "ignite-components",
		entry: "src/index.ts",
		external: [
			"ignite-element",
			"ignite-element/xstate",
			"ignite-element/jsx",
			"ignite-element/jsx/jsx-runtime",
			"ignite-element/jsx/jsx-dev-runtime",
			"xstate",
		],
	}),
	esbuild: {
		jsx: "automatic",
		jsxImportSource: "ignite-element/jsx",
	},
});

import { defineConfig } from "vite";
import { createLibConfig } from "../../configs/vite/lib";

export default defineConfig(
	createLibConfig({
		name: "ignite-renderer",
		entry: {
			index: "src/index.ts",
			jsx: "src/renderers/ignite-jsx.ts",
			lit: "src/renderers/lit.ts",
			"jsx-runtime": "src/jsx/jsx-runtime.ts",
			"jsx-dev-runtime": "src/jsx/jsx-dev-runtime.ts",
			"jsx/index": "src/jsx/index.ts",
		},
		external: ["lit-html"],
		globals: {
			"lit-html": "litHtml",
		},
	}),
);

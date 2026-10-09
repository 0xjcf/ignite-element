import { defineConfig } from "vite";
import { createLibConfig } from "../../configs/vite/lib";

const devArtifact = process.env.IGNITE_LIB_DEV === "1";

export default defineConfig({
	...createLibConfig({
		devArtifact,
		name: "ignite-renderer",
		entry: {
			index: "src/index.ts",
			jsx: "src/renderers/ignite-jsx.ts",
			lit: "src/renderers/lit.ts",
			"jsx-runtime": "src/jsx/jsx-runtime.ts",
			"jsx-dev-runtime": "src/jsx/jsx-dev-runtime.ts",
			"jsx/index": "src/jsx/index.ts",
			hosts: "src/renderers/jsx/hosts.ts",
		},
		external: ["lit-html"],
		globals: {
			"lit-html": "litHtml",
		},
	}),
});

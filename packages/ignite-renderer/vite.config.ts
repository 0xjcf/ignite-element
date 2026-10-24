import { defineConfig } from "vite";
import { createLibConfig } from "../../configs/vite/lib";

const devArtifact = process.env.IGNITE_LIB_DEV === "1";

const libConfig = createLibConfig({
	devArtifact,
	name: "ignite-renderer",
	entry: {
		index: "src/index.ts",
		jsx: "src/renderers/ignite-jsx.ts",
		lit: "src/renderers/lit.ts",
		"jsx-runtime": "src/jsx/jsx-runtime.ts",
		"jsx-dev-runtime": "src/jsx/jsx-dev-runtime.ts",
		"jsx/index": "src/jsx/index.ts",
		// Read seam for the published element chunk. It does not export the marker.
		"jsx/author-style": "src/renderers/jsx/authorStyleRead.ts",
		// Compiler target. Not a package export. Relative imports share this file.
		"jsx/author-style-mark": "src/renderers/jsx/authorStyle.ts",
	},
	external: ["lit-html"],
	globals: {
		"lit-html": "litHtml",
	},
});

export default defineConfig(libConfig);

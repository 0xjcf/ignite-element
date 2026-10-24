import { defineConfig, type Plugin } from "vite";
import { createLibConfig } from "../../configs/vite/lib";

const devArtifact = process.env.IGNITE_LIB_DEV === "1";

/** Keep the author-style module one file. Published chunks import it. */
function externalizeAuthorStyle(): Plugin {
	return {
		name: "externalize-author-style",
		resolveId(source, importer) {
			if (!importer) return null;
			if (/(?:^|\/)authorStyle(?:\.ts|\.js)?$/.test(source)) {
				return {
					id: "@ignite-element/renderer/jsx/author-style",
					external: true,
				};
			}
			return null;
		},
	};
}

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
		"jsx/author-style": "src/renderers/jsx/authorStyle.ts",
	},
	external: ["lit-html", "@ignite-element/renderer/jsx/author-style"],
	globals: {
		"lit-html": "litHtml",
	},
});

export default defineConfig({
	...libConfig,
	plugins: [...(libConfig.plugins ?? []), externalizeAuthorStyle()],
});

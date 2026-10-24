import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import { createLibConfig } from "../../configs/vite/lib";

const devArtifact = process.env.IGNITE_LIB_DEV === "1";
const devMark = "jsx/author-style-mark.development.es.js";
const readSeamSource =
	'export { readAuthorStyle } from "./author-style-mark.es.js";\n';

function writeAuthorReadSeam(): void {
	const file = path.resolve("dist/jsx/author-style-read.es.js");
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, readSeamSource);
}

function oneAuthorRegistry(): Plugin {
	return {
		name: "one-author-registry",
		apply: "build",
		generateBundle(_options, bundle) {
			if (!devArtifact) return;
			delete bundle[devMark];
			for (const item of Object.values(bundle)) {
				if (item.type !== "chunk") continue;
				item.code = item.code.replaceAll(
					"author-style-mark.development.es.js",
					"author-style-mark.es.js",
				);
			}
		},
		closeBundle() {
			writeAuthorReadSeam();
			if (!devArtifact) return;
			const stale = path.resolve("dist", devMark);
			if (existsSync(stale)) unlinkSync(stale);
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
		// Not a package export. The element chunk and the jsx bundle both import this file.
		"jsx/author-style-mark": "src/renderers/jsx/authorStyle.ts",
	},
	external: ["lit-html"],
	globals: {
		"lit-html": "litHtml",
	},
});

export default defineConfig({
	...libConfig,
	plugins: [...(libConfig.plugins ?? []), oneAuthorRegistry()],
});

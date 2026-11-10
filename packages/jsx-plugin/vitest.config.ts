import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vitest/config";

const unpluginSource = fileURLToPath(
	new URL("./src/unplugin.ts", import.meta.url),
);

/** Tests that exercise the bundler plugin load its source, not dist. */
function unpluginSourcePlugin(): Plugin {
	return {
		name: "jsx-plugin-unplugin-source",
		enforce: "pre",
		resolveId(id, importer) {
			if (!importer) return null;
			if (id !== "./unplugin.js" && !id.endsWith("/unplugin.js")) return null;
			const from = importer.split("?")[0] ?? importer;
			if (from.includes("/dist/")) return null;
			if (!from.includes("/packages/jsx-plugin/src/")) return null;
			return unpluginSource;
		},
	};
}

export default defineConfig({
	plugins: [unpluginSourcePlugin()],
	define: {
		__IGNITE_DEV_WARNINGS__: "true",
		__IGNITE_HOST_RUNTIME__: "false",
	},
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
	},
});

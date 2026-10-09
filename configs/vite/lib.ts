import type { ModuleFormat } from "rollup";
import type { UserConfig } from "vite";
import dts from "vite-plugin-dts";

type LibConfigInput = {
	name: string;
	entry: Record<string, string> | string;
	external: string[];
	globals?: Record<string, string>;
	outDir?: string;
	/** Second pass: warnings on, filenames `*.development.es.js`, keep the first build. */
	devArtifact?: boolean;
};

export function createLibConfig({
	name,
	entry,
	external,
	globals,
	outDir = "dist",
	devArtifact = false,
}: LibConfigInput): UserConfig {
	return {
		define: {
			__IGNITE_DEV_WARNINGS__: JSON.stringify(devArtifact),
		},
		build: {
			emptyOutDir: !devArtifact,
			minify: "esbuild",
			outDir,
			lib: {
				entry,
				formats: ["es"],
				name,
				fileName: (format: ModuleFormat, entryName: string) => {
					const file =
						entryName === "index"
							? `${name}.${format}.js`
							: `${entryName}.${format}.js`;
					return devArtifact
						? file.replace(/\.es\.js$/, ".development.es.js")
						: file;
				},
			},
			rollupOptions: {
				external,
				output: globals ? { globals } : undefined,
			},
		},
		plugins: devArtifact
			? []
			: [
					dts({
						insertTypesEntry: true,
						outDir: `${outDir}/types`,
					}),
				],
	};
}

import type { UserConfig } from "vite";
import dts from "vite-plugin-dts";

type LibConfigInput = {
	name: string;
	entry: Record<string, string> | string;
	external: string[];
	globals?: Record<string, string>;
	outDir?: string;
};

export function createLibConfig({
	name,
	entry,
	external,
	globals,
	outDir = "dist",
}: LibConfigInput): UserConfig {
	return {
		build: {
			outDir,
			lib: {
				entry,
				name,
				fileName: (format, entryName) =>
					entryName === "index"
						? `${name}.${format}.js`
						: `${entryName}.${format}.js`,
			},
			rollupOptions: {
				external,
				output: globals ? { globals } : undefined,
			},
		},
		plugins: [
			dts({
				insertTypesEntry: true,
				outDir: `${outDir}/types`,
			}),
		],
	};
}

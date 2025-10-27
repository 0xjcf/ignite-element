import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
	build: {
		lib: {
			entry: {
				index: "src/index.ts",
				xstate: "src/xstate.ts",
				redux: "src/redux.ts",
				mobx: "src/mobx.ts",
				"renderers/ignite-jsx": "src/renderers/ignite-jsx.ts",
				"renderers/lit": "src/renderers/lit.ts",
				"config/loadIgniteConfig": "src/config/loadIgniteConfig.ts",
			},
			fileName: (format, entryName) => {
				const base = entryName === "index" ? "ignite-element" : entryName;
				return `${base}.${format}.js`;
			},
		},
		rollupOptions: {
			external: ["lit-html", "xstate", "mobx", "redux", "@reduxjs/toolkit"],
			output: {
				globals: {
					xstate: "XState",
					redux: "Redux",
					mobx: "MobX",
					"lit-html": "LitHTML",
					"@reduxjs/toolkit": "RTK",
				},
			},
		},
	},
	define: {
		"process.env.NODE_ENV": JSON.stringify("production"), // Inject NODE_ENV as production
	},
	plugins: [
		dts({
			insertTypesEntry: true,
			outDir: "./dist/types",
		}),
	],
});

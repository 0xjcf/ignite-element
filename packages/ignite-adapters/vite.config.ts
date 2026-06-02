import { defineConfig } from "vite";
import { createLibConfig } from "../../configs/vite/lib";

export default defineConfig(
	createLibConfig({
		name: "ignite-adapters",
		entry: {
			"actor-web": "src/actor-web.ts",
			index: "src/index.ts",
			xstate: "src/xstate.ts",
			redux: "src/redux.ts",
			mobx: "src/mobx.ts",
		},
		external: [
			"@ignite-element/core",
			"@reduxjs/toolkit",
			"redux",
			"mobx",
			"xstate",
		],
		globals: {
			"@reduxjs/toolkit": "RTK",
			"@ignite-element/core": "igniteCore",
			redux: "Redux",
			mobx: "mobx",
			xstate: "XState",
		},
	}),
);

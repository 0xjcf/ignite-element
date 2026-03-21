import { defineConfig } from "vite";
import { createLibConfig } from "../../configs/vite/lib";

export default defineConfig(
	createLibConfig({
		name: "ignite-store",
		entry: {
			index: "src/index.ts",
			redux: "src/redux.ts",
			mobx: "src/mobx.ts",
		},
		external: ["ignite-core", "@reduxjs/toolkit", "redux", "mobx"],
		globals: {
			"@reduxjs/toolkit": "RTK",
			redux: "Redux",
			mobx: "MobX",
		},
	}),
);

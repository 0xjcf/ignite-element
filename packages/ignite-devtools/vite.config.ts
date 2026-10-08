import { defineConfig } from "vite";
import { createLibConfig } from "../../configs/vite/lib";

export default defineConfig(
	createLibConfig({
		name: "ignite-devtools",
		entry: "src/index.ts",
		external: ["ignite-element", "ignite-element/xstate", "xstate"],
	}),
);

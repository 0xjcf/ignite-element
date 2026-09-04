import { defineConfig } from "vite";
import { createLibConfig } from "../../configs/vite/lib";

export default defineConfig(
	createLibConfig({
		name: "ignite-core",
		entry: {
			index: "src/index.ts",
		},
	}),
);

import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      name: "igniteElement",
      fileName: (format) => `ignite-element.${format}.js`,
    },
    rollupOptions: {
      external: ["xstate", "redux", "mobx", "lit-html"],
      output: {
        globals: {
          xstate: "XState",
          redux: "Redux",
          mobx: "MobX",
          "lit-html": "LitHTML",
        },
      },
    },
  },
  plugins: [
    dts({
      insertTypesEntry: true,
      outDir: "./dist/types",
    }),
  ],
});

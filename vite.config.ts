import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      name: "igniteElement",
      fileName: (format) => `ignite-element.${format}.js`,
    },
    rollupOptions: {
      external: ["xstate", "redux", "mobx"],
      output: {
        globals: {
          xstate: "XState",
          redux: "Redux",
          mobx: "MobX",
        },
      },
    },
    emptyOutDir: false
  },
});

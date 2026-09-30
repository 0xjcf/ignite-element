// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("vite-plugin-dts", () => ({
	default: vi.fn((options) => ({ name: "vite-plugin-dts", options })),
}));

import { createLibConfig } from "../../../../configs/vite/lib";

describe("createLibConfig", () => {
	describe("build.outDir", () => {
		it("defaults outDir to 'dist' when not provided", () => {
			const config = createLibConfig({
				name: "my-lib",
				entry: "src/index.ts",
				external: [],
			});
			expect(config.build?.outDir).toBe("dist");
		});

		it("uses provided outDir", () => {
			const config = createLibConfig({
				name: "my-lib",
				entry: "src/index.ts",
				external: [],
				outDir: "output",
			});
			expect(config.build?.outDir).toBe("output");
		});
	});

	describe("build.lib", () => {
		it("sets lib.name to the provided name", () => {
			const config = createLibConfig({
				name: "ignite-core",
				entry: "src/index.ts",
				external: [],
			});
			expect((config.build?.lib as { name: string }).name).toBe("ignite-core");
		});

		it("sets lib.entry to a string entry", () => {
			const config = createLibConfig({
				name: "my-lib",
				entry: "src/index.ts",
				external: [],
			});
			expect((config.build?.lib as { entry: unknown }).entry).toBe(
				"src/index.ts",
			);
		});

		it("sets lib.entry to a record entry", () => {
			const entry = { index: "src/index.ts", xstate: "src/xstate.ts" };
			const config = createLibConfig({
				name: "my-lib",
				entry,
				external: [],
			});
			expect((config.build?.lib as { entry: unknown }).entry).toEqual(entry);
		});
	});

	describe("build.lib.fileName", () => {
		it("returns '<name>.<format>.js' when entryName is 'index'", () => {
			const config = createLibConfig({
				name: "ignite-element",
				entry: { index: "src/index.ts" },
				external: [],
			});
			const lib = config.build?.lib as {
				fileName?: (format: string, entryName: string) => string;
			};
			expect(lib.fileName?.("esm", "index")).toBe("ignite-element.esm.js");
		});

		it("returns '<name>.<format>.js' for 'cjs' format with 'index' entry", () => {
			const config = createLibConfig({
				name: "ignite-element",
				entry: "src/index.ts",
				external: [],
			});
			const lib = config.build?.lib as {
				fileName?: (format: string, entryName: string) => string;
			};
			expect(lib.fileName?.("cjs", "index")).toBe("ignite-element.cjs.js");
		});

		it("returns '<entryName>.<format>.js' when entryName is not 'index'", () => {
			const config = createLibConfig({
				name: "ignite-element",
				entry: { xstate: "src/xstate.ts" },
				external: [],
			});
			const lib = config.build?.lib as {
				fileName?: (format: string, entryName: string) => string;
			};
			expect(lib.fileName?.("esm", "xstate")).toBe("xstate.esm.js");
		});

		it("returns '<entryName>.<format>.js' for multiple non-index named entries", () => {
			const config = createLibConfig({
				name: "ignite-element",
				entry: { redux: "src/redux.ts", mobx: "src/mobx.ts" },
				external: [],
			});
			const lib = config.build?.lib as {
				fileName?: (format: string, entryName: string) => string;
			};
			expect(lib.fileName?.("cjs", "redux")).toBe("redux.cjs.js");
			expect(lib.fileName?.("cjs", "mobx")).toBe("mobx.cjs.js");
		});

		it("uses entryName for non-index entries regardless of lib name", () => {
			const config = createLibConfig({
				name: "ignite-element",
				entry: { "ignite-jsx": "src/jsx.ts" },
				external: [],
			});
			const lib = config.build?.lib as {
				fileName?: (format: string, entryName: string) => string;
			};
			expect(lib.fileName?.("esm", "ignite-jsx")).toBe("ignite-jsx.esm.js");
		});
	});

	describe("build.rollupOptions", () => {
		it("passes the external array to rollupOptions", () => {
			const external = ["xstate", "vite", "react"];
			const config = createLibConfig({
				name: "my-lib",
				entry: "src/index.ts",
				external,
			});
			expect(config.build?.rollupOptions?.external).toEqual(external);
		});

		it("sets rollupOptions.output to undefined when globals is not provided", () => {
			const config = createLibConfig({
				name: "my-lib",
				entry: "src/index.ts",
				external: [],
			});
			expect(config.build?.rollupOptions?.output).toBeUndefined();
		});

		it("sets rollupOptions.output.globals when globals are provided", () => {
			const globals = { xstate: "XState", react: "React" };
			const config = createLibConfig({
				name: "my-lib",
				entry: "src/index.ts",
				external: ["xstate", "react"],
				globals,
			});
			expect(config.build?.rollupOptions?.output).toEqual({ globals });
		});

		it("handles an empty external array", () => {
			const config = createLibConfig({
				name: "my-lib",
				entry: "src/index.ts",
				external: [],
			});
			expect(config.build?.rollupOptions?.external).toEqual([]);
		});

		it("handles multiple external dependencies", () => {
			const config = createLibConfig({
				name: "my-lib",
				entry: "src/index.ts",
				external: ["react", "react-dom", "xstate", "@xstate/react"],
			});
			expect(config.build?.rollupOptions?.external).toHaveLength(4);
		});
	});

	describe("plugins", () => {
		it("includes exactly one plugin", () => {
			const config = createLibConfig({
				name: "my-lib",
				entry: "src/index.ts",
				external: [],
			});
			expect(config.plugins).toHaveLength(1);
		});

		it("configures dts plugin with insertTypesEntry: true", () => {
			const config = createLibConfig({
				name: "my-lib",
				entry: "src/index.ts",
				external: [],
			});
			const dtsPlugin = config.plugins?.[0] as {
				options: { insertTypesEntry: boolean };
			};
			expect(dtsPlugin.options.insertTypesEntry).toBe(true);
		});

		it("configures dts outDir as 'dist/types' using default outDir", () => {
			const config = createLibConfig({
				name: "my-lib",
				entry: "src/index.ts",
				external: [],
			});
			const dtsPlugin = config.plugins?.[0] as {
				options: { outDir: string };
			};
			expect(dtsPlugin.options.outDir).toBe("dist/types");
		});

		it("configures dts outDir as '<outDir>/types' using custom outDir", () => {
			const config = createLibConfig({
				name: "my-lib",
				entry: "src/index.ts",
				external: [],
				outDir: "build",
			});
			const dtsPlugin = config.plugins?.[0] as {
				options: { outDir: string };
			};
			expect(dtsPlugin.options.outDir).toBe("build/types");
		});

		it("types outDir uses the same outDir value as build.outDir", () => {
			const config = createLibConfig({
				name: "my-lib",
				entry: "src/index.ts",
				external: [],
				outDir: "custom-dist",
			});
			const dtsPlugin = config.plugins?.[0] as {
				options: { outDir: string };
			};
			// build.outDir and dts outDir should both use the custom outDir value
			expect(config.build?.outDir).toBe("custom-dist");
			expect(dtsPlugin.options.outDir).toBe("custom-dist/types");
		});
	});

	describe("complete config shape", () => {
		it("returns an object with build and plugins keys", () => {
			const config = createLibConfig({
				name: "my-lib",
				entry: "src/index.ts",
				external: [],
			});
			expect(config).toHaveProperty("build");
			expect(config).toHaveProperty("plugins");
		});

		it("does not set globals output when globals is explicitly undefined", () => {
			const config = createLibConfig({
				name: "my-lib",
				entry: "src/index.ts",
				external: ["xstate"],
				globals: undefined,
			});
			expect(config.build?.rollupOptions?.output).toBeUndefined();
		});
	});
});
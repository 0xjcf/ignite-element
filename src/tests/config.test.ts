import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import {
	defineIgniteConfig,
	getIgniteConfig,
	type IgniteConfig,
} from "../config";
import * as globalStylesModule from "../globalStyles";

const CONFIG_SYMBOL = Symbol.for("ignite-element.config");
const litLoaderSpy = vi.fn();
const igniteJsxLoaderSpy = vi.fn();

vi.mock("../renderers/lit", () => {
	litLoaderSpy();
	return {
		__esModule: true,
	};
});

vi.mock("../renderers/ignite-jsx", () => {
	igniteJsxLoaderSpy();
	return {
		__esModule: true,
	};
});

let loadIgniteConfig: typeof import("../config/loadIgniteConfig")["loadIgniteConfig"];

beforeAll(async () => {
	({ loadIgniteConfig } = await import("../config/loadIgniteConfig"));
});

afterAll(() => {
	litLoaderSpy.mockReset();
	igniteJsxLoaderSpy.mockReset();
});

function clearConfig(): void {
	const registry = globalThis as typeof globalThis & {
		[CONFIG_SYMBOL]?: IgniteConfig;
	};
	delete registry[CONFIG_SYMBOL];
	globalStylesModule.setGlobalStyles(undefined);
}

describe("defineIgniteConfig", () => {
	beforeEach(() => {
		clearConfig();
	});

	afterEach(() => {
		clearConfig();
	});

	it("stores the normalized config on a global symbol", () => {
		const config = defineIgniteConfig({
			styles: "./theme.css",
		});

		expect(getIgniteConfig()).toEqual({
			styles: "./theme.css",
		});
		expect(config).not.toBeUndefined();
	});

	it("returns undefined when no config has been registered", () => {
		clearConfig();
		expect(getIgniteConfig()).toBeUndefined();
	});

	it("accepts deprecated globalStyles but normalizes to styles and warns", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const styles = "./theme.css";

		defineIgniteConfig({
			globalStyles: styles,
		});

		expect(getIgniteConfig()).toEqual({ styles });
		expect(warnSpy).toHaveBeenCalledWith(
			"[ignite-element] `globalStyles` is deprecated. Use `styles` in ignite.config instead.",
		);
		warnSpy.mockRestore();
	});

	it("invokes setGlobalStyles when styles are provided", () => {
		const spy = vi.spyOn(globalStylesModule, "setGlobalStyles");

		const styles = "./theme.css";
		defineIgniteConfig({
			styles,
		});

		expect(spy).toHaveBeenCalledWith(styles);
		spy.mockRestore();
	});

	it("does not invoke setGlobalStyles when styles are omitted", () => {
		const spy = vi.spyOn(globalStylesModule, "setGlobalStyles");

		defineIgniteConfig({});

		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
	});

	it("supports absolute styles URLs (e.g., CDN assets)", () => {
		const cdnStyles = "https://cdn.example.com/theme.css";
		const spy = vi.spyOn(globalStylesModule, "setGlobalStyles");

		defineIgniteConfig({
			styles: cdnStyles,
		});

		expect(getIgniteConfig()).toEqual({
			styles: cdnStyles,
		});
		expect(spy).toHaveBeenCalledWith(cdnStyles);

		spy.mockRestore();
	});

	it("supports absolute StyleObject hrefs", () => {
		const styleObject = {
			href: "https://cdn.example.com/theme.css",
			integrity: "sha384-abc123",
			crossOrigin: "anonymous",
		} as const;
		const spy = vi.spyOn(globalStylesModule, "setGlobalStyles");

		defineIgniteConfig({
			styles: styleObject,
		});

		expect(getIgniteConfig()).toEqual({
			styles: styleObject,
		});
		expect(spy).toHaveBeenCalledWith(styleObject);

		spy.mockRestore();
	});

	it("stores strategy and logging when provided", () => {
		defineIgniteConfig({ strategy: "diff", logging: "debug" });
		expect(getIgniteConfig()).toEqual({ strategy: "diff", logging: "debug" });
	});

	it("stores renderer identifier when provided", () => {
		defineIgniteConfig({ renderer: "ignite-jsx" });
		expect(getIgniteConfig()).toEqual({ renderer: "ignite-jsx" });
	});

	it("warns and falls back to lit for unknown renderer", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		defineIgniteConfig({ renderer: "unknown" as never });

		expect(warnSpy).toHaveBeenCalledWith(
			'[ignite-element] Unknown renderer "unknown" in ignite.config. Supported values are "lit" and "ignite-jsx". Falling back to "lit".',
		);
		expect(getIgniteConfig()).toEqual({ renderer: "lit" });

		warnSpy.mockRestore();
	});
});

describe("loadIgniteConfig", () => {
	beforeEach(() => {
		litLoaderSpy.mockClear();
		igniteJsxLoaderSpy.mockClear();
	});

	it("loads the lit renderer when requested by the config", async () => {
		await loadIgniteConfig(async () => ({
			default: { renderer: "lit" } satisfies IgniteConfig,
		}));

		expect(litLoaderSpy).toHaveBeenCalledTimes(1);
		expect(igniteJsxLoaderSpy).not.toHaveBeenCalled();
	});

	it("loads ignite-jsx when config omits renderer", async () => {
		await loadIgniteConfig(async () => ({
			default: { styles: "./styles.css" },
		}));

		expect(igniteJsxLoaderSpy).toHaveBeenCalledTimes(1);
		expect(litLoaderSpy).not.toHaveBeenCalled();
	});

	it("supports configs exported directly without wrapper objects", async () => {
		const config = await loadIgniteConfig(
			async () =>
				({
					styles: "./direct.css",
				}) as IgniteConfig,
		);

		expect(config).toEqual({ styles: "./direct.css" });
		expect(litLoaderSpy).not.toHaveBeenCalled();
	});

	it("returns undefined when loader does not yield a config object", async () => {
		const result = await loadIgniteConfig(
			async () => 42 as unknown as IgniteConfig,
		);

		expect(result).toBeUndefined();
		expect(igniteJsxLoaderSpy).not.toHaveBeenCalled();
		expect(litLoaderSpy).not.toHaveBeenCalled();
	});

	it("ignores unknown renderers", async () => {
		await loadIgniteConfig(async () => ({
			default: { renderer: "unknown" as never },
		}));

		expect(igniteJsxLoaderSpy).not.toHaveBeenCalled();
		expect(litLoaderSpy).not.toHaveBeenCalled();
	});
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineIgniteConfig } from "../../config";
import { createIgniteJsxRenderStrategy } from "../../renderers/jsx/IgniteJsxRenderStrategy";
import { createLitRenderStrategy } from "../../renderers/LitRenderStrategy";
import {
	clearRegisteredRenderStrategiesForTests,
	createAutoDetectRenderStrategy,
	registerRenderStrategy,
	resolveConfiguredRenderStrategy,
} from "../../renderers/resolveConfiguredRenderStrategy";

const CONFIG_SYMBOL = Symbol.for("ignite-element.config");

type ConfigRegistry = typeof globalThis & {
	[CONFIG_SYMBOL]?: unknown;
};

const registry = globalThis as ConfigRegistry;

function resetConfig() {
	delete registry[CONFIG_SYMBOL];
}

describe("resolveConfiguredRenderStrategy", () => {
	beforeEach(() => {
		clearRegisteredRenderStrategiesForTests();
		resetConfig();
		vi.restoreAllMocks();
	});

	afterEach(() => {
		resetConfig();
	});

	it("throws when no strategies are registered", () => {
		expect(() => resolveConfiguredRenderStrategy()).toThrowError(
			"No render strategies have been registered",
		);
	});

	it("returns the auto-detect strategy by default (config-free)", () => {
		// No ignite.config.ts renderer set: the default resolves to the
		// auto-detecting strategy, which routes a lit TemplateResult to lit and
		// everything else to ignite-jsx.
		registerRenderStrategy("ignite-jsx", createIgniteJsxRenderStrategy);
		const strategy = resolveConfiguredRenderStrategy();
		expect(strategy).toBe(createAutoDetectRenderStrategy);
	});

	it("falls back to ignite-jsx when configured renderer is missing", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		registerRenderStrategy("ignite-jsx", createIgniteJsxRenderStrategy);
		defineIgniteConfig({ renderer: "lit" });

		const strategy = resolveConfiguredRenderStrategy();

		expect(strategy).toBe(createIgniteJsxRenderStrategy);
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('Render strategy "lit" is not registered'),
		);
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('Falling back to "ignite-jsx"'),
		);
	});

	it("warns when ignite-jsx is requested but another strategy is the fallback", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		registerRenderStrategy("lit", createLitRenderStrategy);
		defineIgniteConfig({ renderer: "ignite-jsx" });

		const strategy = resolveConfiguredRenderStrategy();

		expect(strategy).toBe(createLitRenderStrategy);
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('Render strategy "ignite-jsx" is not registered'),
		);
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('Falling back to "lit"'),
		);
	});

	it("resolves the configured renderer when registered", () => {
		registerRenderStrategy("ignite-jsx", createIgniteJsxRenderStrategy);
		registerRenderStrategy("lit", createLitRenderStrategy);
		defineIgniteConfig({ renderer: "lit" });

		const strategy = resolveConfiguredRenderStrategy();
		expect(strategy).toBe(createLitRenderStrategy);
	});
});

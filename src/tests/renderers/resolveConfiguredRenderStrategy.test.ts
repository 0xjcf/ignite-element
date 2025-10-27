import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineIgniteConfig } from "../../config";
import { createIgniteJsxRenderStrategy } from "../../renderers/jsx/IgniteJsxRenderStrategy";
import { createLitRenderStrategy } from "../../renderers/LitRenderStrategy";
import {
	clearRegisteredRenderStrategiesForTests,
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

	it("returns the ignite-jsx strategy by default", () => {
		registerRenderStrategy("ignite-jsx", createIgniteJsxRenderStrategy);
		const strategy = resolveConfiguredRenderStrategy();
		expect(strategy).toBe(createIgniteJsxRenderStrategy);
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
	});

	it("resolves the configured renderer when registered", () => {
		registerRenderStrategy("ignite-jsx", createIgniteJsxRenderStrategy);
		registerRenderStrategy("lit", createLitRenderStrategy);
		defineIgniteConfig({ renderer: "lit" });

		const strategy = resolveConfiguredRenderStrategy();
		expect(strategy).toBe(createLitRenderStrategy);
	});
});

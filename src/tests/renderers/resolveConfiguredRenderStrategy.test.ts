import { afterEach, describe, expect, it, vi } from "vitest";
import { defineIgniteConfig, type IgniteConfig } from "../../config";
import { createIgniteJsxRenderStrategy } from "../../renderers/jsx/IgniteJsxRenderStrategy";
import { createLitRenderStrategy } from "../../renderers/LitRenderStrategy";
import { resolveConfiguredRenderStrategy } from "../../renderers/resolveConfiguredRenderStrategy";

const CONFIG_SYMBOL = Symbol.for("ignite-element.config");

function clearConfig(): void {
	const registry = globalThis as typeof globalThis & {
		[CONFIG_SYMBOL]?: IgniteConfig;
	};
	delete registry[CONFIG_SYMBOL];
}

describe("resolveConfiguredRenderStrategy", () => {
	afterEach(() => {
		clearConfig();
		vi.restoreAllMocks();
	});

	it("returns Ignite JSX strategy by default", () => {
		const factory = resolveConfiguredRenderStrategy();
		expect(factory).toBe(createIgniteJsxRenderStrategy);
	});

	it("returns Ignite JSX strategy when configured", () => {
		defineIgniteConfig({ renderer: "ignite-jsx" });
		const factory = resolveConfiguredRenderStrategy();
		expect(factory).toBe(createIgniteJsxRenderStrategy);
	});

	it("warns and falls back to lit on unknown renderer", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		defineIgniteConfig({ renderer: "ignite-jsx" });
		// Directly set an unsupported renderer in the registry to simulate stale config
		const registry = globalThis as typeof globalThis & {
			[CONFIG_SYMBOL]?: IgniteConfig & { renderer?: string };
		};
		registry[CONFIG_SYMBOL] = {
			renderer: "unknown",
		} as unknown as IgniteConfig;

		const factory = resolveConfiguredRenderStrategy();
		expect(factory).toBe(createLitRenderStrategy);
		expect(warnSpy).toHaveBeenCalledWith(
			'[ignite-element] Unknown renderer "unknown" in ignite.config. Falling back to "lit".',
		);
		warnSpy.mockRestore();
	});
});

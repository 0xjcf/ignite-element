import { afterEach, describe, expect, it, vi } from "vitest";
import { createMachine } from "xstate";
import { igniteCore as igniteCoreSourceFree } from "../index";
import { igniteCore } from "../xstate";

const tag = () => `tag-collision-${crypto.randomUUID()}`;

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
});

function sourceCore() {
	return igniteCore({
		source: createMachine({ initial: "idle", states: { idle: {} } }),
		states: () => ({ ready: true }),
	});
}

describe("custom element tag collisions", () => {
	it("warns once for a different component and stays silent for the same definition", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const name = tag();
		const first = () => "first";
		const second = () => "second";
		const third = () => "third";
		const core = sourceCore();

		core(name, first);
		core(name, first);
		expect(warn).not.toHaveBeenCalled();

		core(name, second);
		expect(warn).toHaveBeenCalledOnce();
		expect(warn.mock.calls[0]?.[0]).toContain(name);
		expect(String(warn.mock.calls[0]?.[0])).toContain("already defined");

		core(name, third);
		sourceCore()(name, first);
		expect(warn).toHaveBeenCalledOnce();

		const element = document.createElement(name);
		document.body.append(element);
		expect(element).toBeInstanceOf(
			customElements.get(name) as CustomElementConstructor,
		);
		core.dispose();
	});

	it("warns once for a source-free tag registered by a different definition", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const name = tag();
		const first = () => null;
		const second = () => null;
		const core = igniteCoreSourceFree();

		core(name, first);
		core(name, first);
		expect(warn).not.toHaveBeenCalled();

		core(name, second);
		igniteCoreSourceFree()(name, first);
		expect(warn).toHaveBeenCalledOnce();
		expect(String(warn.mock.calls[0]?.[0])).toContain(name);

		core(name, second);
		expect(warn).toHaveBeenCalledOnce();
	});

	it("does not warn in production", () => {
		vi.stubEnv("NODE_ENV", "production");
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const name = tag();
		const core = sourceCore();
		const first = () => "first";
		core(name, first);
		core(name, () => "other");
		igniteCoreSourceFree()(name, () => null);
		expect(warn).not.toHaveBeenCalled();
		expect(customElements.get(name)).toBeTypeOf("function");
		core.dispose();
	});
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { createEventOrigins } from "../runtime/eventOrigins";

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
});
describe("event producer diagnostics", () => {
	it.each(["native", "effect"] as const)(
		"warns once, regardless of %s being first",
		(first) => {
			const log = vi.spyOn(console, "warn").mockImplementation(() => {});
			const origins = createEventOrigins(),
				owner = {};
			origins.observe(owner, "reset", first);
			origins.observe(owner, "reset", first);
			expect(log).not.toHaveBeenCalled();
			const second = first === "native" ? "effect" : "native";
			origins.observe(owner, "reset", second);
			origins.observe(owner, "reset", second);
			origins.observe(owner, "reset", first);
			expect(log).toHaveBeenCalledExactlyOnceWith(
				'[igniteCore] Event "reset" was observed from both native and effect producers. Keep one production rule per public event.',
			);
			origins.dispose();
			origins.observe({}, "reset", "native");
			origins.observe({}, "reset", "effect");
			expect(log).toHaveBeenCalledTimes(1);
		},
	);
	it("separates owners and cores, and cannot detect an unobserved origin", () => {
		const log = vi.spyOn(console, "warn").mockImplementation(() => {}),
			a = {},
			b = {};
		const first = createEventOrigins(),
			second = createEventOrigins();
		first.observe(a, "reset", "native");
		first.observe(b, "reset", "effect");
		second.observe(a, "reset", "effect");
		for (let i = 0; i < 4; i++) first.observe(a, "reset", "native");
		expect(log).not.toHaveBeenCalled();
		first.dispose();
		second.dispose();
	});
	it("does not let diagnostic infrastructure interrupt delivery", () => {
		vi.spyOn(console, "warn").mockImplementation(() => {
			throw Error("console failed");
		});
		const origins = createEventOrigins(),
			owner = {};
		origins.observe(owner, "reset", "native");
		expect(() => origins.observe(owner, "reset", "effect")).not.toThrow();
		origins.dispose();
	});
	it("is silent in production", () => {
		vi.stubEnv("NODE_ENV", "production");
		const log = vi.spyOn(console, "warn").mockImplementation(() => {});
		const origins = createEventOrigins(),
			owner = {};
		origins.observe(owner, "reset", "effect");
		origins.observe(owner, "reset", "native");
		expect(log).not.toHaveBeenCalled();
		origins.dispose();
	});
});

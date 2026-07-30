import { describe, expect, it, vi } from "vitest";
import counterStore from "./mobxCounterStore";

describe("mobxCounterStore", () => {
	it("starts at zero", () => {
		expect(counterStore().count).toBe(0);
	});

	it("increments and decrements the observable count", () => {
		const counter = counterStore();
		counter.increment();
		counter.increment();
		expect(counter.count).toBe(2);

		counter.decrement();
		expect(counter.count).toBe(1);
	});

	it("isolates state across store instances", () => {
		const a = counterStore();
		const b = counterStore();
		a.increment();
		expect(a.count).toBe(1);
		expect(b.count).toBe(0);
	});

	it("hydrates from injected persistence and keeps disposal source-native", () => {
		const nativeCleanup = vi.fn();
		let observedListener: ((count: number) => void) | undefined;
		const persistence = {
			load: vi.fn(() => 3),
			observe: vi.fn((listener: (count: number) => void) => {
				observedListener = listener;
				return nativeCleanup;
			}),
			save: vi.fn(),
		};
		const createCounter = counterStore as unknown as (options: {
			persistence: typeof persistence;
		}) => {
			count: number;
			increment: () => void;
			dispose: () => void;
		};

		const counter = createCounter({ persistence });

		expect(persistence.load).toHaveBeenCalledTimes(1);
		expect(counter.count).toBe(3);

		observedListener?.(6);
		expect(counter.count).toBe(6);

		counter.increment();
		expect(persistence.save).toHaveBeenLastCalledWith(7);

		counter.dispose();
		counter.dispose();
		expect(nativeCleanup).toHaveBeenCalledTimes(1);
	});
});

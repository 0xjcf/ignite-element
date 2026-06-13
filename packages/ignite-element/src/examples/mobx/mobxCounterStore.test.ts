import { describe, expect, it } from "vitest";
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
});

import { expect } from "vitest";
import type { ComponentContract, GalleryFixture } from "../contract";

export function assertFlagReasons(
	states: Record<string, unknown>,
	contract: ComponentContract,
) {
	for (const flag of contract.flags) {
		expect(flag.name in states).toBe(true);
		expect(flag.reasonField in states).toBe(true);
		const on = states[flag.name];
		const reason = states[flag.reasonField];
		expect(typeof on).toBe("boolean");
		if (on) {
			expect(reason).toBeNull();
		} else {
			expect(reason).toBe(flag.reason);
		}
	}
}

export function assertGalleryCoversStates<
	TInput extends Record<string, unknown>,
>(contract: ComponentContract, gallery: readonly GalleryFixture<TInput>[]) {
	for (const state of contract.states) {
		expect(gallery.some((fixture) => fixture.state === state)).toBe(true);
	}
	for (const fixture of gallery) {
		expect(contract.states).toContain(fixture.state);
	}
}

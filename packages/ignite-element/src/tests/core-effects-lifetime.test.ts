import type { IgniteAdapter } from "@ignite-element/core";
import { describe, expect, it, vi } from "vitest";
import { attachEffects } from "../runtime/effects";

function fixture(release: () => void = () => undefined) {
	let value = 0;
	let listener: ((state: number) => void) | undefined;
	const unsubscribe = vi.fn(release);
	const adapter: IgniteAdapter<number, never> = {
		getSnapshot: () => value,
		send: () => undefined,
		stop: vi.fn(),
		subscribeSnapshots(next) {
			listener = next;
			next(value);
			return { unsubscribe };
		},
	};
	const effects = vi.fn(() => undefined);
	const releaseEffects = attachEffects({
		adapter,
		effects,
		resolveSnapshot: (source) => source.getSnapshot(),
		host: {},
		emit: () => undefined,
	});
	return {
		adapter,
		effects,
		unsubscribe,
		releaseEffects,
		notify(next: number) {
			value = next;
			listener?.(value);
		},
	};
}

describe("effect observation lifetime", () => {
	it("invalidates delivery when subscription setup fails after synchronous callbacks", async () => {
		const reason = new Error("setup failed");
		let listener: ((value: number) => void) | undefined;
		const adapter: IgniteAdapter<number, never> = {
			getSnapshot: () => 1,
			send: () => undefined,
			stop: vi.fn(),
			subscribeSnapshots(next) {
				listener = next;
				next(0);
				next(1);
				throw reason;
			},
		};
		const effects = vi.fn(() => undefined);
		let failed = false;
		try {
			attachEffects({
				adapter,
				effects,
				resolveSnapshot: (source) => source.getSnapshot(),
				host: {},
				emit: () => undefined,
			});
		} catch (error) {
			failed = true;
			expect(error).toBe(reason);
		}
		expect(failed).toBe(true);
		listener?.(2);
		await Promise.resolve();
		expect(effects).not.toHaveBeenCalled();
		expect(adapter.stop).not.toHaveBeenCalled();
	});

	it("seeds synchronous replay and defers the effect to a microtask", async () => {
		const source = fixture();
		expect(source.effects).not.toHaveBeenCalled();
		source.notify(1);
		expect(source.effects).not.toHaveBeenCalled();
		await Promise.resolve();
		expect(source.effects).toHaveBeenCalledWith(
			expect.objectContaining({ snapshot: 1, prevSnapshot: 0 }),
		);
		source.releaseEffects();
	});

	it("invalidates already queued delivery before releasing the observation", async () => {
		const source = fixture();
		source.notify(1);
		source.releaseEffects();
		await Promise.resolve();
		expect(source.effects).not.toHaveBeenCalled();
		expect(source.adapter.stop).not.toHaveBeenCalled();
	});

	it("ignores late callbacks and releases independently exactly once", async () => {
		const source = fixture();
		source.releaseEffects();
		source.notify(1);
		source.releaseEffects();
		await Promise.resolve();
		expect(source.effects).not.toHaveBeenCalled();
		expect(source.unsubscribe).toHaveBeenCalledTimes(1);
	});

	it.each([undefined, null, new Error("release failed")])(
		"preserves the exact cleanup value and remains released after throwing (%s)",
		async (reason) => {
			const source = fixture(() => {
				throw reason;
			});
			source.notify(1);
			let threw = false;
			try {
				source.releaseEffects();
			} catch (error) {
				threw = true;
				expect(error).toBe(reason);
			}
			expect(threw).toBe(true);
			expect(() => source.releaseEffects()).not.toThrow();
			await Promise.resolve();
			expect(source.effects).not.toHaveBeenCalled();
			expect(source.unsubscribe).toHaveBeenCalledTimes(1);
		},
	);
});

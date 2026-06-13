import type { IgniteAdapter } from "@ignite-element/core";
import { describe, expect, expectTypeOf, it } from "vitest";

/**
 * E1 — the optional `subscribeEvents()` emitted-event seam on IgniteAdapter.
 * Pure contract coverage: the seam is optional, its listener is typed from the
 * `Emitted` param, and existing two-type-arg adapters are unaffected.
 */
describe("IgniteAdapter optional subscribeEvents() emitted-event seam", () => {
	it("accepts an adapter that emits typed events", () => {
		type Emitted = { type: "ping" } | { type: "pong"; n: number };

		const adapter: IgniteAdapter<{ v: number }, { type: string }, Emitted> = {
			subscribeSnapshots: () => ({ unsubscribe() {} }),
			subscribeEvents: (listener) => {
				expectTypeOf(listener).parameter(0).toEqualTypeOf<Emitted>();
				listener({ type: "pong", n: 1 });
				return { unsubscribe() {} };
			},
			send: () => {},
			getSnapshot: () => ({ v: 0 }),
			stop: () => {},
		};

		const received: Emitted[] = [];
		const subscription = adapter.subscribeEvents?.((event) =>
			received.push(event),
		);
		expectTypeOf(subscription).toEqualTypeOf<
			{ unsubscribe: () => void } | undefined
		>();
		subscription?.unsubscribe();

		expect(received).toEqual([{ type: "pong", n: 1 }]);
	});

	it("leaves subscribeEvents optional — a two-type-arg adapter omits it", () => {
		const adapter: IgniteAdapter<{ v: number }, { type: string }> = {
			subscribeSnapshots: () => ({ unsubscribe() {} }),
			send: () => {},
			getSnapshot: () => ({ v: 0 }),
			stop: () => {},
		};

		expect(adapter.subscribeEvents).toBeUndefined();
	});
});

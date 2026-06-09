import type { IgniteAdapter } from "@ignite-element/core";
import { describe, expect, expectTypeOf, it } from "vitest";

/**
 * E1 — the optional `stream()` emitted-event seam on IgniteAdapter.
 * Pure contract coverage: the seam is optional, its listener is typed from the
 * `Emitted` param, and existing two-type-arg adapters are unaffected.
 */
describe("IgniteAdapter optional stream() emitted-event seam", () => {
	it("accepts an adapter that streams typed emitted events", () => {
		type Emitted = { type: "ping" } | { type: "pong"; n: number };

		const adapter: IgniteAdapter<{ v: number }, { type: string }, Emitted> = {
			subscribe: () => ({ unsubscribe() {} }),
			stream: (listener) => {
				expectTypeOf(listener).parameter(0).toEqualTypeOf<Emitted>();
				listener({ type: "pong", n: 1 });
				return { unsubscribe() {} };
			},
			send: () => {},
			getState: () => ({ v: 0 }),
			stop: () => {},
		};

		const received: Emitted[] = [];
		const subscription = adapter.stream?.((event) => received.push(event));
		expectTypeOf(subscription).toEqualTypeOf<
			{ unsubscribe: () => void } | undefined
		>();
		subscription?.unsubscribe();

		expect(received).toEqual([{ type: "pong", n: 1 }]);
	});

	it("leaves stream optional — a two-type-arg adapter omits it", () => {
		const adapter: IgniteAdapter<{ v: number }, { type: string }> = {
			subscribe: () => ({ unsubscribe() {} }),
			send: () => {},
			getState: () => ({ v: 0 }),
			stop: () => {},
		};

		expect(adapter.stream).toBeUndefined();
	});
});

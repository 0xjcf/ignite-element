import { igniteCore as mobxCore } from "ignite-element/mobx";
import { igniteCore as reduxCore } from "ignite-element/redux";
import { describe, expect, it } from "vitest";
import { exerciseFactoryLifetime } from "./fixtures/factoryEntrypoints";

for (const kind of ["mobx", "redux"] as const) {
	describe(`${kind} dedicated entrypoint`, () => {
		it.each([false, true])(
			"preserves acquisition, observation and terminal disposal (shared=%s)",
			async (shared) => {
				const result = await exerciseFactoryLifetime(kind, shared);
				expect(result).toMatchObject({
					beforeRegistration: shared ? 1 : 0,
					beforeConnection: shared ? 1 : 0,
					connected: shared ? [true] : [true, true],
					afterCommand: shared ? ["1", "1"] : ["1", "0"],
					afterMove: {
						calls: shared ? 1 : 2,
						counts: shared ? ["1", "1"] : ["1", "0"],
					},
					afterReconnect: {
						calls: shared ? 1 : 3,
						counts: shared ? ["1", "1"] : ["0", "0"],
					},
					released: true,
					cleared: true,
					staleRejected: true,
					afterDisposedConnection: { calls: shared ? 1 : 3, counts: ["", ""] },
					nativeStillUsable: true,
				});
				if (shared) expect(result.detachedObservers[0]).toBeGreaterThan(0);
				else {
					expect(result.detachedObservers[0]).toBe(0);
					expect(result.detachedObservers[1]).toBeGreaterThan(0);
				}
			},
		);
	});
}

it("still rejects invalid MobX factory results on acquisition", () => {
	const core = mobxCore({ source: () => ({ count: 0 }) });
	try {
		expect(() => core.get("states")).toThrow(/must return a MobX observable/);
	} finally {
		core.dispose();
	}
});
it("still rejects unsupported Redux sources", () => {
	expect(() =>
		Reflect.apply(reduxCore, undefined, [{ source: { count: 0 } }]),
	).toThrow(/Unsupported Redux source/);
});

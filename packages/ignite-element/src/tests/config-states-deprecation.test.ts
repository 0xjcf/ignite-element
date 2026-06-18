import { describe, expect, it } from "vitest";
import counterStore from "../examples/adapters/redux/src/js/reduxCounterStore";
import { igniteCore } from "../IgniteCore";
import type { ReduxInstanceConfig } from "../igniteCore/types";
import type { InferStateAndEvent } from "../utils/igniteRedux";

// The `states` projection alias was removed at stable v3 (T7). These
// assertions pin the removal so the alias cannot silently return.
describe("removed `states` projection alias", () => {
	it("rejects a states-only config at the type level and ignores it at runtime", () => {
		const store = counterStore();
		type StoreState = InferStateAndEvent<typeof store>["State"];
		const statesCallback = (snapshot: StoreState) => ({
			count: snapshot.counter.count,
		});

		// Type-level: `states` is no longer an accepted config key.
		const rejected: ReduxInstanceConfig<typeof store> = {
			adapter: "redux",
			source: store,
			// @ts-expect-error -- `states` was removed at stable v3; use `view`.
			states: statesCallback,
		};
		void rejected;

		// Runtime: a leftover `states` key no longer drives the projection.
		const register = igniteCore({
			adapter: "redux",
			source: store,
			...({ states: statesCallback } as Record<never, never>),
		});
		expect(register.getView()).toEqual({});
	});

	it("projects via the canonical `view`", () => {
		const store = counterStore();
		type StoreState = InferStateAndEvent<typeof store>["State"];

		const register = igniteCore({
			adapter: "redux",
			source: store,
			view: ({ snapshot }: { snapshot: StoreState }) => ({
				count: snapshot.counter.count,
			}),
		} satisfies ReduxInstanceConfig<typeof store>);

		expect(register.getView()).toEqual({ count: 0 });
	});
});

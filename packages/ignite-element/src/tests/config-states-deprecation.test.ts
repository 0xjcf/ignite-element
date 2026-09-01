import { describe, expect, it } from "vitest";
import counterStore from "./fixtures/reduxCounterStore";
import { igniteCore } from "../IgniteCore";
import type { ReduxInstanceConfig } from "../igniteCore/types";
import type { InferStateAndEvent } from "../utils/igniteRedux";

describe("removed `view` projection config", () => {
	it("rejects view at the type level and throws migration guidance at runtime", () => {
		const store = counterStore();
		type StoreState = InferStateAndEvent<typeof store>["State"];
		const statesCallback = (snapshot: StoreState) => ({
			count: snapshot.counter.count,
		});

		const rejected = () => {
			const config: ReduxInstanceConfig<typeof store> = {
				adapter: "redux",
				source: store,
				// @ts-expect-error -- config view was removed; use states.
				view: statesCallback,
			};
			return config;
		};
		void rejected;

		expect(() =>
			igniteCore({
				adapter: "redux",
				source: store,
				...({ view: statesCallback } as Record<never, never>),
			}),
		).toThrow(/config.*view.*removed.*use.*states/i);
	});

	it("projects via the canonical `states`", () => {
		const store = counterStore();
		type StoreState = InferStateAndEvent<typeof store>["State"];

		const register = igniteCore({
			adapter: "redux",
			source: store,
			states: (snapshot: StoreState) => ({
				count: snapshot.counter.count,
			}),
		} satisfies ReduxInstanceConfig<typeof store>);

		expect(register.getStates()).toEqual({ count: 0 });
	});
});

import { afterEach, describe, expect, it, vi } from "vitest";
import counterStore from "../examples/redux/src/js/reduxCounterStore";
import { igniteCore } from "../IgniteCore";
import type { ReduxInstanceConfig } from "../igniteCore/types";
import type { InferStateAndEvent } from "../utils/igniteRedux";

describe("deprecated `states` projection alias", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("still projects via states and warns once per process (dev only)", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const store = counterStore();
		type StoreState = InferStateAndEvent<typeof store>["State"];

		const register = igniteCore({
			adapter: "redux",
			source: store,
			states: (snapshot: StoreState) => ({ count: snapshot.counter.count }),
		} satisfies ReduxInstanceConfig<typeof store>);

		// The deprecated `states` callback still drives the projection (getView).
		expect(register.getView()).toEqual({ count: 0 });

		const statesWarnings = warn.mock.calls.filter((call) =>
			String(call[0]).includes("`states` config option is deprecated"),
		);
		expect(statesWarnings).toHaveLength(1);
		expect(statesWarnings[0][0]).toContain("Use `view`");

		// A second states-only config does not warn again (once per process).
		igniteCore({
			adapter: "redux",
			source: counterStore(),
			states: (snapshot: StoreState) => ({ count: snapshot.counter.count }),
		} satisfies ReduxInstanceConfig<typeof store>);

		const afterSecond = warn.mock.calls.filter((call) =>
			String(call[0]).includes("`states` config option is deprecated"),
		);
		expect(afterSecond).toHaveLength(1);
	});

	it("does not warn when the canonical `view` is used", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const store = counterStore();
		type StoreState = InferStateAndEvent<typeof store>["State"];

		igniteCore({
			adapter: "redux",
			source: store,
			view: ({ snapshot }: { snapshot: StoreState }) => ({
				count: snapshot.counter.count,
			}),
		} satisfies ReduxInstanceConfig<typeof store>);

		expect(
			warn.mock.calls.some((call) =>
				String(call[0]).includes("`states` config option is deprecated"),
			),
		).toBe(false);
	});
});

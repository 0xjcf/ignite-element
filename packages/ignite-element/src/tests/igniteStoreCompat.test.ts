import {
	createMobXAdapter,
	createReduxAdapter,
	isMobxObservable,
	isReduxSlice,
	isReduxStore,
} from "ignite-store";
import { igniteCore as igniteCoreMobx } from "ignite-store/mobx";
import { igniteCore as igniteCoreRedux } from "ignite-store/redux";
import { describe, expect, it } from "vitest";

describe("ignite-store compatibility package", () => {
	it("re-exports the adapter helpers and entrypoints from ignite-adapters", () => {
		expect(createReduxAdapter).toBeTypeOf("function");
		expect(createMobXAdapter).toBeTypeOf("function");
		expect(isReduxStore).toBeTypeOf("function");
		expect(isReduxSlice).toBeTypeOf("function");
		expect(isMobxObservable).toBeTypeOf("function");
		expect(igniteCoreRedux).toBeTypeOf("function");
		expect(igniteCoreMobx).toBeTypeOf("function");
	});
});

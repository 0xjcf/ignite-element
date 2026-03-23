import type { EnhancedStore } from "@reduxjs/toolkit";
import {
	createMobXAdapter,
	createReduxAdapter,
	type MobxConfig,
	type ReduxBlueprintConfig,
} from "ignite-store";
import { igniteCore as igniteCoreMobx } from "ignite-store/mobx";
import { igniteCore as igniteCoreRedux } from "ignite-store/redux";
import { describe, expectTypeOf, it } from "vitest";

describe("ignite-store compatibility types", () => {
	it("preserves the public type surface through the compatibility package", () => {
		type CompatReduxConfig = ReduxBlueprintConfig<() => EnhancedStore>;
		type CompatMobxConfig = MobxConfig<{ count: number }>;

		expectTypeOf(createReduxAdapter).toBeFunction();
		expectTypeOf(createMobXAdapter).toBeFunction();
		expectTypeOf(igniteCoreRedux).toBeFunction();
		expectTypeOf(igniteCoreMobx).toBeFunction();
		expectTypeOf<CompatReduxConfig>().toEqualTypeOf<CompatReduxConfig>();
		expectTypeOf<CompatMobxConfig>().toEqualTypeOf<CompatMobxConfig>();
	});
});

import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import type { IgniteAdapter } from "ignite-core";
import { StateScope } from "ignite-core";
import type { ReduxSliceCommandActor, ReduxStoreCommandActor } from "../types";
import type { InferStateAndEvent } from "../utils/igniteRedux";
type AdapterFactory<State, Event, Snapshot, Actor> = (() => IgniteAdapter<State, Event>) & {
    scope: StateScope;
    resolveStateSnapshot: (adapter: IgniteAdapter<State, Event>) => Snapshot;
    resolveCommandActor: (adapter: IgniteAdapter<State, Event>) => Actor;
};
export default function createReduxAdapter<Source extends Slice>(source: Source): AdapterFactory<InferStateAndEvent<Source>["State"], InferStateAndEvent<Source>["Event"], InferStateAndEvent<Source>["State"], ReduxSliceCommandActor<Source>>;
export default function createReduxAdapter<Source extends () => EnhancedStore>(source: Source): AdapterFactory<InferStateAndEvent<Source>["State"], InferStateAndEvent<Source>["Event"], InferStateAndEvent<Source>["State"], ReduxStoreCommandActor<ReturnType<Source>>>;
export default function createReduxAdapter<Source extends EnhancedStore>(source: Source): AdapterFactory<InferStateAndEvent<Source>["State"], InferStateAndEvent<Source>["Event"], InferStateAndEvent<Source>["State"], ReduxStoreCommandActor<Source>>;
export {};
//# sourceMappingURL=ReduxAdapter.d.ts.map
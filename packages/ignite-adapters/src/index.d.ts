export { default as createMobXAdapter } from "./adapters/MobxAdapter";
export { default as createReduxAdapter } from "./adapters/ReduxAdapter";
export { igniteCoreMobx } from "./igniteCore/mobx";
export { igniteCoreRedux } from "./igniteCore/redux";
export type { MobxConfig, MobxEvent, ReduxBlueprintConfig, ReduxBlueprintSource, ReduxCommandActorFor, ReduxInstanceConfig, ReduxInstanceSource, ReduxSliceCommandActor, ReduxStoreCommandActor, } from "./types";
export { isReduxSlice, isReduxStore } from "./utils/adapterGuards";
export type { InferStateAndEvent } from "./utils/igniteRedux";
export { isMobxObservable } from "./utils/mobxGuards";
//# sourceMappingURL=index.d.ts.map
// src/index.ts

export { default as igniteElementFactory } from "./IgniteElmentFactory";

export { default as createMobXAdapter } from "./adapters/MobXAdapter";
export { default as createXStateAdapter } from "./adapters/XStateAdapter";
export { default as createReduxAdapter } from "./adapters/ReduxAdapter";

export { default as MobXCounterStore } from "./examples/mobx/mobxCounterStore";
export { default as XStateCounterMachine } from "./examples/xstate/xstateCounterMachine";
export {
  default as ReduxCounterStore,
  increment,
  decrement,
} from "./examples/redux/reduxCounterStore";

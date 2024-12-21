import {
  ActionCreatorWithoutPayload,
  ActionCreatorWithPayload,
  EnhancedStore,
} from "@reduxjs/toolkit";

// Infer RootState from the Store
export type InferRootState<Store extends EnhancedStore> = ReturnType<
  Store["getState"]
>;

export type InferEvent<
  Events extends Record<
    string,
    | ActionCreatorWithoutPayload<string>
    | ActionCreatorWithPayload<string, string>
  >
> = {
  [K in keyof Events]: Events[K] extends ActionCreatorWithoutPayload<infer Type>
    ? { type: Type }
    : Events[K] extends ActionCreatorWithPayload<infer Payload, infer Type>
    ? { type: Type; payload?: Payload }
    : never;
}[keyof Events];

// Utility Types
export type InferStateAndEvent<
  StoreCreator extends (...args: unknown[]) => EnhancedStore,
  Actions extends Record<
    string,
    | ActionCreatorWithoutPayload<string>
    | ActionCreatorWithPayload<string, string>
  >
> = {
  State: ReturnType<ReturnType<StoreCreator>["getState"]>;
  Event: InferEvent<Actions>;
};

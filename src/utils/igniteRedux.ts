import {
  ActionCreatorWithoutPayload,
  ActionCreatorWithPayload,
  EnhancedStore,
  Slice,
} from "@reduxjs/toolkit";

// Infer RootState from Slice or Store
export type InferRootState<
  Source extends Slice | EnhancedStore
> = Source extends Slice
  ? { [K in Source["name"]]: ReturnType<Source["reducer"]> } // Infer from Slice reducer
  : Source extends EnhancedStore
  ? ReturnType<Source["getState"]> // Infer from Store getState
  : never; // Default to never for invalid cases

// Infer Events from Action Creators
export type InferEvent<
  Actions extends Record<
    string,
    | ActionCreatorWithoutPayload<string>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | ActionCreatorWithPayload<any, string> // Using `any` to dynamically infer payloads for Redux actions
  >
> = {
  [K in keyof Actions]: Actions[K] extends ActionCreatorWithoutPayload<infer Type>
    ? { type: Type } // Action with no payload
    : Actions[K] extends ActionCreatorWithPayload<infer Payload, infer Type>
    ? { type: Type } & (Payload extends undefined ? unknown : { payload: Payload }) // Match defined payload type
    : never;
}[keyof Actions];

// Infer State and Events for Slices or Stores
export type InferStateAndEvent<
  Source extends Slice | (() => EnhancedStore), // Accept Slice or Store
  Actions extends Record<
    string,
    | ActionCreatorWithoutPayload<string>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | ActionCreatorWithPayload<any, string> // Using `any` to handle dynamic payload inference for Redux
  > = Source extends Slice
    ? Source["actions"] // Auto-infer actions for Slice
    : Record<string, never> // Require explicit actions for Store
> = Source extends Slice
  ? {
      State: InferRootState<Source>; // Infer state from Slice
      Event: InferEvent<Source["actions"]>; // Use actions for Event inference
    }
  : Source extends () => EnhancedStore
  ? {
      State: ReturnType<ReturnType<Source>["getState"]>; // Infer state from Store
      Event: InferEvent<Actions>; // Infer events from explicit actions
    }
  : never; // Default to never

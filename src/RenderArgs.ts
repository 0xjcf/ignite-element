import { AnyStateMachine, StateFrom, EventFrom } from "xstate";
import {
  EnhancedStore,
  Slice,
  ActionCreatorWithoutPayload,
  ActionCreatorWithPayload,
} from "@reduxjs/toolkit";
import { FunctionKeys } from "./adapters/MobxAdapter";
import { InferStateAndEvent, InferEvent } from "./utils/igniteRedux";

/**
 * RenderArgs<Store, Actions>:
 *  - If Store is an XState machine, we ignore Actions and return { state, send } for XState.
 *  - If Store is a Redux Slice, we ignore Actions because a slice already includes actions.
 *  - If Store is a Redux Store (EnhancedStore) AND we have an Actions object,
 *    we combine them so that send(...) is typed from your actions.
 *  - If Store is a MobX store factory, we return { state, send } for the function-based approach.
 *  - Otherwise, fallback to never.
 *
 * The second generic <A> is optional for scenarios where you do NOT have an extra 'actions' object
 * (e.g., XState, Redux Slice, MobX).
 */
export type RenderArgs<Store, A = unknown> =
  // 1) XState Machine
  Store extends AnyStateMachine
    ? {
        state: StateFrom<Store>;
        send: (event: EventFrom<Store>) => void;
      }
    : // 2) Redux Slice
    Store extends Slice
    ? {
        state: InferStateAndEvent<Store>["State"];
        send: (action: InferStateAndEvent<Store>["Event"]) => void;
      }
    : // 3) Redux Store + Actions
    Store extends () => EnhancedStore
    ? A extends Record<
        string,
        | ActionCreatorWithoutPayload<string>
        | ActionCreatorWithPayload<any, string> // eslint-disable-line @typescript-eslint/no-explicit-any
      >
      ? {
          state: InferStateAndEvent<Store>["State"];
          send: (action: InferEvent<A>) => void;
        }
      : // If you pass no actions, fallback to a broad any
        {
          state: InferStateAndEvent<Store>["State"];
          send: (action: string) => void;
        }
    : // 4) MobX: store factory returning an object
    Store extends () => Record<string, unknown>
    ? {
        state: ReturnType<Store>;
        send: (event: { type: FunctionKeys<ReturnType<Store>> }) => void;
      }
    : // 5) Fallback
      never;

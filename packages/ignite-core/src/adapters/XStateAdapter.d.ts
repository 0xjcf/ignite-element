import type { AnyStateMachine, EventFrom, StateFrom } from "xstate";
import { createActor } from "xstate";
import type IgniteAdapter from "../IgniteAdapter";
import { StateScope } from "../IgniteAdapter";
export type ExtendedState<Machine extends AnyStateMachine> = StateFrom<Machine> & StateFrom<Machine>["context"] & {
    context: StateFrom<Machine>["context"];
};
export type XStateActorInstance<Machine extends AnyStateMachine> = ReturnType<typeof createActor<Machine>>;
export type XStateSnapshot<Machine extends AnyStateMachine> = ExtendedState<Machine>;
export type XStateCommandActor<Machine extends AnyStateMachine> = {
    send: (event: EventFrom<Machine>) => void;
    readonly state: ExtendedState<Machine>;
};
export type XStateMachineActor<Machine extends AnyStateMachine> = XStateActorInstance<Machine>;
type XStateAdapterFactory<Machine extends AnyStateMachine> = (() => IgniteAdapter<ExtendedState<Machine>, EventFrom<Machine>>) & {
    scope: StateScope;
    resolveStateSnapshot: (adapter: IgniteAdapter<ExtendedState<Machine>, EventFrom<Machine>>) => StateFrom<Machine>;
    resolveCommandActor: (adapter: IgniteAdapter<ExtendedState<Machine>, EventFrom<Machine>>) => XStateCommandActor<Machine>;
};
export default function createXStateAdapter<Machine extends AnyStateMachine>(source: Machine | XStateActorInstance<Machine>): XStateAdapterFactory<Machine>;
export {};
//# sourceMappingURL=XStateAdapter.d.ts.map
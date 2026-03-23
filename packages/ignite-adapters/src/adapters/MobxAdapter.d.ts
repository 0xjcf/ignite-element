import type { IgniteAdapter } from "ignite-core";
import { StateScope } from "ignite-core";
export type FunctionKeys<StateType> = {
    [Key in keyof StateType]: StateType[Key] extends (...args: infer _Params) => infer _Result ? Key : never;
}[keyof StateType];
type MethodArgs<State extends object, Key extends FunctionKeys<State>> = State[Key] extends (...args: infer Params) => infer _Result ? Params : never;
export type MobxEvent<State extends object> = {
    [Key in FunctionKeys<State>]: MethodArgs<State, Key> extends [] ? {
        type: Key;
        args?: MethodArgs<State, Key>;
    } : {
        type: Key;
        args: MethodArgs<State, Key>;
    };
}[FunctionKeys<State>];
type MobxAdapterFactory<State extends object> = (() => IgniteAdapter<State, MobxEvent<State>>) & {
    scope: StateScope;
    resolveStateSnapshot: (adapter: IgniteAdapter<State, MobxEvent<State>>) => State;
    resolveCommandActor: (adapter: IgniteAdapter<State, MobxEvent<State>>) => State;
};
export default function createMobXAdapter<State extends object>(source: (() => State) | State): MobxAdapterFactory<State>;
export {};
//# sourceMappingURL=MobxAdapter.d.ts.map
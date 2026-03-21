import type { AnyStateMachine } from "xstate";
export interface XStateActorLike {
    start?: () => unknown;
    stop?: () => unknown;
    send: (...args: unknown[]) => unknown;
    subscribe: (...args: unknown[]) => unknown;
    getSnapshot: () => unknown;
}
export declare function isXStateMachine(source: unknown): source is AnyStateMachine;
export declare function isXStateActor(source: unknown): source is XStateActorLike;
export declare function isFunction<T extends (...args: unknown[]) => unknown>(value: unknown): value is T;
//# sourceMappingURL=adapterGuards.d.ts.map
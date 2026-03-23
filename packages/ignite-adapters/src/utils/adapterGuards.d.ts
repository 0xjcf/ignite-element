import type { EnhancedStore, Slice } from "@reduxjs/toolkit";
import type { AnyStateMachine } from "xstate";
export declare function isReduxStore(source: unknown): source is EnhancedStore;
export declare function isReduxSlice(source: unknown): source is Slice;
export interface XStateActorLike {
    start?: () => unknown;
    stop?: () => unknown;
    send: (...args: unknown[]) => unknown;
    subscribe: (...args: unknown[]) => unknown;
    getSnapshot: () => unknown;
}
export declare function isXStateMachine(source: unknown): source is AnyStateMachine;
export declare function isXStateActor(source: unknown): source is XStateActorLike;
//# sourceMappingURL=adapterGuards.d.ts.map
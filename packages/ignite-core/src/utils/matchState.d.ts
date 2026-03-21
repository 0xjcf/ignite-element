export type MatchStateSnapshot = {
    matches: (value: string) => boolean;
};
export type MatchStateCases<T> = Record<string, T>;
export declare function matchState<Cases extends MatchStateCases<unknown>, Fallback>(snapshot: MatchStateSnapshot, cases: Cases, fallback: Fallback): Cases[keyof Cases] | Fallback;
//# sourceMappingURL=matchState.d.ts.map
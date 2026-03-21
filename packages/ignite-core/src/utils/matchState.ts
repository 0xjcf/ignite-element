export type MatchStateSnapshot = {
	matches: (value: string) => boolean;
};

export type MatchStateCases<T> = Record<string, T>;

export function matchState<Cases extends MatchStateCases<unknown>, Fallback>(
	snapshot: MatchStateSnapshot,
	cases: Cases,
	fallback: Fallback,
): Cases[keyof Cases] | Fallback {
	for (const [key, value] of Object.entries(cases)) {
		if (snapshot.matches(key)) {
			return value as Cases[keyof Cases];
		}
	}

	return fallback;
}

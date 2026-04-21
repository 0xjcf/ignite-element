export type MatchStateSnapshot<StateValue extends string = string> = {
	matches: (value: StateValue) => boolean;
};

export type MatchStateCases<T> = Record<string, T>;

export function matchState<Cases extends MatchStateCases<unknown>, Fallback>(
	snapshot: MatchStateSnapshot<Extract<keyof Cases, string>>,
	cases: Cases,
	fallback: Fallback,
): Cases[keyof Cases] | Fallback {
	for (const [key, value] of Object.entries(cases)) {
		const state = key as Extract<keyof Cases, string>;
		if (snapshot.matches(state)) {
			return value as Cases[keyof Cases];
		}
	}

	return fallback;
}

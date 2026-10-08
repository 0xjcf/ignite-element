import { assign, emit, setup } from "xstate";

export type FilterBarInput = {
	label?: string;
	query?: string;
	filters?: readonly string[];
	active?: readonly string[];
};

export type FilterBarContext = {
	label: string;
	query: string;
	filters: string[];
	active: string[];
};

export type FilterBarEvent =
	| { type: "SET_LABEL"; label: string }
	| { type: "SET_QUERY"; query: string }
	| { type: "SET_FILTERS"; filters: string[] }
	| { type: "SET_ACTIVE"; active: string[] }
	| { type: "TOGGLE"; id: string }
	| { type: "CLEAR" };

export type FilterBarEmitted =
	| { type: "change"; query: string; active: string[] }
	| { type: "clear" };

/** The query is the exact draft. Spaces stay, and they still count as a filter. */
export function exactQuery(value: string | null): string {
	return value ?? "";
}

/** Trim, drop blanks, and keep the first copy of a repeated name. */
export function parseFilters(value: string | null): string[] {
	if (value === null) return [];
	const seen = new Set<string>();
	const filters: string[] = [];
	for (const part of value.split("\n")) {
		const name = part.trim();
		if (name.length === 0 || seen.has(name)) continue;
		seen.add(name);
		filters.push(name);
	}
	return filters;
}

export function activeWithin(
	filters: readonly string[],
	active: readonly string[],
): string[] {
	return active.filter((name) => filters.includes(name));
}

export function toggled(active: readonly string[], id: string): string[] {
	return active.includes(id)
		? active.filter((name) => name !== id)
		: [...active, id];
}

/**
 * The host owns the list. This machine only stores the query and the active names.
 * Clear removes both. It does not decide which rows match.
 */
export const filterBarMachine = setup({
	types: {
		context: {} as FilterBarContext,
		events: {} as FilterBarEvent,
		emitted: {} as FilterBarEmitted,
		input: {} as FilterBarInput,
	},
	actions: {
		applyLabel: assign({
			label: ({ event }) =>
				event.type === "SET_LABEL" ? event.label : "Filter",
		}),
		applyQuery: assign({
			query: ({ event }) =>
				event.type === "SET_QUERY" ? exactQuery(event.query) : "",
		}),
		applyFilters: assign({
			filters: ({ event }) =>
				event.type === "SET_FILTERS" ? event.filters : [],
			active: ({ context, event }) =>
				event.type === "SET_FILTERS"
					? activeWithin(event.filters, context.active)
					: context.active,
		}),
		applyActive: assign({
			active: ({ context, event }) =>
				event.type === "SET_ACTIVE"
					? activeWithin(context.filters, event.active)
					: context.active,
		}),
		applyToggle: assign({
			active: ({ context, event }) =>
				event.type === "TOGGLE"
					? toggled(context.active, event.id)
					: context.active,
		}),
		clearCriteria: assign({
			query: () => "",
			active: () => [],
		}),
		announceChange: emit(({ context }) => ({
			type: "change" as const,
			query: context.query,
			active: [...context.active],
		})),
		announceClear: emit(() => ({ type: "clear" as const })),
	},
	guards: {
		filtered: ({ context }) =>
			context.query.length > 0 || context.active.length > 0,
		idle: ({ context }) =>
			context.query.length === 0 && context.active.length === 0,
		knownFilter: ({ context, event }) =>
			event.type === "TOGGLE" && context.filters.includes(event.id),
	},
}).createMachine({
	id: "filter-bar",
	initial: "idle",
	context: ({ input }) => {
		const filters = input?.filters ? [...input.filters] : [];
		return {
			label: input?.label?.trim() ? input.label : "Filter",
			query: exactQuery(input?.query ?? ""),
			filters,
			active: activeWithin(filters, input?.active ? [...input.active] : []),
		};
	},
	on: {
		SET_LABEL: { actions: "applyLabel" },
		SET_QUERY: { actions: ["applyQuery", "announceChange"] },
		SET_FILTERS: { actions: "applyFilters" },
		SET_ACTIVE: { actions: ["applyActive", "announceChange"] },
		TOGGLE: {
			guard: "knownFilter",
			actions: ["applyToggle", "announceChange"],
		},
		CLEAR: {
			guard: "filtered",
			actions: ["clearCriteria", "announceClear"],
		},
	},
	states: {
		idle: {
			always: { guard: "filtered", target: "filtered" },
		},
		filtered: {
			always: { guard: "idle", target: "idle" },
		},
	},
});

import { assign, emit, setup } from "xstate";
import { createInstanceId } from "../live-status/live-status.source";

export type FilterBarInput = {
	label?: string;
	query?: string;
	filters?: readonly string[];
	active?: readonly string[];
};

export type FilterBarContext = {
	instanceId: string;
	label: string;
	query: string;
	filters: string[];
	active: string[];
	warnings: string[];
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
export function normalizeFilterNames(names: readonly string[]): string[] {
	const seen = new Set<string>();
	const next: string[] = [];
	for (const name of names) {
		const trimmed = name.trim();
		if (trimmed.length === 0 || seen.has(trimmed)) continue;
		seen.add(trimmed);
		next.push(trimmed);
	}
	return next;
}

/** Trim, drop blanks, and keep the first copy of a repeated name. */
export function parseFilters(value: string | null): string[] {
	if (value === null) return [];
	return normalizeFilterNames(value.split("\n"));
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

/** Names that were dropped, plus the values that are still valid. */
export function unknownFilterWarning(
	dropped: readonly string[],
	valid: readonly string[],
): string[] {
	if (dropped.length === 0) return [];
	const names = dropped.map((name) => `"${name}"`).join(", ");
	const list = valid.length > 0 ? valid.join(", ") : "(none)";
	return [`Unknown filter ${names}. Valid filters: ${list}.`];
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
		applyFilters: assign(({ context, event }) => {
			if (event.type !== "SET_FILTERS") return {};
			const dropped = context.active.filter(
				(name) => !event.filters.includes(name),
			);
			return {
				filters: event.filters,
				active: activeWithin(event.filters, context.active),
				warnings: unknownFilterWarning(dropped, event.filters),
			};
		}),
		applyActive: assign(({ context, event }) => {
			if (event.type !== "SET_ACTIVE") return {};
			const dropped = event.active.filter(
				(name) => !context.filters.includes(name),
			);
			return {
				active: activeWithin(context.filters, event.active),
				warnings: unknownFilterWarning(dropped, context.filters),
			};
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
		clearWarnings: assign({
			warnings: () => [],
		}),
		warnToggle: assign(({ context, event }) => {
			if (event.type !== "TOGGLE") return {};
			return {
				warnings: unknownFilterWarning([event.id], context.filters),
			};
		}),
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
		const filters = normalizeFilterNames(input?.filters ?? []);
		return {
			instanceId: createInstanceId("filters"),
			label: input?.label?.trim() ? input.label : "Filter",
			query: exactQuery(input?.query ?? ""),
			filters,
			active: activeWithin(filters, normalizeFilterNames(input?.active ?? [])),
			warnings: [],
		};
	},
	on: {
		SET_LABEL: { actions: "applyLabel" },
		SET_QUERY: { actions: ["applyQuery", "announceChange"] },
		SET_FILTERS: { actions: "applyFilters" },
		SET_ACTIVE: { actions: ["applyActive", "announceChange"] },
		TOGGLE: [
			{
				guard: "knownFilter",
				actions: ["applyToggle", "announceChange", "clearWarnings"],
			},
			{ actions: "warnToggle" },
		],
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

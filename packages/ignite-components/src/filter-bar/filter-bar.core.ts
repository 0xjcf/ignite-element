import { igniteCore } from "ignite-element/xstate";
import type { SnapshotFrom } from "xstate";
import {
	activeWithin,
	exactQuery,
	type FilterBarEvent,
	filterBarMachine,
	parseFilters,
} from "./filter-bar.source";

export type FilterBarStateName = "idle" | "filtered";

export type FilterBarStates = {
	state: FilterBarStateName;
	label: string;
	query: string;
	filters: string[];
	active: string[];
	isFiltered: boolean;
	isFilteredRefusal: string | null;
	canClear: boolean;
	canClearRefusal: string | null;
	showFilters: boolean;
	showFiltersRefusal: string | null;
};

export type FilterBarCommands = {
	setLabel: (label: string | null) => void;
	setQuery: (query: string | null) => void;
	setFilters: (filters: string | null) => void;
	setActive: (active: string | null) => void;
	toggle: (id: string | null) => void;
	clear: () => void;
};

const NOTHING = "Nothing is filtered.";
const NO_FILTERS = "There are no filters.";

export function projectFilterBar(
	snapshot: SnapshotFrom<typeof filterBarMachine>,
): FilterBarStates {
	const filters = [...snapshot.context.filters];
	const active = activeWithin(filters, snapshot.context.active);
	const query = exactQuery(snapshot.context.query);
	const filtered = snapshot.matches("filtered");
	const showFilters = filters.length > 0;
	return {
		state: filtered ? "filtered" : "idle",
		label: snapshot.context.label,
		query,
		filters,
		active,
		isFiltered: filtered,
		isFilteredRefusal: filtered ? null : NOTHING,
		canClear: filtered,
		canClearRefusal: filtered ? null : NOTHING,
		showFilters,
		showFiltersRefusal: showFilters ? null : NO_FILTERS,
	};
}

export function filterBarCommands(source: {
	send: (event: FilterBarEvent) => void;
}): FilterBarCommands {
	return {
		setLabel: (label) => {
			source.send({
				type: "SET_LABEL",
				label: label?.trim() ? label.trim() : "Filter",
			});
		},
		setQuery: (query) => {
			source.send({ type: "SET_QUERY", query: exactQuery(query) });
		},
		setFilters: (filters) => {
			source.send({ type: "SET_FILTERS", filters: parseFilters(filters) });
		},
		setActive: (active) => {
			source.send({ type: "SET_ACTIVE", active: parseFilters(active) });
		},
		toggle: (id) => {
			const name = id?.trim() ?? "";
			if (name.length === 0) return;
			source.send({ type: "TOGGLE", id: name });
		},
		clear: () => {
			source.send({ type: "CLEAR" });
		},
	};
}

export const filterBarProjection = {
	states: projectFilterBar,
	commands: ({ source }: { source: Parameters<typeof filterBarCommands>[0] }) =>
		filterBarCommands(source),
};

export function createFilterBarCore() {
	return igniteCore({
		source: filterBarMachine,
		states: projectFilterBar,
		commands: ({ source }) => filterBarCommands(source),
		events: (event) => ({
			change: event<{ query: string; active: string[] }>(),
			clear: event<Record<string, never>>(),
		}),
	});
}

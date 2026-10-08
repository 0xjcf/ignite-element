import type { ComponentContract } from "../contract";
import { catalogTokens } from "../styles";

/**
 * Narrow a list by text and named filters.
 * The host owns the rows. Clear filters removes the query and the active names.
 */
export const filterBarContract = {
	name: "FilterBar",
	states: ["idle", "filtered"],
	flags: [
		{
			name: "isFiltered",
			kind: "is",
			reasonField: "isFilteredRefusal",
			reason: "Nothing is filtered.",
		},
		{
			name: "canClear",
			kind: "can",
			reasonField: "canClearRefusal",
			reason: "Nothing is filtered.",
		},
		{
			name: "showFilters",
			kind: "show",
			reasonField: "showFiltersRefusal",
			reason: "There are no filters.",
		},
	],
	commands: [
		{ name: "toggle", kind: "action" },
		{ name: "clear", kind: "action", flag: "canClear" },
		{ name: "setLabel", kind: "configuration", attribute: "label" },
		{ name: "setQuery", kind: "configuration", attribute: "query" },
		{ name: "setFilters", kind: "configuration", attribute: "filters" },
		{ name: "setActive", kind: "configuration", attribute: "active" },
	],
	events: ["change", "clear"],
	slots: [],
	tokens: [...catalogTokens],
	layers: {
		tokens: true,
		props: true,
		slots: false,
		headless: true,
	},
	surfaces: {
		web: "custom element; the caller chooses the tag",
		pwa: "same element, no network",
		cli: "--filter flags",
		mcp: "tool input property",
	},
	hosts: {
		cli: "M3",
		mcp: "M3",
	},
} as const satisfies ComponentContract;

import type { ComponentContract } from "../contract";
import { catalogTokens } from "../styles";

/**
 * Friendly message plus one first step when there is nothing to show.
 * Kinds are empty, filtered, and outside-range. The host owns the action.
 */
export const emptyStateContract = {
	name: "EmptyState",
	states: ["empty", "filtered", "outside-range"],
	flags: [
		{
			name: "showAction",
			kind: "show",
			reasonField: "showActionRefusal",
			reason: "There is no first step.",
		},
		{
			name: "canAct",
			kind: "can",
			reasonField: "canActRefusal",
			reason: "There is no first step.",
		},
		{
			name: "isActionRequested",
			kind: "is",
			reasonField: "isActionRequestedRefusal",
			reason: "No first step was requested.",
		},
		{
			name: "isFiltered",
			kind: "is",
			reasonField: "isFilteredRefusal",
			reason: "This is not a filtered empty.",
		},
		{
			name: "isOutsideRange",
			kind: "is",
			reasonField: "isOutsideRangeRefusal",
			reason: "This is not outside the range.",
		},
	],
	commands: [
		{ name: "act", kind: "action", flag: "canAct" },
		{ name: "setKind", kind: "configuration", attribute: "kind" },
		{ name: "setTitle", kind: "configuration", attribute: "title" },
		{ name: "setMessage", kind: "configuration", attribute: "message" },
		{ name: "setActionLabel", kind: "configuration" },
	],
	events: ["act"],
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
		cli: "one-line message plus the suggested command",
		mcp: "n/a",
	},
	hosts: {
		cli: "M3",
		mcp: "M3",
	},
} as const satisfies ComponentContract;

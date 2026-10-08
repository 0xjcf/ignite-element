import type { ComponentContract } from "../contract";
import { catalogTokens } from "../styles";

/**
 * A few related views, switched in place.
 * The host owns each panel. The tab list only records which name is active.
 */
export const tabsContract = {
	name: "Tabs",
	states: ["empty", "open", "selected"],
	flags: [
		{
			name: "showTabs",
			kind: "show",
			reasonField: "showTabsRefusal",
			reason: "There are no tabs.",
		},
		{
			name: "canSelect",
			kind: "can",
			reasonField: "canSelectRefusal",
			reason: "There are no tabs.",
		},
		{
			name: "isSelected",
			kind: "is",
			reasonField: "isSelectedRefusal",
			reason: "No tab is selected.",
		},
	],
	commands: [
		{ name: "select", kind: "action", flag: "canSelect" },
		{ name: "setLabel", kind: "configuration", attribute: "label" },
		{ name: "setItems", kind: "configuration", attribute: "items" },
		{ name: "setActive", kind: "configuration", attribute: "active" },
	],
	events: ["select"],
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
		cli: "n/a",
		mcp: "n/a",
	},
	hosts: {
		cli: "M3",
		mcp: "M3",
	},
} as const satisfies ComponentContract;

import type { ComponentContract } from "../contract";
import { catalogTokens } from "../styles";

/**
 * Minimal frame: skip link, nav slot, main slot, optional side panel, menu open/close.
 * It does not include Inspector, Log, Workbench, Surfaces, or Catalog bodies, and it does not import Tabs.
 */
export const appShellContract = {
	name: "AppShell",
	states: ["closed", "open"],
	flags: [
		{
			name: "canOpenMenu",
			kind: "can",
			reasonField: "canOpenMenuRefusal",
			reason: "The menu is already open.",
		},
		{
			name: "canCloseMenu",
			kind: "can",
			reasonField: "canCloseMenuRefusal",
			reason: "The menu is already closed.",
		},
		{
			name: "showMenu",
			kind: "show",
			reasonField: "showMenuRefusal",
			reason: "The menu is closed.",
		},
		{
			name: "isMenuOpen",
			kind: "is",
			reasonField: "isMenuOpenRefusal",
			reason: "The menu is closed.",
		},
		{
			name: "showReturn",
			kind: "show",
			reasonField: "showReturnRefusal",
			reason: "There is no return target.",
		},
		{
			name: "canReturn",
			kind: "can",
			reasonField: "canReturnRefusal",
			reason: "There is no return target.",
		},
		{
			name: "showPanel",
			kind: "show",
			reasonField: "showPanelRefusal",
			reason: "The side panel is closed.",
		},
		{
			name: "isReturnRequested",
			kind: "is",
			reasonField: "isReturnRequestedRefusal",
			reason: "No return was requested.",
		},
	],
	commands: [
		{ name: "openMenu", kind: "action", flag: "canOpenMenu" },
		{ name: "closeMenu", kind: "action", flag: "canCloseMenu" },
		{ name: "requestReturn", kind: "action", flag: "canReturn" },
		{ name: "setRoute", kind: "configuration", attribute: "route" },
		{ name: "setReturnTo", kind: "configuration" },
		{ name: "setPanel", kind: "configuration", attribute: "panel" },
	],
	events: [],
	slots: ["nav", "main", "panel"],
	tokens: [...catalogTokens],
	layers: {
		tokens: true,
		props: true,
		slots: true,
		headless: true,
	},
	surfaces: {
		web: "custom element; the caller chooses the tag",
		pwa: "same element, installed shell, no network",
		cli: "n/a",
		mcp: "n/a",
	},
	hosts: {
		cli: "M3",
		mcp: "M3",
	},
} as const satisfies ComponentContract;

import { igniteCore } from "ignite-element/xstate";
import type { SnapshotFrom } from "xstate";
import {
	type AppShellEvent,
	appShellMachine,
	normalizeReturnTo,
} from "./app-shell.source";

export type AppShellStateName = "closed" | "open";

export type AppShellStates = {
	state: AppShellStateName;
	activeRoute: string;
	returnTo: string | null;
	returnRequested: boolean;
	canOpenMenu: boolean;
	canOpenMenuRefusal: string | null;
	canCloseMenu: boolean;
	canCloseMenuRefusal: string | null;
	showMenu: boolean;
	showMenuRefusal: string | null;
	isMenuOpen: boolean;
	isMenuOpenRefusal: string | null;
	showReturn: boolean;
	showReturnRefusal: string | null;
	canReturn: boolean;
	canReturnRefusal: string | null;
	showPanel: boolean;
	showPanelRefusal: string | null;
	isReturnRequested: boolean;
	isReturnRequestedRefusal: string | null;
};

export type AppShellCommands = {
	openMenu: () => void;
	closeMenu: () => void;
	setRoute: (route: string | null) => void;
	setReturnTo: (returnTo: string | null) => void;
	requestReturn: () => void;
	setPanel: (open: string | null) => void;
};

const MENU_OPEN = "The menu is already open.";
const MENU_CLOSED = "The menu is already closed.";
const MENU_HIDDEN = "The menu is closed.";
const NO_RETURN = "There is no return target.";
const PANEL_CLOSED = "The side panel is closed.";
const NO_REQUEST = "No return was requested.";

function isOpen(snapshot: SnapshotFrom<typeof appShellMachine>): boolean {
	return snapshot.matches("open");
}

export function projectAppShell(
	snapshot: SnapshotFrom<typeof appShellMachine>,
): AppShellStates {
	const open = isOpen(snapshot);
	const returnTo = normalizeReturnTo(snapshot.context.returnTo);
	const showReturn = returnTo !== null;
	const showPanel = snapshot.context.panelOpen;
	const returnRequested = snapshot.context.returnRequested && showReturn;
	return {
		state: open ? "open" : "closed",
		activeRoute: snapshot.context.activeRoute,
		returnTo,
		returnRequested,
		canOpenMenu: !open,
		canOpenMenuRefusal: open ? MENU_OPEN : null,
		canCloseMenu: open,
		canCloseMenuRefusal: open ? null : MENU_CLOSED,
		showMenu: open,
		showMenuRefusal: open ? null : MENU_HIDDEN,
		isMenuOpen: open,
		isMenuOpenRefusal: open ? null : MENU_HIDDEN,
		showReturn,
		showReturnRefusal: showReturn ? null : NO_RETURN,
		canReturn: showReturn,
		canReturnRefusal: showReturn ? null : NO_RETURN,
		showPanel,
		showPanelRefusal: showPanel ? null : PANEL_CLOSED,
		isReturnRequested: returnRequested,
		isReturnRequestedRefusal: returnRequested ? null : NO_REQUEST,
	};
}

export function appShellCommands(source: {
	send: (event: AppShellEvent) => void;
}): AppShellCommands {
	return {
		openMenu: () => {
			source.send({ type: "OPEN_MENU" });
		},
		closeMenu: () => {
			source.send({ type: "CLOSE_MENU" });
		},
		setRoute: (route) => {
			source.send({ type: "SET_ROUTE", route: route ?? "" });
		},
		setReturnTo: (returnTo) => {
			source.send({ type: "SET_RETURN_TO", returnTo });
		},
		requestReturn: () => {
			source.send({ type: "REQUEST_RETURN" });
		},
		setPanel: (open) => {
			source.send({ type: "SET_PANEL", open: open === "true" });
		},
	};
}

export const appShellProjection = {
	states: projectAppShell,
	commands: ({ source }: { source: Parameters<typeof appShellCommands>[0] }) =>
		appShellCommands(source),
};

export function createAppShellCore() {
	return igniteCore({
		source: appShellMachine,
		states: projectAppShell,
		commands: ({ source }) => appShellCommands(source),
		events: (event) => ({
			"return-request": event<{ returnTo: string }>(),
		}),
	});
}

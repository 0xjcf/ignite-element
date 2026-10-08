import { assign, emit, setup } from "xstate";

export type AppShellInput = {
	activeRoute?: string;
	returnTo?: string | null;
	panelOpen?: boolean;
	menuOpen?: boolean;
};

export type AppShellContext = {
	activeRoute: string;
	returnTo: string | null;
	panelOpen: boolean;
	returnRequested: boolean;
	/** Consumed once so a later close does not reopen the menu. */
	startOpen: boolean;
};

export type AppShellEvent =
	| { type: "OPEN_MENU" }
	| { type: "CLOSE_MENU" }
	| { type: "SET_ROUTE"; route: string }
	| { type: "SET_RETURN_TO"; returnTo: string | null }
	| { type: "REQUEST_RETURN" }
	| { type: "SET_PANEL"; open: boolean };

export type AppShellEmitted = { type: "return-request"; returnTo: string };

export function normalizeReturnTo(value: string | null): string | null {
	if (value === null) return null;
	const trimmed = value.trim();
	if (trimmed.length === 0) return null;
	return trimmed;
}

/**
 * Frame only. Routing policy stays in the app.
 * `closed` and `open` are the menu. The route, return target, and panel are context.
 */
export const appShellMachine = setup({
	types: {
		context: {} as AppShellContext,
		events: {} as AppShellEvent,
		emitted: {} as AppShellEmitted,
		input: {} as AppShellInput,
	},
	actions: {
		applyRoute: assign({
			activeRoute: ({ event }) =>
				event.type === "SET_ROUTE" ? event.route : "",
		}),
		applyReturnTo: assign({
			returnTo: ({ event }) =>
				event.type === "SET_RETURN_TO"
					? normalizeReturnTo(event.returnTo)
					: null,
			returnRequested: () => false,
		}),
		requestReturn: assign({
			returnRequested: () => true,
		}),
		announceReturn: emit(({ context }) => ({
			type: "return-request" as const,
			returnTo: context.returnTo ?? "",
		})),
		applyPanel: assign({
			panelOpen: ({ event }) =>
				event.type === "SET_PANEL" ? event.open : false,
		}),
		clearStartOpen: assign({
			startOpen: () => false,
		}),
	},
	guards: {
		startOpen: ({ context }) => context.startOpen,
		hasReturn: ({ context }) => normalizeReturnTo(context.returnTo) !== null,
	},
}).createMachine({
	id: "app-shell",
	initial: "closed",
	context: ({ input }) => ({
		activeRoute: input?.activeRoute ?? "",
		returnTo: normalizeReturnTo(input?.returnTo ?? null),
		panelOpen: input?.panelOpen ?? false,
		returnRequested: false,
		startOpen: input?.menuOpen ?? false,
	}),
	on: {
		SET_ROUTE: { actions: "applyRoute" },
		SET_RETURN_TO: { actions: "applyReturnTo" },
		SET_PANEL: { actions: "applyPanel" },
	},
	states: {
		closed: {
			always: {
				guard: "startOpen",
				target: "open",
				actions: "clearStartOpen",
			},
			on: {
				OPEN_MENU: "open",
				REQUEST_RETURN: {
					guard: "hasReturn",
					actions: ["requestReturn", "announceReturn"],
				},
			},
		},
		open: {
			on: {
				CLOSE_MENU: "closed",
				REQUEST_RETURN: {
					guard: "hasReturn",
					actions: ["requestReturn", "announceReturn"],
				},
			},
		},
	},
});

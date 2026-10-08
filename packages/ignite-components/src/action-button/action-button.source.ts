import { assign, emit, setup } from "xstate";

export type ActionButtonPhase = "idle" | "pending" | "unavailable";

export type ActionButtonInput = {
	label?: string;
	pendingLabel?: string;
	reason?: string | null;
};

export type ActionButtonContext = {
	label: string;
	pendingLabel: string;
	reason: string | null;
};

export type ActionButtonEvent =
	| { type: "PRESS" }
	| { type: "SETTLE" }
	| { type: "ALLOW" }
	| { type: "REFUSE"; reason: string | null }
	| { type: "SET_LABEL"; label: string }
	| { type: "SET_PENDING_LABEL"; pendingLabel: string };

export const DEFAULT_LABEL = "Action";
export const DEFAULT_PENDING_LABEL = "Working…";
export const PENDING_REASON = "This action is already running.";
export const UNAVAILABLE_REASON = "This action is unavailable.";

export type ActionButtonEmitted = { type: "press"; label: string };

export function refusalReason(reason: string | null): string {
	if (reason === null) return UNAVAILABLE_REASON;
	const trimmed = reason.trim();
	if (trimmed.length === 0) return UNAVAILABLE_REASON;
	return trimmed;
}

/**
 * The button does not decide permission. The host sends ALLOW or REFUSE.
 * PRESS is only accepted while idle, which is the host's "can" state.
 */
export const actionButtonMachine = setup({
	types: {
		context: {} as ActionButtonContext,
		events: {} as ActionButtonEvent,
		emitted: {} as ActionButtonEmitted,
		input: {} as ActionButtonInput,
	},
	actions: {
		applyLabel: assign({
			label: ({ event }) => (event.type === "SET_LABEL" ? event.label : ""),
		}),
		applyPendingLabel: assign({
			pendingLabel: ({ event }) =>
				event.type === "SET_PENDING_LABEL" ? event.pendingLabel : "",
		}),
		applyRefusal: assign({
			reason: ({ event }) =>
				event.type === "REFUSE" ? refusalReason(event.reason) : null,
		}),
		clearReason: assign({
			reason: () => null,
		}),
		announcePress: emit(({ context }) => ({
			type: "press" as const,
			label: context.label,
		})),
	},
}).createMachine({
	id: "action-button",
	initial: "idle",
	context: ({ input }) => ({
		label: input?.label ?? DEFAULT_LABEL,
		pendingLabel: input?.pendingLabel ?? DEFAULT_PENDING_LABEL,
		reason: input?.reason ?? null,
	}),
	on: {
		SET_LABEL: { actions: "applyLabel" },
		SET_PENDING_LABEL: { actions: "applyPendingLabel" },
	},
	states: {
		idle: {
			entry: "clearReason",
			on: {
				PRESS: { target: "pending", actions: "announcePress" },
				REFUSE: { target: "unavailable", actions: "applyRefusal" },
			},
		},
		pending: {
			on: {
				SETTLE: "idle",
				REFUSE: { target: "unavailable", actions: "applyRefusal" },
			},
		},
		unavailable: {
			on: {
				ALLOW: "idle",
				REFUSE: { actions: "applyRefusal" },
			},
		},
	},
});

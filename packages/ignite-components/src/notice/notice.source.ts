import { assign, emit, setup } from "xstate";

export const noticeTones = [
	"info",
	"warning",
	"error",
	"stale",
	"ai-off",
] as const;

export type NoticeTone = (typeof noticeTones)[number];

export type NoticeInput = {
	tone?: NoticeTone;
	message?: string;
	actions?: readonly string[];
	dismissible?: boolean;
};

export type NoticeContext = {
	instanceId: string;
	tone: NoticeTone;
	message: string;
	actions: string[];
	dismissible: boolean;
	recoveryRequested: string | null;
	focusTarget: string | null;
};

export type NoticeEvent =
	| { type: "SET_TONE"; tone: NoticeTone }
	| { type: "SET_MESSAGE"; message: string }
	| { type: "SET_ACTIONS"; actions: string[] }
	| { type: "SET_DISMISSIBLE"; dismissible: boolean }
	| { type: "DISMISS" }
	| { type: "SHOW" }
	| { type: "RECOVER"; label: string }
	| { type: "SET_FOCUS_TARGET"; focusTarget: string | null };

export type NoticeEmitted = {
	type: "recover";
	label: string;
	instanceId: string;
};

function createInstanceId(prefix: string): string {
	const random =
		globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
	return `${prefix}-${random}`;
}

export function isNoticeTone(value: string | null): value is NoticeTone {
	return noticeTones.some((tone) => tone === value);
}

/** Trim each label and drop blanks. The same rule as setActions. */
export function normalizeActions(actions: readonly string[]): string[] {
	return actions
		.map((label) => label.trim())
		.filter((label) => label.length > 0);
}

export function parseActions(value: string | null): string[] {
	if (value === null || value.length === 0) return [];
	return normalizeActions(value.split("\n"));
}

export function toneWord(tone: NoticeTone): string {
	if (tone === "ai-off") return "AI off";
	if (tone === "info") return "Info";
	if (tone === "warning") return "Warning";
	if (tone === "error") return "Error";
	return "Stale";
}

/**
 * The host decides the reason. The notice only shows it.
 * Dismiss hides it until the host sends a new message or SHOW.
 */
export const noticeMachine = setup({
	types: {
		context: {} as NoticeContext,
		events: {} as NoticeEvent,
		emitted: {} as NoticeEmitted,
		input: {} as NoticeInput,
	},
	actions: {
		applyTone: assign({
			tone: ({ event }) => (event.type === "SET_TONE" ? event.tone : "info"),
		}),
		applyMessage: assign({
			message: ({ event }) =>
				event.type === "SET_MESSAGE" ? event.message : "",
			recoveryRequested: () => null,
		}),
		applyActions: assign({
			actions: ({ event }) =>
				event.type === "SET_ACTIONS" ? [...event.actions] : [],
			recoveryRequested: () => null,
		}),
		applyDismissible: assign({
			dismissible: ({ event }) =>
				event.type === "SET_DISMISSIBLE" ? event.dismissible : false,
		}),
		requestRecovery: assign({
			recoveryRequested: ({ event }) =>
				event.type === "RECOVER" ? event.label : null,
		}),
		announceRecovery: emit(({ context, event }) => ({
			type: "recover" as const,
			label: event.type === "RECOVER" ? event.label : "",
			instanceId: context.instanceId,
		})),
		applyFocusTarget: assign({
			focusTarget: ({ event }) =>
				event.type === "SET_FOCUS_TARGET" ? event.focusTarget : null,
		}),
		clearRecovery: assign({
			recoveryRequested: () => null,
		}),
	},
	guards: {
		canDismiss: ({ context }) => context.dismissible,
		canRecover: ({ context, event }) =>
			event.type === "RECOVER" &&
			context.recoveryRequested === null &&
			context.actions.includes(event.label),
	},
}).createMachine({
	id: "notice",
	initial: "shown",
	context: ({ input }) => ({
		instanceId: createInstanceId("notice"),
		tone: input?.tone ?? "info",
		message: input?.message ?? "",
		actions: normalizeActions(input?.actions ?? []),
		dismissible: input?.dismissible ?? false,
		recoveryRequested: null,
		focusTarget: null,
	}),
	on: {
		SET_TONE: { actions: "applyTone" },
		SET_MESSAGE: { target: ".shown", actions: "applyMessage" },
		SET_ACTIONS: { actions: "applyActions" },
		SET_DISMISSIBLE: { actions: "applyDismissible" },
		SET_FOCUS_TARGET: { actions: "applyFocusTarget" },
		SHOW: { target: ".shown", actions: "clearRecovery" },
	},
	states: {
		shown: {
			on: {
				DISMISS: { guard: "canDismiss", target: "dismissed" },
				RECOVER: {
					guard: "canRecover",
					actions: ["requestRecovery", "announceRecovery"],
				},
			},
		},
		dismissed: {},
	},
});

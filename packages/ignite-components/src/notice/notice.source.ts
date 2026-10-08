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
	tone: NoticeTone;
	message: string;
	actions: string[];
	dismissible: boolean;
	recoveryRequested: string | null;
};

export type NoticeEvent =
	| { type: "SET_TONE"; tone: NoticeTone }
	| { type: "SET_MESSAGE"; message: string }
	| { type: "SET_ACTIONS"; actions: string[] }
	| { type: "SET_DISMISSIBLE"; dismissible: boolean }
	| { type: "DISMISS" }
	| { type: "SHOW" }
	| { type: "RECOVER"; label: string };

export type NoticeEmitted = { type: "recover"; label: string };

export function isNoticeTone(value: string | null): value is NoticeTone {
	return noticeTones.some((tone) => tone === value);
}

export function parseActions(value: string | null): string[] {
	if (value === null || value.length === 0) return [];
	return value
		.split("\n")
		.map((label) => label.trim())
		.filter((label) => label.length > 0);
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
		announceRecovery: emit(({ event }) => ({
			type: "recover" as const,
			label: event.type === "RECOVER" ? event.label : "",
		})),
		clearRecovery: assign({
			recoveryRequested: () => null,
		}),
	},
	guards: {
		canDismiss: ({ context }) => context.dismissible,
		canRecover: ({ context, event }) =>
			event.type === "RECOVER" && context.actions.includes(event.label),
	},
}).createMachine({
	id: "notice",
	initial: "shown",
	context: ({ input }) => ({
		tone: input?.tone ?? "info",
		message: input?.message ?? "",
		actions: [...(input?.actions ?? [])],
		dismissible: input?.dismissible ?? false,
		recoveryRequested: null,
	}),
	on: {
		SET_TONE: { actions: "applyTone" },
		SET_MESSAGE: { target: ".shown", actions: "applyMessage" },
		SET_ACTIONS: { actions: "applyActions" },
		SET_DISMISSIBLE: { actions: "applyDismissible" },
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

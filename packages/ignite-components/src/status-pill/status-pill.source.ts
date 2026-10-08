import { assign, setup } from "xstate";

export const statusPillTones = [
	"neutral",
	"info",
	"success",
	"warning",
	"danger",
] as const;

export type StatusPillTone = (typeof statusPillTones)[number];

export type StatusPillInput = {
	value?: string;
	tone?: StatusPillTone;
	reason?: string | null;
};

export type StatusPillContext = {
	value: string;
	tone: StatusPillTone;
	reason: string | null;
};

export type StatusPillEvent =
	| { type: "SET_VALUE"; value: string }
	| { type: "SET_TONE"; tone: StatusPillTone }
	| { type: "SET_REASON"; reason: string | null };

export function isStatusPillTone(
	value: string | null,
): value is StatusPillTone {
	return statusPillTones.some((tone) => tone === value);
}

export function normalizeReason(reason: string | null): string | null {
	if (reason === null) return null;
	const trimmed = reason.trim();
	if (trimmed.length === 0) return null;
	return trimmed;
}

function hasReason(context: StatusPillContext): boolean {
	return context.reason !== null && context.reason.length > 0;
}

/**
 * Display machine. `plain` and `withReason` are the declared states.
 * The pill has no action of its own. The host sets the label.
 */
export const statusPillMachine = setup({
	types: {
		context: {} as StatusPillContext,
		events: {} as StatusPillEvent,
		input: {} as StatusPillInput,
	},
	actions: {
		applyValue: assign({
			value: ({ event }) => (event.type === "SET_VALUE" ? event.value : ""),
		}),
		applyTone: assign({
			tone: ({ event }) => (event.type === "SET_TONE" ? event.tone : "neutral"),
		}),
		applyReason: assign({
			reason: ({ event }) =>
				event.type === "SET_REASON" ? normalizeReason(event.reason) : null,
		}),
	},
	guards: {
		hasReason: ({ context }) => hasReason(context),
		lacksReason: ({ context }) => !hasReason(context),
	},
}).createMachine({
	id: "status-pill",
	initial: "plain",
	context: ({ input }) => ({
		value: input?.value ?? "",
		tone: input?.tone ?? "neutral",
		reason: normalizeReason(input?.reason ?? null),
	}),
	on: {
		SET_VALUE: { actions: "applyValue" },
		SET_TONE: { actions: "applyTone" },
		SET_REASON: { actions: "applyReason" },
	},
	states: {
		plain: {
			always: {
				guard: "hasReason",
				target: "withReason",
			},
		},
		withReason: {
			always: {
				guard: "lacksReason",
				target: "plain",
			},
		},
	},
});

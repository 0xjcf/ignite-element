import { assign, setup } from "xstate";
import { cliTone, createInstanceId } from "../live-status/live-status.source";

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
	/** Opt in. A pill does not announce until the host asks. */
	announce?: boolean;
};

export type StatusPillContext = {
	instanceId: string;
	value: string;
	tone: StatusPillTone;
	reason: string | null;
	announce: boolean;
	/** Set only after a change while announce is on. */
	announcement: string | null;
};

export type StatusPillEvent =
	| { type: "SET_VALUE"; value: string }
	| { type: "SET_TONE"; tone: StatusPillTone }
	| { type: "SET_REASON"; reason: string | null }
	| { type: "SET_ANNOUNCE"; announce: boolean };

export function isStatusPillTone(
	value: string | null,
): value is StatusPillTone {
	return statusPillTones.some((tone) => tone === value);
}

export function statusToneWord(tone: StatusPillTone): string {
	if (tone === "info") return "Info";
	if (tone === "success") return "Success";
	if (tone === "warning") return "Warning";
	if (tone === "danger") return "Danger";
	return "Neutral";
}

/** Visible sentence. The tone word is text, not only a border. */
export function statusSentence(
	value: string,
	tone: StatusPillTone,
	reason: string | null,
): string {
	const words = reason ? `${value} — ${reason}` : value;
	return `${statusToneWord(tone)} ${words}`.trim();
}

export function statusCliLine(
	value: string,
	tone: StatusPillTone,
	reason: string | null,
): string {
	const words = reason ? `${value} — ${reason}` : value;
	return cliTone(tone, words);
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
		applyValue: assign(({ context, event }) => {
			if (event.type !== "SET_VALUE") return {};
			const value = event.value;
			return {
				value,
				announcement: context.announce
					? statusSentence(value, context.tone, context.reason)
					: null,
			};
		}),
		applyTone: assign(({ context, event }) => {
			if (event.type !== "SET_TONE") return {};
			const tone = event.tone;
			return {
				tone,
				announcement: context.announce
					? statusSentence(context.value, tone, context.reason)
					: null,
			};
		}),
		applyReason: assign(({ context, event }) => {
			if (event.type !== "SET_REASON") return {};
			const reason = normalizeReason(event.reason);
			return {
				reason,
				announcement: context.announce
					? statusSentence(context.value, context.tone, reason)
					: null,
			};
		}),
		applyAnnounce: assign(({ event }) => {
			if (event.type !== "SET_ANNOUNCE") return {};
			return { announce: event.announce, announcement: null };
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
		instanceId: createInstanceId("status"),
		value: input?.value ?? "",
		tone: input?.tone ?? "neutral",
		reason: normalizeReason(input?.reason ?? null),
		announce: input?.announce ?? false,
		announcement: null,
	}),
	on: {
		SET_VALUE: { actions: "applyValue" },
		SET_TONE: { actions: "applyTone" },
		SET_REASON: { actions: "applyReason" },
		SET_ANNOUNCE: { actions: "applyAnnounce" },
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

import { assign, setup } from "xstate";

export const livePoliteness = ["off", "polite", "assertive"] as const;
export type LivePoliteness = (typeof livePoliteness)[number];

export const liveProgress = ["none", "indeterminate", "skeleton"] as const;
export type LiveProgress = (typeof liveProgress)[number];

export const liveTones = [
	"neutral",
	"info",
	"success",
	"warning",
	"error",
] as const;
export type LiveTone = (typeof liveTones)[number];

export type LiveStatusInput = {
	message?: string;
	politeness?: LivePoliteness;
	busy?: boolean;
	progress?: LiveProgress;
	settled?: string | null;
	tone?: string;
	reason?: string | null;
};

export type LiveStatusContext = {
	instanceId: string;
	message: string;
	politeness: LivePoliteness;
	busy: boolean;
	progress: LiveProgress;
	settled: string | null;
	tone: LiveTone;
	reason: string | null;
	/** A second busy request while one is already running. The message stays. */
	duplicateBusy: boolean;
	/** Bumped so the first paint can stay empty, then fill on a later update. */
	paintNonce: number;
};

export type LiveStatusEvent =
	| { type: "SET_MESSAGE"; message: string }
	| { type: "SET_POLITENESS"; politeness: LivePoliteness }
	| {
			type: "SET_ANNOUNCEMENT";
			message: string;
			politeness: LivePoliteness;
	  }
	| { type: "SET_BUSY"; busy: boolean }
	| { type: "SET_PROGRESS"; progress: LiveProgress }
	| { type: "SET_SETTLED"; settled: string | null }
	| { type: "SET_TONE"; tone: string }
	| { type: "SET_REASON"; reason: string | null }
	| { type: "REVEAL" }
	| { type: "CLEAR" };

export function createInstanceId(prefix: string): string {
	const random =
		globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
	return `${prefix}-${random}`;
}

export function isLivePoliteness(
	value: string | null,
): value is LivePoliteness {
	return livePoliteness.some((item) => item === value);
}

export function isLiveProgress(value: string | null): value is LiveProgress {
	return liveProgress.some((item) => item === value);
}

export function isLiveTone(value: string | null): value is LiveTone {
	return liveTones.some((item) => item === value);
}

export function toneLabel(tone: LiveTone): string {
	if (tone === "info") return "Info";
	if (tone === "success") return "Success";
	if (tone === "warning") return "Warning";
	if (tone === "error") return "Error";
	return "Neutral";
}

/** Whitespace-only text is quiet. */
export function normalizeLine(value: string | null): string {
	return (value ?? "").trim();
}

export function normalizeOptionalLine(value: string | null): string | null {
	if (value === null) return null;
	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}

export function normalizeTone(value: string | null | undefined): LiveTone {
	const trimmed = value?.trim().toLowerCase() ?? "";
	return isLiveTone(trimmed) ? trimmed : "neutral";
}

/** Leading CLI tone word. No color codes. Neutral and info stay plain. */
export function cliTone(tone: string, message: string): string {
	const word = tone.trim().toLowerCase();
	if (word.length === 0 || word === "neutral" || word === "info") {
		return message;
	}
	return `${word}: ${message}`;
}

function hasSettled(context: LiveStatusContext): boolean {
	return context.settled !== null && context.settled.length > 0;
}

function hasAssertive(context: LiveStatusContext): boolean {
	return (
		!context.busy &&
		!hasSettled(context) &&
		context.politeness === "assertive" &&
		context.message.length > 0
	);
}

function hasPolite(context: LiveStatusContext): boolean {
	return (
		!context.busy &&
		!hasSettled(context) &&
		context.politeness === "polite" &&
		context.message.length > 0
	);
}

/**
 * Shared announcer. Polite and assertive regions, a busy region, and a
 * settled line. It does not write files or talk to a network.
 */
export const liveStatusMachine = setup({
	types: {
		context: {} as LiveStatusContext,
		events: {} as LiveStatusEvent,
		input: {} as LiveStatusInput,
	},
	actions: {
		applyMessage: assign({
			message: ({ event }) =>
				event.type === "SET_MESSAGE" ? normalizeLine(event.message) : "",
			duplicateBusy: () => false,
		}),
		applyPoliteness: assign({
			politeness: ({ event }) =>
				event.type === "SET_POLITENESS" ? event.politeness : "off",
		}),
		applyAnnouncement: assign({
			message: ({ event }) =>
				event.type === "SET_ANNOUNCEMENT" ? normalizeLine(event.message) : "",
			politeness: ({ event }) =>
				event.type === "SET_ANNOUNCEMENT" ? event.politeness : "off",
			duplicateBusy: () => false,
		}),
		applyBusy: assign(({ context, event }) => {
			if (event.type !== "SET_BUSY") return {};
			if (event.busy && context.busy) {
				return { duplicateBusy: true };
			}
			if (!event.busy) {
				return { busy: false, duplicateBusy: false };
			}
			return { busy: true, duplicateBusy: false };
		}),
		applyProgress: assign({
			progress: ({ event }) =>
				event.type === "SET_PROGRESS" ? event.progress : "none",
		}),
		applySettled: assign(({ context, event }) => {
			if (event.type !== "SET_SETTLED") return {};
			const settled = normalizeOptionalLine(event.settled);
			if (settled === null) return { settled: null };
			return {
				settled,
				busy: false,
				duplicateBusy: false,
				politeness: context.politeness,
			};
		}),
		applyTone: assign(({ context, event }) => {
			if (event.type !== "SET_TONE") return {};
			const trimmed = event.tone.trim().toLowerCase();
			if (!isLiveTone(trimmed)) return { tone: context.tone };
			return { tone: trimmed };
		}),
		applyReason: assign({
			reason: ({ event }) =>
				event.type === "SET_REASON"
					? normalizeOptionalLine(event.reason)
					: null,
		}),
		reveal: assign({
			paintNonce: ({ context }) => context.paintNonce + 1,
		}),
		clearAll: assign({
			message: () => "",
			politeness: () => "off" as const,
			busy: () => false,
			progress: () => "none" as const,
			settled: () => null,
			reason: () => null,
			duplicateBusy: () => false,
		}),
	},
	guards: {
		isBusy: ({ context }) => context.busy,
		notBusy: ({ context }) => !context.busy,
		isSettled: ({ context }) => !context.busy && hasSettled(context),
		notSettled: ({ context }) => context.busy || !hasSettled(context),
		isAssertive: ({ context }) => hasAssertive(context),
		notAssertive: ({ context }) => !hasAssertive(context),
		isPolite: ({ context }) => hasPolite(context),
		notPolite: ({ context }) => !hasPolite(context),
	},
}).createMachine({
	id: "live-status",
	initial: "quiet",
	context: ({ input }) => ({
		instanceId: createInstanceId("live"),
		message: normalizeLine(input?.message ?? ""),
		politeness: input?.politeness ?? "off",
		busy: input?.busy ?? false,
		progress: input?.progress ?? "none",
		settled: normalizeOptionalLine(input?.settled ?? null),
		tone: normalizeTone(input?.tone),
		reason: normalizeOptionalLine(input?.reason ?? null),
		duplicateBusy: false,
		paintNonce: 0,
	}),
	on: {
		SET_MESSAGE: { actions: "applyMessage" },
		SET_POLITENESS: { actions: "applyPoliteness" },
		SET_ANNOUNCEMENT: { actions: "applyAnnouncement" },
		SET_BUSY: { actions: "applyBusy" },
		SET_PROGRESS: { actions: "applyProgress" },
		SET_SETTLED: { actions: "applySettled" },
		SET_TONE: { actions: "applyTone" },
		SET_REASON: { actions: "applyReason" },
		REVEAL: { actions: "reveal" },
		CLEAR: { actions: "clearAll" },
	},
	states: {
		quiet: {
			always: [
				{ guard: "isBusy", target: "busy" },
				{ guard: "isSettled", target: "settled" },
				{ guard: "isAssertive", target: "assertive" },
				{ guard: "isPolite", target: "polite" },
			],
		},
		polite: {
			always: [
				{ guard: "isBusy", target: "busy" },
				{ guard: "isSettled", target: "settled" },
				{ guard: "isAssertive", target: "assertive" },
				{ guard: "notPolite", target: "quiet" },
			],
		},
		assertive: {
			always: [
				{ guard: "isBusy", target: "busy" },
				{ guard: "isSettled", target: "settled" },
				{ guard: "isPolite", target: "polite" },
				{ guard: "notAssertive", target: "quiet" },
			],
		},
		busy: {
			always: [
				{ guard: "isSettled", target: "settled" },
				{ guard: "isAssertive", target: "assertive" },
				{ guard: "isPolite", target: "polite" },
				{ guard: "notBusy", target: "quiet" },
			],
		},
		settled: {
			always: [
				{ guard: "isBusy", target: "busy" },
				{ guard: "isAssertive", target: "assertive" },
				{ guard: "isPolite", target: "polite" },
				{ guard: "notSettled", target: "quiet" },
			],
		},
	},
});

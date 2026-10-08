import { assign, setup } from "xstate";

export const livePoliteness = ["off", "polite", "assertive"] as const;
export type LivePoliteness = (typeof livePoliteness)[number];

export const liveProgress = ["none", "indeterminate", "skeleton"] as const;
export type LiveProgress = (typeof liveProgress)[number];

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
	tone: string;
	reason: string | null;
	/** A second busy request while one is already running. */
	duplicateBusy: boolean;
};

export type LiveStatusEvent =
	| { type: "SET_MESSAGE"; message: string }
	| { type: "SET_POLITENESS"; politeness: LivePoliteness }
	| { type: "SET_BUSY"; busy: boolean }
	| { type: "SET_PROGRESS"; progress: LiveProgress }
	| { type: "SET_SETTLED"; settled: string | null }
	| { type: "SET_TONE"; tone: string }
	| { type: "SET_REASON"; reason: string | null }
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

export function normalizeLine(value: string | null): string {
	return value ?? "";
}

export function normalizeOptionalLine(value: string | null): string | null {
	if (value === null) return null;
	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}

/** Leading CLI tone word. No color codes. */
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
		applyBusy: assign(({ context, event }) => {
			if (event.type !== "SET_BUSY") return {};
			if (event.busy && context.busy) {
				return {
					duplicateBusy: true,
					message: "already running",
				};
			}
			if (!event.busy) {
				return { busy: false, duplicateBusy: false };
			}
			return {
				busy: true,
				duplicateBusy: false,
				message: context.message.length > 0 ? context.message : "in progress",
			};
		}),
		applyProgress: assign({
			progress: ({ event }) =>
				event.type === "SET_PROGRESS" ? event.progress : "none",
		}),
		applySettled: assign({
			settled: ({ event }) =>
				event.type === "SET_SETTLED"
					? normalizeOptionalLine(event.settled)
					: null,
			busy: () => false,
			duplicateBusy: () => false,
			politeness: () => "off" as const,
		}),
		applyTone: assign({
			tone: ({ event }) => (event.type === "SET_TONE" ? event.tone : "neutral"),
		}),
		applyReason: assign({
			reason: ({ event }) =>
				event.type === "SET_REASON"
					? normalizeOptionalLine(event.reason)
					: null,
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
		tone: input?.tone?.trim() ? input.tone : "neutral",
		reason: normalizeOptionalLine(input?.reason ?? null),
		duplicateBusy: false,
	}),
	on: {
		SET_MESSAGE: { actions: "applyMessage" },
		SET_POLITENESS: { actions: "applyPoliteness" },
		SET_BUSY: { actions: "applyBusy" },
		SET_PROGRESS: { actions: "applyProgress" },
		SET_SETTLED: { actions: "applySettled" },
		SET_TONE: { actions: "applyTone" },
		SET_REASON: { actions: "applyReason" },
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

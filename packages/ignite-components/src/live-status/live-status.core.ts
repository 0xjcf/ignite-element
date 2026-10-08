import { igniteCore } from "ignite-element/xstate";
import type { SnapshotFrom } from "xstate";
import type { HeadlessA11y } from "../contract";
import {
	cliTone,
	isLivePoliteness,
	isLiveProgress,
	isLiveTone,
	type LivePoliteness,
	type LiveProgress,
	type LiveStatusEvent,
	type LiveTone,
	liveStatusMachine,
	normalizeLine,
	normalizeOptionalLine,
	toneLabel,
} from "./live-status.source";

export type LiveStatusStateName =
	| "quiet"
	| "polite"
	| "assertive"
	| "busy"
	| "settled";

export type LiveStatusStates = {
	state: LiveStatusStateName;
	instanceId: string;
	message: string;
	politeness: LivePoliteness;
	busy: boolean;
	progress: LiveProgress;
	settled: string | null;
	tone: LiveTone;
	reason: string | null;
	duplicateBusy: boolean;
	isBusy: boolean;
	isBusyRefusal: string | null;
	showSettled: boolean;
	showSettledRefusal: string | null;
	isLive: boolean;
	isLiveRefusal: string | null;
	a11y: HeadlessA11y;
};

export type LiveStatusCommands = {
	setMessage: (message: string | null) => void;
	setPoliteness: (politeness: string | null) => void;
	setBusy: (busy: string | null) => void;
	setProgress: (progress: string | null) => void;
	setSettled: (settled: string | null) => void;
	setTone: (tone: string | null) => void;
	setReason: (reason: string | null) => void;
	announce: (
		spec: { message?: string | null; politeness?: string | null } | null,
	) => void;
	reveal: () => void;
	clear: () => void;
};

const NOT_BUSY = "Nothing is in progress.";
const NO_SETTLED = "There is no settled status.";
const NOTHING = "There is nothing to announce.";

function stateName(
	snapshot: SnapshotFrom<typeof liveStatusMachine>,
): LiveStatusStateName {
	if (snapshot.matches("busy")) return "busy";
	if (snapshot.matches("assertive")) return "assertive";
	if (snapshot.matches("polite")) return "polite";
	if (snapshot.matches("settled")) return "settled";
	return "quiet";
}

export function projectLiveStatus(
	snapshot: SnapshotFrom<typeof liveStatusMachine>,
): LiveStatusStates {
	const state = stateName(snapshot);
	const message = snapshot.context.message;
	const settled = snapshot.context.settled;
	const busy = snapshot.context.busy;
	const duplicateBusy = snapshot.context.duplicateBusy;
	const tone = snapshot.context.tone;
	const reason = snapshot.context.reason;
	const showSettled = state === "settled" && settled !== null;
	const isLive = state !== "quiet";
	const cli = duplicateBusy
		? "already running"
		: state === "busy"
			? "in progress"
			: state === "assertive"
				? cliTone(tone === "neutral" ? "error" : tone, message)
				: state === "polite"
					? cliTone(tone, message)
					: state === "settled"
						? settled
						: null;
	const value =
		state === "settled" ? (settled ?? "") : state === "quiet" ? "" : message;
	return {
		state,
		instanceId: snapshot.context.instanceId,
		message,
		politeness: snapshot.context.politeness,
		busy,
		progress: snapshot.context.progress,
		settled,
		tone,
		reason,
		duplicateBusy,
		isBusy: busy,
		isBusyRefusal: busy ? null : NOT_BUSY,
		showSettled,
		showSettledRefusal: showSettled ? null : NO_SETTLED,
		isLive,
		isLiveRefusal: isLive ? null : NOTHING,
		a11y: {
			cli,
			mcp: {
				value,
				tone,
				label: toneLabel(tone),
				reason,
				status: busy ? "busy" : state,
				instanceId: snapshot.context.instanceId,
				warnings: [],
				focusTarget: null,
				errors: [],
				isError: tone === "error",
			},
		},
	};
}

export function liveStatusCommands(source: {
	send: (event: LiveStatusEvent) => void;
}): LiveStatusCommands {
	return {
		setMessage: (message) => {
			source.send({ type: "SET_MESSAGE", message: normalizeLine(message) });
		},
		setPoliteness: (politeness) => {
			source.send({
				type: "SET_POLITENESS",
				politeness: isLivePoliteness(politeness) ? politeness : "off",
			});
		},
		setBusy: (busy) => {
			source.send({ type: "SET_BUSY", busy: busy === "true" });
		},
		setProgress: (progress) => {
			source.send({
				type: "SET_PROGRESS",
				progress: isLiveProgress(progress) ? progress : "none",
			});
		},
		setSettled: (settled) => {
			source.send({
				type: "SET_SETTLED",
				settled: normalizeOptionalLine(settled),
			});
		},
		setTone: (tone) => {
			const trimmed = tone?.trim().toLowerCase() ?? "";
			if (trimmed.length === 0) {
				source.send({ type: "SET_TONE", tone: "neutral" });
				return;
			}
			if (!isLiveTone(trimmed)) return;
			source.send({ type: "SET_TONE", tone: trimmed });
		},
		setReason: (reason) => {
			source.send({
				type: "SET_REASON",
				reason: normalizeOptionalLine(reason),
			});
		},
		announce: (spec) => {
			if (spec === null) return;
			const candidate = spec.politeness ?? null;
			const politeness = isLivePoliteness(candidate) ? candidate : "off";
			source.send({
				type: "SET_ANNOUNCEMENT",
				message: normalizeLine(spec.message ?? null),
				politeness,
			});
		},
		reveal: () => {
			source.send({ type: "REVEAL" });
		},
		clear: () => {
			source.send({ type: "CLEAR" });
		},
	};
}

export const liveStatusProjection = {
	states: projectLiveStatus,
	commands: ({
		source,
	}: {
		source: Parameters<typeof liveStatusCommands>[0];
	}) => liveStatusCommands(source),
};

export function createLiveStatusCore() {
	return igniteCore({
		source: liveStatusMachine,
		states: projectLiveStatus,
		commands: ({ source }) => liveStatusCommands(source),
	});
}

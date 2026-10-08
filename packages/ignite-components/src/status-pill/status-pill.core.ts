import { igniteCore } from "ignite-element/xstate";
import type { SnapshotFrom } from "xstate";
import type { HeadlessA11y } from "../contract";
import {
	isStatusPillTone,
	normalizeReason,
	type StatusPillEvent,
	type StatusPillTone,
	statusCliLine,
	statusPillMachine,
	statusSentence,
	statusToneWord,
} from "./status-pill.source";

export type StatusPillStateName = "plain" | "withReason";

export type StatusPillStates = {
	state: StatusPillStateName;
	instanceId: string;
	value: string;
	tone: StatusPillTone;
	toneLabel: string;
	reason: string | null;
	announce: boolean;
	announcement: string | null;
	accessibleName: string;
	showReason: boolean;
	showReasonRefusal: string | null;
	a11y: HeadlessA11y;
};

export type StatusPillCommands = {
	setValue: (value: string | null) => void;
	setTone: (tone: string | null) => void;
	setReason: (reason: string | null) => void;
	setAnnounce: (announce: string | null) => void;
};

const NO_REASON = "No reason was given.";

export function projectStatusPill(
	snapshot: SnapshotFrom<typeof statusPillMachine>,
): StatusPillStates {
	const reason = normalizeReason(snapshot.context.reason);
	const showReason = snapshot.matches("withReason") && reason !== null;
	const state: StatusPillStateName = snapshot.matches("withReason")
		? "withReason"
		: "plain";
	const value = snapshot.context.value;
	const tone = snapshot.context.tone;
	const announce = snapshot.context.announce;
	const announcement = announce ? snapshot.context.announcement : null;
	const accessibleName = statusSentence(value, tone, reason);
	return {
		state,
		instanceId: snapshot.context.instanceId,
		value,
		tone,
		toneLabel: statusToneWord(tone),
		reason,
		announce,
		announcement,
		accessibleName,
		showReason,
		showReasonRefusal: showReason ? null : NO_REASON,
		a11y: {
			cli: announcement ? statusCliLine(value, tone, reason) : null,
			mcp: {
				value,
				tone,
				label: statusToneWord(tone),
				reason,
				status: announcement ? "polite" : "quiet",
				instanceId: snapshot.context.instanceId,
				warnings: [],
				focusTarget: null,
				errors: [],
				isError: false,
			},
		},
	};
}

export function statusPillCommands(source: {
	send: (event: StatusPillEvent) => void;
}): StatusPillCommands {
	return {
		setValue: (value) => {
			source.send({ type: "SET_VALUE", value: value ?? "" });
		},
		setTone: (tone) => {
			source.send({
				type: "SET_TONE",
				tone: isStatusPillTone(tone) ? tone : "neutral",
			});
		},
		setReason: (reason) => {
			source.send({ type: "SET_REASON", reason: normalizeReason(reason) });
		},
		setAnnounce: (announce) => {
			source.send({ type: "SET_ANNOUNCE", announce: announce === "true" });
		},
	};
}

export const statusPillProjection = {
	states: projectStatusPill,
	commands: ({
		source,
	}: {
		source: Parameters<typeof statusPillCommands>[0];
	}) => statusPillCommands(source),
};

export function createStatusPillCore() {
	return igniteCore({
		source: statusPillMachine,
		states: projectStatusPill,
		commands: ({ source }) => statusPillCommands(source),
	});
}

import { igniteCore } from "ignite-element/xstate";
import type { SnapshotFrom } from "xstate";
import type { HeadlessA11y } from "../contract";
import {
	isNoticeTone,
	type NoticeEvent,
	type NoticeTone,
	noticeMachine,
	parseActions,
	toneWord,
} from "./notice.source";

export type NoticeStateName = "shown" | "dismissed";

export type NoticeStates = {
	state: NoticeStateName;
	instanceId: string;
	tone: NoticeTone;
	message: string;
	actions: string[];
	dismissible: boolean;
	recoveryRequested: string | null;
	focusTarget: string | null;
	showNotice: boolean;
	showNoticeRefusal: string | null;
	canDismiss: boolean;
	canDismissRefusal: string | null;
	isDismissed: boolean;
	isDismissedRefusal: string | null;
	showActions: boolean;
	showActionsRefusal: string | null;
	canRecover: boolean;
	canRecoverRefusal: string | null;
	isRecoveryRequested: boolean;
	isRecoveryRequestedRefusal: string | null;
	a11y: HeadlessA11y;
};

export type NoticeCommands = {
	setTone: (tone: string | null) => void;
	setMessage: (message: string | null) => void;
	setActions: (actions: string | null) => void;
	setDismissible: (dismissible: string | null) => void;
	dismiss: () => void;
	show: () => void;
	recover: (label: string | null) => void;
	setFocusTarget: (focusTarget: string | null) => void;
	/** HTML lowercases `focusTarget`. Same setter. */
	setFocustarget: (focusTarget: string | null) => void;
};

const DISMISSED = "This notice was dismissed.";
const STAYS = "This notice stays until the host clears it.";
const STILL_SHOWING = "This notice is still showing.";
const NO_RECOVERY = "There is no recovery action.";
const NO_REQUEST = "No recovery was requested.";

export function projectNotice(
	snapshot: SnapshotFrom<typeof noticeMachine>,
): NoticeStates {
	const shown = snapshot.matches("shown");
	const actions = [...snapshot.context.actions];
	const dismissible = snapshot.context.dismissible;
	const showActions = shown && actions.length > 0;
	const canDismiss = shown && dismissible;
	const recoveryRequested = shown ? snapshot.context.recoveryRequested : null;
	const isRecoveryRequested = recoveryRequested !== null;
	const instanceId = snapshot.context.instanceId;
	const focusTarget = snapshot.context.focusTarget;
	const moved = !shown || snapshot.context.recoveryRequested !== null;
	const next = focusTarget ?? instanceId;
	return {
		state: shown ? "shown" : "dismissed",
		instanceId,
		tone: snapshot.context.tone,
		message: snapshot.context.message,
		actions,
		dismissible,
		recoveryRequested,
		focusTarget,
		showNotice: shown,
		showNoticeRefusal: shown ? null : DISMISSED,
		canDismiss,
		canDismissRefusal: canDismiss ? null : shown ? STAYS : DISMISSED,
		isDismissed: !shown,
		isDismissedRefusal: shown ? STILL_SHOWING : null,
		showActions,
		showActionsRefusal: showActions ? null : shown ? NO_RECOVERY : DISMISSED,
		canRecover: showActions,
		canRecoverRefusal: showActions ? null : shown ? NO_RECOVERY : DISMISSED,
		isRecoveryRequested,
		isRecoveryRequestedRefusal: isRecoveryRequested ? null : NO_REQUEST,
		a11y: {
			cli: moved ? `next: ${next}` : null,
			mcp: {
				value: snapshot.context.message,
				tone: snapshot.context.tone,
				label:
					snapshot.context.recoveryRequested ?? toneWord(snapshot.context.tone),
				reason: null,
				status: moved ? "settled" : "quiet",
				instanceId,
				warnings: [],
				focusTarget: moved ? next : null,
				errors: [],
				isError: snapshot.context.tone === "error",
			},
		},
	};
}

export function noticeCommands(source: {
	send: (event: NoticeEvent) => void;
}): NoticeCommands {
	return {
		setTone: (tone) => {
			const next = tone === null ? "info" : tone;
			if (!isNoticeTone(next)) return;
			source.send({ type: "SET_TONE", tone: next });
		},
		setMessage: (message) => {
			source.send({ type: "SET_MESSAGE", message: message ?? "" });
		},
		setActions: (actions) => {
			source.send({ type: "SET_ACTIONS", actions: parseActions(actions) });
		},
		setDismissible: (dismissible) => {
			source.send({
				type: "SET_DISMISSIBLE",
				dismissible: dismissible === "true",
			});
		},
		dismiss: () => {
			source.send({ type: "DISMISS" });
		},
		show: () => {
			source.send({ type: "SHOW" });
		},
		recover: (label) => {
			source.send({ type: "RECOVER", label: label ?? "" });
		},
		setFocusTarget: (focusTarget) => {
			source.send({
				type: "SET_FOCUS_TARGET",
				focusTarget: normalizeFocusTarget(focusTarget),
			});
		},
		setFocustarget: (focusTarget) => {
			source.send({
				type: "SET_FOCUS_TARGET",
				focusTarget: normalizeFocusTarget(focusTarget),
			});
		},
	};
}

function normalizeFocusTarget(focusTarget: string | null): string | null {
	const next = focusTarget?.trim() ?? "";
	return next.length > 0 ? next : null;
}

export const noticeProjection = {
	states: projectNotice,
	commands: ({ source }: { source: Parameters<typeof noticeCommands>[0] }) =>
		noticeCommands(source),
};

export function createNoticeCore() {
	return igniteCore({
		source: noticeMachine,
		states: projectNotice,
		commands: ({ source }) => noticeCommands(source),
		events: (event) => ({
			recover: event<{ label: string; instanceId: string }>(),
		}),
	});
}

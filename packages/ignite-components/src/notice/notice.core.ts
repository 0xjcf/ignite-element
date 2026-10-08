import { igniteCore } from "ignite-element/xstate";
import type { SnapshotFrom } from "xstate";
import {
	isNoticeTone,
	type NoticeEvent,
	type NoticeTone,
	noticeMachine,
	parseActions,
} from "./notice.source";

export type NoticeStateName = "shown" | "dismissed";

export type NoticeStates = {
	state: NoticeStateName;
	tone: NoticeTone;
	message: string;
	actions: string[];
	dismissible: boolean;
	recoveryRequested: string | null;
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
};

export type NoticeCommands = {
	setTone: (tone: string | null) => void;
	setMessage: (message: string | null) => void;
	setActions: (actions: string | null) => void;
	setDismissible: (dismissible: string | null) => void;
	dismiss: () => void;
	show: () => void;
	recover: (label: string | null) => void;
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
	return {
		state: shown ? "shown" : "dismissed",
		tone: snapshot.context.tone,
		message: snapshot.context.message,
		actions,
		dismissible,
		recoveryRequested,
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
	};
}

export function noticeCommands(source: {
	send: (event: NoticeEvent) => void;
}): NoticeCommands {
	return {
		setTone: (tone) => {
			if (!isNoticeTone(tone)) return;
			source.send({ type: "SET_TONE", tone });
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
	};
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
			recover: event<{ label: string }>(),
		}),
	});
}

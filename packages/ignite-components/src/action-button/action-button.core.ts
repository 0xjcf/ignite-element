import { igniteCore } from "ignite-element/xstate";
import type { SnapshotFrom } from "xstate";
import {
	type ActionButtonEvent,
	type ActionButtonPhase,
	actionButtonMachine,
	DEFAULT_LABEL,
	DEFAULT_PENDING_LABEL,
	PENDING_REASON,
	refusalReason,
} from "./action-button.source";

export type ActionButtonStates = {
	state: ActionButtonPhase;
	label: string;
	pendingLabel: string;
	reason: string | null;
	canPress: boolean;
	canPressRefusal: string | null;
	showReason: boolean;
	showReasonRefusal: string | null;
	isPending: boolean;
	isPendingRefusal: string | null;
};

export type ActionButtonCommands = {
	press: () => void;
	settle: () => void;
	allow: () => void;
	refuse: (reason: string | null) => void;
	setLabel: (label: string | null) => void;
	setPendingLabel: (pendingLabel: string | null) => void;
	/** HTML lowercases `pendingLabel` to `pendinglabel`. Same setter. */
	setPendinglabel: (pendingLabel: string | null) => void;
};

const NOT_RUNNING = "This action is not running.";
const NO_REASON = "No reason was given.";

function phaseOf(
	snapshot: SnapshotFrom<typeof actionButtonMachine>,
): ActionButtonPhase {
	if (snapshot.matches("pending")) return "pending";
	if (snapshot.matches("unavailable")) return "unavailable";
	return "idle";
}

export function projectActionButton(
	snapshot: SnapshotFrom<typeof actionButtonMachine>,
): ActionButtonStates {
	const state = phaseOf(snapshot);
	const canPress = state === "idle";
	const isPending = state === "pending";
	const hostReason =
		state === "unavailable" ? refusalReason(snapshot.context.reason) : null;
	const reason = isPending ? PENDING_REASON : hostReason;
	const showReason = reason !== null;
	return {
		state,
		label: snapshot.context.label,
		pendingLabel: snapshot.context.pendingLabel,
		reason,
		canPress,
		canPressRefusal: canPress ? null : (reason ?? UNAVAILABLE_FALLBACK),
		showReason,
		showReasonRefusal: showReason ? null : NO_REASON,
		isPending,
		isPendingRefusal: isPending ? null : NOT_RUNNING,
	};
}

const UNAVAILABLE_FALLBACK = "This action is unavailable.";

export function actionButtonCommands(source: {
	send: (event: ActionButtonEvent) => void;
}): ActionButtonCommands {
	return {
		press: () => {
			source.send({ type: "PRESS" });
		},
		settle: () => {
			source.send({ type: "SETTLE" });
		},
		allow: () => {
			source.send({ type: "ALLOW" });
		},
		refuse: (reason) => {
			source.send({ type: "REFUSE", reason });
		},
		setLabel: (label) => {
			const next =
				label === null || label.trim() === "" ? DEFAULT_LABEL : label;
			source.send({ type: "SET_LABEL", label: next });
		},
		setPendingLabel: (pendingLabel) => {
			source.send({
				type: "SET_PENDING_LABEL",
				pendingLabel: pendingText(pendingLabel),
			});
		},
		setPendinglabel: (pendingLabel) => {
			source.send({
				type: "SET_PENDING_LABEL",
				pendingLabel: pendingText(pendingLabel),
			});
		},
	};
}

function pendingText(pendingLabel: string | null): string {
	if (pendingLabel === null || pendingLabel.trim() === "") {
		return DEFAULT_PENDING_LABEL;
	}
	return pendingLabel;
}

export const actionButtonProjection = {
	states: projectActionButton,
	commands: ({
		source,
	}: {
		source: Parameters<typeof actionButtonCommands>[0];
	}) => actionButtonCommands(source),
};

export function createActionButtonCore() {
	return igniteCore({
		source: actionButtonMachine,
		states: projectActionButton,
		commands: ({ source }) => actionButtonCommands(source),
		events: (event) => ({
			press: event<{ label: string }>(),
		}),
	});
}

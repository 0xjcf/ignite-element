import { igniteCore } from "ignite-element/xstate";
import type { SnapshotFrom } from "xstate";
import {
	type EmptyStateEvent,
	type EmptyStateKind,
	emptyStateMachine,
	isEmptyStateKind,
	normalizeActionLabel,
} from "./empty-state.source";

export type EmptyStateName = EmptyStateKind;

export type EmptyStateStates = {
	state: EmptyStateName;
	title: string;
	message: string;
	actionLabel: string | null;
	actionRequested: boolean;
	showAction: boolean;
	showActionRefusal: string | null;
	canAct: boolean;
	canActRefusal: string | null;
	isActionRequested: boolean;
	isActionRequestedRefusal: string | null;
	isFiltered: boolean;
	isFilteredRefusal: string | null;
	isOutsideRange: boolean;
	isOutsideRangeRefusal: string | null;
};

export type EmptyStateCommands = {
	setKind: (kind: string | null) => void;
	setTitle: (title: string | null) => void;
	setMessage: (message: string | null) => void;
	setActionLabel: (actionLabel: string | null) => void;
	act: () => void;
};

const NO_STEP = "There is no first step.";
const NO_REQUEST = "No first step was requested.";
const NOT_FILTERED = "This is not a filtered empty.";
const NOT_OUTSIDE = "This is not outside the range.";

export function projectEmptyState(
	snapshot: SnapshotFrom<typeof emptyStateMachine>,
): EmptyStateStates {
	const state: EmptyStateName = snapshot.matches("filtered")
		? "filtered"
		: snapshot.matches("outside-range")
			? "outside-range"
			: "empty";
	const actionLabel = normalizeActionLabel(snapshot.context.actionLabel);
	const showAction = actionLabel !== null;
	const actionRequested = snapshot.context.actionRequested && showAction;
	const isFiltered = state === "filtered";
	const isOutsideRange = state === "outside-range";
	return {
		state,
		title: snapshot.context.title,
		message: snapshot.context.message,
		actionLabel,
		actionRequested,
		showAction,
		showActionRefusal: showAction ? null : NO_STEP,
		canAct: showAction,
		canActRefusal: showAction ? null : NO_STEP,
		isActionRequested: actionRequested,
		isActionRequestedRefusal: actionRequested ? null : NO_REQUEST,
		isFiltered,
		isFilteredRefusal: isFiltered ? null : NOT_FILTERED,
		isOutsideRange,
		isOutsideRangeRefusal: isOutsideRange ? null : NOT_OUTSIDE,
	};
}

export function emptyStateCommands(source: {
	send: (event: EmptyStateEvent) => void;
}): EmptyStateCommands {
	return {
		setKind: (kind) => {
			const next = kind === null ? "empty" : kind;
			if (!isEmptyStateKind(next)) return;
			source.send({ type: "SET_KIND", kind: next });
		},
		setTitle: (title) => {
			source.send({ type: "SET_TITLE", title: title ?? "" });
		},
		setMessage: (message) => {
			source.send({ type: "SET_MESSAGE", message: message ?? "" });
		},
		setActionLabel: (actionLabel) => {
			source.send({
				type: "SET_ACTION_LABEL",
				actionLabel: normalizeActionLabel(actionLabel),
			});
		},
		act: () => {
			source.send({ type: "ACT" });
		},
	};
}

export const emptyStateProjection = {
	states: projectEmptyState,
	commands: ({
		source,
	}: {
		source: Parameters<typeof emptyStateCommands>[0];
	}) => emptyStateCommands(source),
};

export function createEmptyStateCore() {
	return igniteCore({
		source: emptyStateMachine,
		states: projectEmptyState,
		commands: ({ source }) => emptyStateCommands(source),
		events: (event) => ({
			act: event<{ label: string }>(),
		}),
	});
}

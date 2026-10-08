import { assign, emit, setup } from "xstate";

export const emptyStateKinds = ["empty", "filtered", "outside-range"] as const;

export type EmptyStateKind = (typeof emptyStateKinds)[number];

export type EmptyStateInput = {
	kind?: EmptyStateKind;
	title?: string;
	message?: string;
	actionLabel?: string | null;
};

export type EmptyStateContext = {
	instanceId: string;
	title: string;
	message: string;
	actionLabel: string | null;
	actionRequested: boolean;
	focusTarget: string | null;
	/** Consumed once so a later move back to empty does not bounce. */
	startKind: EmptyStateKind;
};

export type EmptyStateEvent =
	| { type: "SET_KIND"; kind: EmptyStateKind }
	| { type: "SET_TITLE"; title: string }
	| { type: "SET_MESSAGE"; message: string }
	| { type: "SET_ACTION_LABEL"; actionLabel: string | null }
	| { type: "SET_FOCUS_TARGET"; focusTarget: string | null }
	| { type: "ACT" };

export type EmptyStateEmitted = {
	type: "act";
	label: string;
	instanceId: string;
};

function createInstanceId(prefix: string): string {
	const random =
		globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
	return `${prefix}-${random}`;
}

export function isEmptyStateKind(
	value: string | null,
): value is EmptyStateKind {
	return emptyStateKinds.some((kind) => kind === value);
}

export function normalizeActionLabel(value: string | null): string | null {
	if (value === null) return null;
	const trimmed = value.trim();
	if (trimmed.length === 0) return null;
	return trimmed;
}

/**
 * A friendly message and one optional first step.
 * The host owns what that step does. ACT only records that the person asked.
 */
export const emptyStateMachine = setup({
	types: {
		context: {} as EmptyStateContext,
		events: {} as EmptyStateEvent,
		emitted: {} as EmptyStateEmitted,
		input: {} as EmptyStateInput,
	},
	actions: {
		applyTitle: assign({
			title: ({ event }) => (event.type === "SET_TITLE" ? event.title : ""),
			actionRequested: () => false,
		}),
		applyMessage: assign({
			message: ({ event }) =>
				event.type === "SET_MESSAGE" ? event.message : "",
			actionRequested: () => false,
		}),
		applyActionLabel: assign({
			actionLabel: ({ event }) =>
				event.type === "SET_ACTION_LABEL"
					? normalizeActionLabel(event.actionLabel)
					: null,
			actionRequested: () => false,
		}),
		requestAction: assign({
			actionRequested: () => true,
		}),
		clearRequest: assign({
			actionRequested: () => false,
		}),
		announceAction: emit(({ context }) => ({
			type: "act" as const,
			label: context.actionLabel ?? "",
			instanceId: context.instanceId,
		})),
		applyFocusTarget: assign({
			focusTarget: ({ event }) =>
				event.type === "SET_FOCUS_TARGET" ? event.focusTarget : null,
		}),
		clearStartKind: assign({
			startKind: () => "empty",
		}),
	},
	guards: {
		canRequest: ({ context }) =>
			context.actionLabel !== null && !context.actionRequested,
		startFiltered: ({ context }) => context.startKind === "filtered",
		startOutside: ({ context }) => context.startKind === "outside-range",
		isFiltered: ({ event }) =>
			event.type === "SET_KIND" && event.kind === "filtered",
		isOutsideRange: ({ event }) =>
			event.type === "SET_KIND" && event.kind === "outside-range",
		isEmpty: ({ event }) => event.type === "SET_KIND" && event.kind === "empty",
	},
}).createMachine({
	id: "empty-state",
	initial: "empty",
	context: ({ input }) => ({
		instanceId: createInstanceId("empty"),
		title: input?.title ?? "",
		message: input?.message ?? "",
		actionLabel: normalizeActionLabel(input?.actionLabel ?? null),
		actionRequested: false,
		focusTarget: null,
		startKind: input?.kind ?? "empty",
	}),
	on: {
		SET_TITLE: { actions: "applyTitle" },
		SET_MESSAGE: { actions: "applyMessage" },
		SET_ACTION_LABEL: { actions: "applyActionLabel" },
		SET_FOCUS_TARGET: { actions: "applyFocusTarget" },
	},
	states: {
		empty: {
			always: [
				{
					guard: "startFiltered",
					target: "filtered",
					actions: "clearStartKind",
				},
				{
					guard: "startOutside",
					target: "outside-range",
					actions: "clearStartKind",
				},
			],
			on: {
				SET_KIND: [
					{
						guard: "isFiltered",
						target: "filtered",
						actions: "clearRequest",
					},
					{
						guard: "isOutsideRange",
						target: "outside-range",
						actions: "clearRequest",
					},
				],
				ACT: {
					guard: "canRequest",
					actions: ["requestAction", "announceAction"],
				},
			},
		},
		filtered: {
			on: {
				SET_KIND: [
					{ guard: "isEmpty", target: "empty", actions: "clearRequest" },
					{
						guard: "isOutsideRange",
						target: "outside-range",
						actions: "clearRequest",
					},
				],
				ACT: {
					guard: "canRequest",
					actions: ["requestAction", "announceAction"],
				},
			},
		},
		"outside-range": {
			on: {
				SET_KIND: [
					{ guard: "isEmpty", target: "empty", actions: "clearRequest" },
					{ guard: "isFiltered", target: "filtered", actions: "clearRequest" },
				],
				ACT: {
					guard: "canRequest",
					actions: ["requestAction", "announceAction"],
				},
			},
		},
	},
});

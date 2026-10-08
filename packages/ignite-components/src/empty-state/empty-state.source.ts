import { assign, setup } from "xstate";

export const emptyStateKinds = ["empty", "filtered", "outside-range"] as const;

export type EmptyStateKind = (typeof emptyStateKinds)[number];

export type EmptyStateInput = {
	kind?: EmptyStateKind;
	title?: string;
	message?: string;
	actionLabel?: string | null;
};

export type EmptyStateContext = {
	title: string;
	message: string;
	actionLabel: string | null;
	actionRequested: boolean;
	/** Consumed once so a later move back to empty does not bounce. */
	startKind: EmptyStateKind;
};

export type EmptyStateEvent =
	| { type: "SET_KIND"; kind: EmptyStateKind }
	| { type: "SET_TITLE"; title: string }
	| { type: "SET_MESSAGE"; message: string }
	| { type: "SET_ACTION_LABEL"; actionLabel: string | null }
	| { type: "ACT" };

export function isEmptyStateKind(
	value: string | null,
): value is EmptyStateKind {
	return emptyStateKinds.some((kind) => kind === value);
}

export function normalizeActionLabel(value: string | null): string | null {
	if (value === null || value.length === 0) return null;
	return value;
}

/**
 * A friendly message and one optional first step.
 * The host owns what that step does. ACT only records that the person asked.
 */
export const emptyStateMachine = setup({
	types: {
		context: {} as EmptyStateContext,
		events: {} as EmptyStateEvent,
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
		clearStartKind: assign({
			startKind: () => "empty",
		}),
	},
	guards: {
		hasAction: ({ context }) => context.actionLabel !== null,
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
		title: input?.title ?? "",
		message: input?.message ?? "",
		actionLabel: normalizeActionLabel(input?.actionLabel ?? null),
		actionRequested: false,
		startKind: input?.kind ?? "empty",
	}),
	on: {
		SET_TITLE: { actions: "applyTitle" },
		SET_MESSAGE: { actions: "applyMessage" },
		SET_ACTION_LABEL: { actions: "applyActionLabel" },
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
					{ guard: "isFiltered", target: "filtered" },
					{ guard: "isOutsideRange", target: "outside-range" },
				],
				ACT: { guard: "hasAction", actions: "requestAction" },
			},
		},
		filtered: {
			on: {
				SET_KIND: [
					{ guard: "isEmpty", target: "empty" },
					{ guard: "isOutsideRange", target: "outside-range" },
				],
				ACT: { guard: "hasAction", actions: "requestAction" },
			},
		},
		"outside-range": {
			on: {
				SET_KIND: [
					{ guard: "isEmpty", target: "empty" },
					{ guard: "isFiltered", target: "filtered" },
				],
				ACT: { guard: "hasAction", actions: "requestAction" },
			},
		},
	},
});

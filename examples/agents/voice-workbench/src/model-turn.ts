import { assign, createActor, type SnapshotFrom, setup } from "xstate";
import {
	type ModelExchange,
	type ModelFailureFact,
	type ModelResult,
	type ModelToolCall,
	type ModelToolFeedback,
	type ModelTurnResult,
	modelTurn,
} from "./agent-loop";

export const MODEL_TURN_ROUND_LIMIT = 6;

export type ModelTurnTerminalEvent =
	| {
			type: "TURN_COMPLETED";
			turnId: string;
			trace: ModelTurnResult["trace"];
	  }
	| {
			type: "TURN_FAILED";
			turnId: string;
			failure: ModelFailureFact;
			trace: ModelTurnResult["trace"];
	  }
	| {
			type: "CANCELLED";
			turnId: string;
	  }
	| {
			type: "TIMEOUT";
			turnId: string;
	  }
	| {
			type: "ROUND_LIMIT_REACHED";
			turnId: string;
			trace: ModelTurnResult["trace"];
	  };

export type ModelTurnLifecycleInput = {
	turnId: string;
	prompt: { channel: "text" | "speech"; text: string };
};

export type ModelTurnLifecycleContext = ModelTurnLifecycleInput & {
	round: number;
	attemptId: string;
	history: readonly ModelExchange[];
	trace: ModelTurnResult["trace"];
	response: ModelResult | null;
	pendingCall: ModelToolCall | null;
	lastResult: ModelTurnResult | null;
	terminal: ModelTurnTerminalEvent | null;
};

export type ModelTurnLifecycleEvent =
	| {
			type: "MODEL_RESOLVED";
			turnId: string;
			attemptId: string;
			result: ModelResult;
	  }
	| {
			type: "AUTHORIZATION_RESOLVED";
			turnId: string;
			attemptId: string;
			allowed: true;
	  }
	| {
			type: "AUTHORIZATION_RESOLVED";
			turnId: string;
			attemptId: string;
			allowed: false;
			feedback: ModelToolFeedback;
	  }
	| {
			type: "CAPABILITY_RESOLVED";
			turnId: string;
			attemptId: string;
			feedback: ModelToolFeedback;
	  }
	| {
			type: "PORT_FAILED";
			turnId: string;
			attemptId: string;
			failure: ModelFailureFact;
	  }
	| { type: "CANCEL"; turnId: string }
	| { type: "TIMEOUT"; turnId: string };

type FeedbackEvent = Extract<
	ModelTurnLifecycleEvent,
	{ type: "AUTHORIZATION_RESOLVED" | "CAPABILITY_RESOLVED" }
> & { feedback: ModelToolFeedback };

const oneRoundStart = (result: ModelResult) => modelTurn(result).next();

const oneRoundResult = (
	response: ModelResult,
	feedback: ModelToolFeedback,
): ModelTurnResult => {
	const protocol = modelTurn(response);
	const first = protocol.next();
	if (first.done) return first.value;
	return protocol.next(feedback).value as ModelTurnResult;
};

const correlated = (
	context: ModelTurnLifecycleContext,
	event: { turnId: string; attemptId?: string },
): boolean =>
	event.turnId === context.turnId &&
	(event.attemptId === undefined || event.attemptId === context.attemptId);

const appendResult = (
	context: ModelTurnLifecycleContext,
	result: ModelTurnResult,
) => {
	const trace = [...context.trace, ...result.trace];
	return {
		history:
			"exchange" in result
				? [...context.history, result.exchange].slice(-MODEL_TURN_ROUND_LIMIT)
				: context.history,
		trace,
		lastResult: { ...result, trace } as ModelTurnResult,
	};
};

const feedbackResult = (
	context: ModelTurnLifecycleContext,
	event: FeedbackEvent,
): ModelTurnResult | null =>
	context.response ? oneRoundResult(context.response, event.feedback) : null;

const isFeedbackAccepted = (
	context: ModelTurnLifecycleContext,
	event: FeedbackEvent,
): boolean =>
	correlated(context, event) &&
	feedbackResult(context, event)?.accepted === true;

const isFeedbackExhausted = (
	context: ModelTurnLifecycleContext,
	event: FeedbackEvent,
): boolean =>
	correlated(context, event) && context.round >= MODEL_TURN_ROUND_LIMIT;

export const modelTurnMachine = setup({
	types: {
		context: {} as ModelTurnLifecycleContext,
		events: {} as ModelTurnLifecycleEvent,
		input: {} as ModelTurnLifecycleInput,
	},
	actions: {
		storeModelCall: assign(({ context, event }) => {
			if (event.type !== "MODEL_RESOLVED") return context;
			const first = oneRoundStart(event.result);
			if (first.done) return context;
			return {
				...context,
				response: event.result,
				pendingCall: first.value,
			};
		}),
		advanceWithoutCall: assign(({ context, event }) => {
			if (event.type !== "MODEL_RESOLVED") return context;
			const first = oneRoundStart(event.result);
			if (!first.done) return context;
			const round = context.round + 1;
			return {
				...context,
				...appendResult(context, first.value),
				round,
				attemptId: `${context.turnId}:${round}`,
				response: null,
				pendingCall: null,
			};
		}),
		advanceWithFeedback: assign(({ context, event }) => {
			if (
				(event.type !== "AUTHORIZATION_RESOLVED" || event.allowed) &&
				event.type !== "CAPABILITY_RESOLVED"
			) {
				return context;
			}
			const result = feedbackResult(context, event as FeedbackEvent);
			if (!result) return context;
			const round = context.round + 1;
			return {
				...context,
				...appendResult(context, result),
				round,
				attemptId: `${context.turnId}:${round}`,
				response: null,
				pendingCall: null,
			};
		}),
		recordCompletion: assign(({ context, event }) => {
			if (
				(event.type !== "AUTHORIZATION_RESOLVED" || event.allowed) &&
				event.type !== "CAPABILITY_RESOLVED"
			) {
				return context;
			}
			const result = feedbackResult(context, event as FeedbackEvent);
			if (!result) return context;
			const appended = appendResult(context, result);
			return {
				...context,
				...appended,
				terminal: {
					type: "TURN_COMPLETED",
					turnId: context.turnId,
					trace: appended.trace,
				},
			};
		}),
		recordModelFailure: assign(({ context, event }) => {
			if (event.type !== "MODEL_RESOLVED") return context;
			const result = oneRoundStart(event.result);
			if (!result.done) return context;
			const value = result.value;
			if (value.accepted || value.reason !== "model-failed") return context;
			return {
				...context,
				lastResult: value,
				terminal: {
					type: "TURN_FAILED",
					turnId: context.turnId,
					failure: value.failure,
					trace: context.trace,
				},
			};
		}),
		recordPortFailure: assign(({ context, event }) => {
			if (event.type !== "PORT_FAILED") return context;
			const result: ModelTurnResult = {
				accepted: false,
				reason: "model-failed",
				failure: event.failure,
				trace: context.trace,
			};
			return {
				...context,
				lastResult: result,
				terminal: {
					type: "TURN_FAILED",
					turnId: context.turnId,
					failure: event.failure,
					trace: context.trace,
				},
			};
		}),
		recordTimeout: assign(({ context }) => ({
			...context,
			terminal: { type: "TIMEOUT", turnId: context.turnId },
		})),
		recordCancellation: assign(({ context }) => ({
			...context,
			terminal: { type: "CANCELLED", turnId: context.turnId },
		})),
		recordExhaustionWithoutCall: assign(({ context, event }) => {
			if (event.type !== "MODEL_RESOLVED") return context;
			const result = oneRoundStart(event.result);
			if (!result.done) return context;
			const appended = appendResult(context, result.value);
			return {
				...context,
				...appended,
				terminal: {
					type: "ROUND_LIMIT_REACHED",
					turnId: context.turnId,
					trace: appended.trace,
				},
			};
		}),
		recordExhaustionWithFeedback: assign(({ context, event }) => {
			if (
				(event.type !== "AUTHORIZATION_RESOLVED" || event.allowed) &&
				event.type !== "CAPABILITY_RESOLVED"
			) {
				return context;
			}
			const result = feedbackResult(context, event as FeedbackEvent);
			if (!result) return context;
			const appended = appendResult(context, result);
			return {
				...context,
				...appended,
				terminal: {
					type: "ROUND_LIMIT_REACHED",
					turnId: context.turnId,
					trace: appended.trace,
				},
			};
		}),
	},
}).createMachine({
	id: "voice-workbench-model-turn",
	initial: "requesting",
	context: ({ input }) => ({
		...input,
		round: 1,
		attemptId: `${input.turnId}:1`,
		history: [],
		trace: [],
		response: null,
		pendingCall: null,
		lastResult: null,
		terminal: null,
	}),
	on: {
		PORT_FAILED: {
			guard: ({ context, event }) =>
				context.terminal === null && correlated(context, event),
			target: ".failed",
			actions: "recordPortFailure",
		},
		CANCEL: {
			guard: ({ context, event }) =>
				context.terminal === null && event.turnId === context.turnId,
			target: ".cancelled",
			actions: "recordCancellation",
		},
		TIMEOUT: {
			guard: ({ context, event }) =>
				context.terminal === null && event.turnId === context.turnId,
			target: ".timed-out",
			actions: "recordTimeout",
		},
	},
	states: {
		requesting: {
			on: {
				MODEL_RESOLVED: [
					{
						guard: ({ context, event }) =>
							correlated(context, event) &&
							!event.result.ok &&
							event.result.error.kind === "timeout",
						target: "timed-out",
						actions: "recordTimeout",
					},
					{
						guard: ({ context, event }) =>
							correlated(context, event) && !event.result.ok,
						target: "failed",
						actions: "recordModelFailure",
					},
					{
						guard: ({ context, event }) =>
							correlated(context, event) && !oneRoundStart(event.result).done,
						target: "authorizing",
						actions: "storeModelCall",
					},
					{
						guard: ({ context, event }) =>
							correlated(context, event) &&
							context.round >= MODEL_TURN_ROUND_LIMIT,
						target: "exhausted",
						actions: "recordExhaustionWithoutCall",
					},
					{
						guard: ({ context, event }) => correlated(context, event),
						target: "requesting",
						actions: "advanceWithoutCall",
					},
				],
			},
		},
		authorizing: {
			on: {
				AUTHORIZATION_RESOLVED: [
					{
						guard: ({ context, event }) =>
							correlated(context, event) && event.allowed,
						target: "executing",
					},
					{
						guard: ({ context, event }) =>
							!event.allowed && isFeedbackAccepted(context, event),
						target: "completed",
						actions: "recordCompletion",
					},
					{
						guard: ({ context, event }) =>
							!event.allowed && isFeedbackExhausted(context, event),
						target: "exhausted",
						actions: "recordExhaustionWithFeedback",
					},
					{
						guard: ({ context, event }) =>
							!event.allowed && correlated(context, event),
						target: "requesting",
						actions: "advanceWithFeedback",
					},
				],
			},
		},
		executing: {
			on: {
				CAPABILITY_RESOLVED: [
					{
						guard: ({ context, event }) => isFeedbackAccepted(context, event),
						target: "completed",
						actions: "recordCompletion",
					},
					{
						guard: ({ context, event }) => isFeedbackExhausted(context, event),
						target: "exhausted",
						actions: "recordExhaustionWithFeedback",
					},
					{
						guard: ({ context, event }) => correlated(context, event),
						target: "requesting",
						actions: "advanceWithFeedback",
					},
				],
			},
		},
		completed: {},
		failed: {},
		cancelled: {},
		"timed-out": {},
		exhausted: {},
	},
});

export type ModelTurnSnapshot = SnapshotFrom<typeof modelTurnMachine>;

export type ModelTurnPortRequest =
	| {
			type: "request-model";
			turnId: string;
			attemptId: string;
			round: number;
			prompt: ModelTurnLifecycleInput["prompt"];
			history: readonly ModelExchange[];
	  }
	| {
			type: "authorize-call";
			turnId: string;
			attemptId: string;
			prompt: ModelTurnLifecycleInput["prompt"];
			history: readonly ModelExchange[];
			call: ModelToolCall;
	  }
	| {
			type: "execute-call";
			turnId: string;
			attemptId: string;
			call: ModelToolCall;
	  };

export const projectModelTurnPortRequest = (
	snapshot: ModelTurnSnapshot,
): ModelTurnPortRequest | null => {
	const { context } = snapshot;
	if (snapshot.value === "requesting") {
		return {
			type: "request-model",
			turnId: context.turnId,
			attemptId: context.attemptId,
			round: context.round,
			prompt: context.prompt,
			history: context.history,
		};
	}
	if (snapshot.value === "authorizing" && context.pendingCall) {
		return {
			type: "authorize-call",
			turnId: context.turnId,
			attemptId: context.attemptId,
			prompt: context.prompt,
			history: context.history,
			call: context.pendingCall,
		};
	}
	if (snapshot.value === "executing" && context.pendingCall) {
		return {
			type: "execute-call",
			turnId: context.turnId,
			attemptId: context.attemptId,
			call: context.pendingCall,
		};
	}
	return null;
};

export const projectModelTurnTerminalFact = (
	snapshot: ModelTurnSnapshot,
): ModelTurnTerminalEvent | null => snapshot.context.terminal;

export type ModelTurnLifecycleProjection = {
	state:
		| "requesting"
		| "authorizing"
		| "executing"
		| "completed"
		| "failed"
		| "cancelled"
		| "timed-out"
		| "exhausted";
	turnId: string;
	attemptId: string;
	round: number;
	terminal: ModelTurnTerminalEvent | null;
};

export const projectModelTurnLifecycle = (
	snapshot: ModelTurnSnapshot,
): ModelTurnLifecycleProjection => ({
	state: snapshot.value as ModelTurnLifecycleProjection["state"],
	turnId: snapshot.context.turnId,
	attemptId: snapshot.context.attemptId,
	round: snapshot.context.round,
	terminal: snapshot.context.terminal,
});

export const createModelTurnActor = (input: ModelTurnLifecycleInput) =>
	createActor(modelTurnMachine, { input });

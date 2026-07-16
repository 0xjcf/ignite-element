import { assign, createActor, type SnapshotFrom, setup } from "xstate";

export type SpeechDeliveryFact =
	| { type: "speech-delivery-queued"; id: string }
	| { type: "speech-delivery-completed"; id: string }
	| { type: "speech-delivery-muted"; id: string }
	| { type: "speech-delivery-unavailable"; id: string }
	| { type: "speech-delivery-failed"; id: string; message: string }
	| { type: "speech-delivery-cancelled"; id: string };

export type SpeechDeliveryTerminalFact = Exclude<
	SpeechDeliveryFact,
	{ type: "speech-delivery-queued" }
>;

export type SpeechDeliveryState =
	| "pending"
	| "queued"
	| "delivered"
	| "muted"
	| "unavailable"
	| "failed"
	| "cancelled"
	| "disposed";

export type SpeechDeliveryInput = {
	id: string;
	text: string;
	attemptId: string;
	requestSequence: number;
	supported?: boolean;
	muted?: boolean;
};

export type SpeechDeliveryContext = {
	id: string;
	text: string;
	attemptId: string;
	requestSequence: number;
	supported: boolean;
	muted: boolean;
	fact: SpeechDeliveryFact | null;
	terminal: SpeechDeliveryTerminalFact | null;
	portSequence: number;
	portAction: "speak" | "mute" | "unavailable" | "cancel" | "dispose" | null;
};

export type SpeechDeliveryEvent =
	| { type: "QUEUED"; attemptId: string }
	| { type: "DELIVERED"; attemptId: string }
	| { type: "MUTED"; attemptId: string }
	| { type: "UNAVAILABLE"; attemptId: string }
	| { type: "FAIL"; attemptId: string; message: string }
	| { type: "CANCEL"; attemptId: string }
	| { type: "DISPOSE" };

const correlated = (
	context: SpeechDeliveryContext,
	event: { attemptId: string },
): boolean => event.attemptId === context.attemptId;

const terminalFact = (
	context: SpeechDeliveryContext,
	event: SpeechDeliveryEvent,
): SpeechDeliveryTerminalFact | null => {
	switch (event.type) {
		case "DELIVERED":
			return { type: "speech-delivery-completed", id: context.id };
		case "MUTED":
			return { type: "speech-delivery-muted", id: context.id };
		case "UNAVAILABLE":
			return { type: "speech-delivery-unavailable", id: context.id };
		case "FAIL":
			return {
				type: "speech-delivery-failed",
				id: context.id,
				message: event.message,
			};
		case "CANCEL":
			return { type: "speech-delivery-cancelled", id: context.id };
		default:
			return null;
	}
};

export const speechDeliveryMachine = setup({
	types: {
		context: {} as SpeechDeliveryContext,
		events: {} as SpeechDeliveryEvent,
		input: {} as SpeechDeliveryInput,
	},
	actions: {
		recordQueued: assign(({ context }) => ({
			...context,
			fact: { type: "speech-delivery-queued" as const, id: context.id },
			portAction: null,
		})),
		recordTerminal: assign(({ context, event }) => {
			const terminal = terminalFact(context, event);
			return terminal
				? { ...context, fact: terminal, terminal, portAction: null }
				: context;
		}),
		recordCancellation: assign(({ context, event }) => {
			const terminal = terminalFact(context, event);
			return terminal
				? {
						...context,
						fact: terminal,
						terminal,
						portSequence: context.portSequence + 1,
						portAction: "cancel" as const,
					}
				: context;
		}),
		requestDisposal: assign(({ context }) => ({
			...context,
			portSequence: context.portSequence + 1,
			portAction: "dispose" as const,
		})),
	},
}).createMachine({
	id: "voice-workbench-speech-delivery",
	initial: "pending",
	context: ({ input }) => ({
		id: input.id,
		text: input.text,
		attemptId: input.attemptId,
		requestSequence: input.requestSequence,
		supported: input.supported ?? true,
		muted: input.muted ?? false,
		fact: null,
		terminal: null,
		portSequence: 1,
		portAction: input.muted
			? "mute"
			: input.supported === false
				? "unavailable"
				: "speak",
	}),
	on: {
		DISPOSE: {
			guard: ({ context }) => context.terminal === null,
			target: ".disposed",
			actions: "requestDisposal",
		},
	},
	states: {
		pending: {
			on: {
				QUEUED: {
					guard: ({ context, event }) => correlated(context, event),
					target: "queued",
					actions: "recordQueued",
				},
				DELIVERED: {
					guard: ({ context, event }) => correlated(context, event),
					target: "delivered",
					actions: "recordTerminal",
				},
				MUTED: {
					guard: ({ context, event }) => correlated(context, event),
					target: "muted",
					actions: "recordTerminal",
				},
				UNAVAILABLE: {
					guard: ({ context, event }) => correlated(context, event),
					target: "unavailable",
					actions: "recordTerminal",
				},
				FAIL: {
					guard: ({ context, event }) => correlated(context, event),
					target: "failed",
					actions: "recordTerminal",
				},
				CANCEL: {
					guard: ({ context, event }) => correlated(context, event),
					target: "cancelled",
					actions: "recordCancellation",
				},
			},
		},
		queued: {
			on: {
				DELIVERED: {
					guard: ({ context, event }) => correlated(context, event),
					target: "delivered",
					actions: "recordTerminal",
				},
				FAIL: {
					guard: ({ context, event }) => correlated(context, event),
					target: "failed",
					actions: "recordTerminal",
				},
				CANCEL: {
					guard: ({ context, event }) => correlated(context, event),
					target: "cancelled",
					actions: "recordCancellation",
				},
			},
		},
		delivered: {},
		muted: {},
		unavailable: {},
		failed: {},
		cancelled: {},
		disposed: {},
	},
});

export type SpeechDeliverySnapshot = SnapshotFrom<typeof speechDeliveryMachine>;

export type SpeechDeliveryPortRequest = {
	type: Exclude<SpeechDeliveryContext["portAction"], null>;
	id: string;
	text: string;
	attemptId: string;
	requestSequence: number;
	sequence: number;
};

export const projectSpeechDeliveryPortRequest = (
	snapshot: SpeechDeliverySnapshot,
): SpeechDeliveryPortRequest | null =>
	snapshot.context.portAction
		? {
				type: snapshot.context.portAction,
				id: snapshot.context.id,
				text: snapshot.context.text,
				attemptId: snapshot.context.attemptId,
				requestSequence: snapshot.context.requestSequence,
				sequence: snapshot.context.portSequence,
			}
		: null;

export const projectSpeechDeliveryFact = (
	snapshot: SpeechDeliverySnapshot,
): SpeechDeliveryFact | null => snapshot.context.fact;

export const projectSpeechDeliveryTerminalFact = (
	snapshot: SpeechDeliverySnapshot,
): SpeechDeliveryTerminalFact | null => snapshot.context.terminal;

export type SpeechDeliveryLifecycleProjection = {
	state: SpeechDeliveryState;
	id: string;
	text: string;
	attemptId: string;
	requestSequence: number;
	fact: SpeechDeliveryFact | null;
	terminal: SpeechDeliveryTerminalFact | null;
};

export const projectSpeechDeliveryLifecycle = (
	snapshot: SpeechDeliverySnapshot,
): SpeechDeliveryLifecycleProjection => ({
	state: snapshot.value as SpeechDeliveryState,
	id: snapshot.context.id,
	text: snapshot.context.text,
	attemptId: snapshot.context.attemptId,
	requestSequence: snapshot.context.requestSequence,
	fact: projectSpeechDeliveryFact(snapshot),
	terminal: projectSpeechDeliveryTerminalFact(snapshot),
});

export const createSpeechDeliveryActor = (input: SpeechDeliveryInput) =>
	createActor(speechDeliveryMachine, { input });

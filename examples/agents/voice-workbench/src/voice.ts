import { assign, createActor, type SnapshotFrom, setup } from "xstate";

export type VoiceCaptureFact =
	| { type: "voice-unsupported" }
	| { type: "voice-idle" }
	| { type: "voice-listening" }
	| { type: "voice-transcript"; text: string; final: boolean }
	| { type: "voice-cancelled" }
	| { type: "voice-permission-denied"; message: string }
	| { type: "voice-error"; message: string };

export type VoiceCaptureState =
	| "checking"
	| "unsupported"
	| "unavailable"
	| "idle"
	| "listening"
	| "transcript"
	| "consumed"
	| "cancelled"
	| "permission-denied"
	| "failed"
	| "disposed";

export type VoiceCaptureInput = {
	supported: boolean;
	initialError?: string;
};

export type VoiceCaptureContext = VoiceCaptureInput & {
	sequence: number;
	attemptId: string | null;
	transcript: string;
	final: boolean;
	message: string | null;
	portSequence: number;
	portAction: "start" | "cancel" | "dispose" | null;
};

export type VoiceCaptureEvent =
	| { type: "START" }
	| { type: "RESET" }
	| { type: "RETRY" }
	| {
			type: "RESULT";
			attemptId: string;
			text: string;
			final: boolean;
	  }
	| { type: "END"; attemptId: string }
	| { type: "PERMISSION_DENIED"; attemptId: string; message: string }
	| { type: "FAIL"; attemptId: string; message: string }
	| { type: "CANCEL" }
	| { type: "CONSUME"; attemptId: string }
	| { type: "DISPOSE" };

const nextAttempt = (context: VoiceCaptureContext) => {
	const sequence = context.sequence + 1;
	return {
		...context,
		sequence,
		attemptId: `voice:${sequence}`,
		transcript: "",
		final: false,
		message: null,
		portSequence: context.portSequence + 1,
		portAction: "start" as const,
	};
};

const correlated = (
	context: VoiceCaptureContext,
	event: { attemptId: string },
): boolean => event.attemptId === context.attemptId;

export const voiceCaptureMachine = setup({
	types: {
		context: {} as VoiceCaptureContext,
		events: {} as VoiceCaptureEvent,
		input: {} as VoiceCaptureInput,
	},
	actions: {
		beginAttempt: assign(({ context }) => nextAttempt(context)),
		recordTranscript: assign(({ context, event }) =>
			event.type === "RESULT"
				? {
						...context,
						transcript: event.text.trim(),
						final: event.final,
						portAction: null,
					}
				: context,
		),
		recordPermissionDenial: assign(({ context, event }) =>
			event.type === "PERMISSION_DENIED"
				? { ...context, message: event.message, portAction: null }
				: context,
		),
		recordFailure: assign(({ context, event }) =>
			event.type === "FAIL"
				? { ...context, message: event.message, portAction: null }
				: context,
		),
		clearCapture: assign(({ context }) => ({
			...context,
			attemptId: null,
			transcript: "",
			final: false,
			message: null,
			portAction: null,
		})),
		requestCancellation: assign(({ context }) => ({
			...context,
			portSequence: context.portSequence + 1,
			portAction: "cancel" as const,
		})),
		requestDisposal: assign(({ context }) => ({
			...context,
			portSequence: context.portSequence + 1,
			portAction: "dispose" as const,
		})),
	},
}).createMachine({
	id: "voice-workbench-voice-capture",
	initial: "checking",
	context: ({ input }) => ({
		...input,
		sequence: 0,
		attemptId: null,
		transcript: "",
		final: false,
		message: input.initialError ?? null,
		portSequence: 0,
		portAction: null,
	}),
	on: {
		DISPOSE: {
			guard: ({ context }) => context.portAction !== "dispose",
			target: ".disposed",
			actions: "requestDisposal",
		},
	},
	states: {
		checking: {
			always: [
				{
					guard: ({ context }) => Boolean(context.initialError),
					target: "unavailable",
				},
				{ guard: ({ context }) => context.supported, target: "idle" },
				{ target: "unsupported" },
			],
		},
		unsupported: {},
		unavailable: {},
		idle: {
			on: { START: { target: "listening", actions: "beginAttempt" } },
		},
		listening: {
			on: {
				RESULT: {
					guard: ({ context, event }) => correlated(context, event),
					target: "transcript",
					actions: "recordTranscript",
				},
				END: {
					guard: ({ context, event }) => correlated(context, event),
					target: "idle",
					actions: "clearCapture",
				},
				PERMISSION_DENIED: {
					guard: ({ context, event }) => correlated(context, event),
					target: "permission-denied",
					actions: "recordPermissionDenial",
				},
				FAIL: {
					guard: ({ context, event }) => correlated(context, event),
					target: "failed",
					actions: "recordFailure",
				},
				CANCEL: {
					target: "cancelled",
					actions: "requestCancellation",
				},
			},
		},
		transcript: {
			on: {
				RESULT: {
					guard: ({ context, event }) => correlated(context, event),
					actions: "recordTranscript",
				},
				END: [
					{
						guard: ({ context, event }) =>
							correlated(context, event) && !context.final,
						target: "idle",
						actions: "clearCapture",
					},
				],
				CONSUME: {
					guard: ({ context, event }) =>
						correlated(context, event) &&
						context.final &&
						context.transcript.trim().length > 0,
					target: "consumed",
				},
				CANCEL: {
					target: "cancelled",
					actions: "requestCancellation",
				},
			},
		},
		consumed: {
			on: {
				RESET: { target: "idle", actions: "clearCapture" },
				START: { target: "listening", actions: "beginAttempt" },
			},
		},
		cancelled: {
			on: {
				RESET: { target: "idle", actions: "clearCapture" },
				RETRY: { target: "listening", actions: "beginAttempt" },
				START: { target: "listening", actions: "beginAttempt" },
			},
		},
		"permission-denied": {
			on: {
				RESET: { target: "idle", actions: "clearCapture" },
				RETRY: { target: "listening", actions: "beginAttempt" },
				START: { target: "listening", actions: "beginAttempt" },
			},
		},
		failed: {
			on: {
				RESET: { target: "idle", actions: "clearCapture" },
				RETRY: { target: "listening", actions: "beginAttempt" },
				START: { target: "listening", actions: "beginAttempt" },
			},
		},
		disposed: {},
	},
});

export type VoiceCaptureSnapshot = SnapshotFrom<typeof voiceCaptureMachine>;

export type VoiceCapturePortRequest = {
	type: "start" | "cancel" | "dispose";
	attemptId: string | null;
	sequence: number;
};

export const projectVoiceCapturePortRequest = (
	snapshot: VoiceCaptureSnapshot,
): VoiceCapturePortRequest | null =>
	snapshot.context.portAction
		? {
				type: snapshot.context.portAction,
				attemptId: snapshot.context.attemptId,
				sequence: snapshot.context.portSequence,
			}
		: null;

export const projectVoiceCaptureFact = (
	snapshot: VoiceCaptureSnapshot,
): VoiceCaptureFact => {
	const { context, value } = snapshot;
	switch (value) {
		case "checking":
		case "idle":
		case "consumed":
		case "disposed":
			return { type: "voice-idle" };
		case "unsupported":
			return { type: "voice-unsupported" };
		case "listening":
			return { type: "voice-listening" };
		case "transcript":
			return {
				type: "voice-transcript",
				text: context.transcript,
				final: context.final,
			};
		case "cancelled":
			return { type: "voice-cancelled" };
		case "permission-denied":
			return {
				type: "voice-permission-denied",
				message: context.message ?? "Microphone access was denied.",
			};
		case "unavailable":
		case "failed":
			return {
				type: "voice-error",
				message: context.message ?? "Speech recognition failed.",
			};
		default:
			return { type: "voice-error", message: "Unknown voice capture state." };
	}
};

export type VoiceCaptureLifecycleProjection = {
	state: VoiceCaptureState;
	attemptId: string | null;
	sequence: number;
	fact: VoiceCaptureFact;
};

export const canStartVoiceCapture = (
	lifecycle: Pick<VoiceCaptureLifecycleProjection, "state"> | null,
): boolean => {
	switch (lifecycle?.state) {
		case "idle":
		case "consumed":
		case "cancelled":
		case "permission-denied":
		case "failed":
			return true;
		default:
			return false;
	}
};

export const projectVoiceCaptureLifecycle = (
	snapshot: VoiceCaptureSnapshot,
): VoiceCaptureLifecycleProjection => ({
	state: snapshot.value as VoiceCaptureState,
	attemptId: snapshot.context.attemptId,
	sequence: snapshot.context.sequence,
	fact: projectVoiceCaptureFact(snapshot),
});

export const createVoiceCaptureActor = (input: VoiceCaptureInput) =>
	createActor(voiceCaptureMachine, { input });

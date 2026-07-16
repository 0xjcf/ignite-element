import { assign, createActor, type SnapshotFrom, setup } from "xstate";

export type SpeechRecognitionResultLike = {
	0?: { transcript?: string };
	isFinal?: boolean;
};

export type SpeechRecognitionLike = {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	onend: (() => void) | null;
	onerror: ((event: { error?: string; message?: string }) => void) | null;
	onresult:
		| ((event: { results: ArrayLike<SpeechRecognitionResultLike> }) => void)
		| null;
	start(): void;
	stop(): void;
	abort(): void;
};

export type VoiceCaptureFact =
	| { type: "voice-unsupported" }
	| { type: "voice-idle" }
	| { type: "voice-listening" }
	| { type: "voice-transcript"; text: string; final: boolean }
	| { type: "voice-cancelled" }
	| { type: "voice-permission-denied"; message: string }
	| { type: "voice-error"; message: string };

export type VoicePromptResult =
	| {
			ok: true;
			attemptId: string;
			prompt: { channel: "speech"; text: string };
	  }
	| { ok: false; fact: VoiceCaptureFact };

export type VoiceCapture = {
	getFact(): VoiceCaptureFact;
	getLifecycle(): VoiceCaptureLifecycleProjection;
	start(): VoiceCaptureFact;
	cancel(): VoiceCaptureFact;
	reset(): VoiceCaptureFact;
	retry(): VoiceCaptureFact;
	useTranscript(attemptId: string): VoicePromptResult;
	subscribe(listener: (fact: VoiceCaptureFact) => void): {
		unsubscribe(): void;
	};
	subscribeLifecycle(
		listener: (lifecycle: VoiceCaptureLifecycleProjection) => void,
	): { unsubscribe(): void };
	dispose(): void;
};

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
					target: "failed",
				},
				{ guard: ({ context }) => context.supported, target: "idle" },
				{ target: "unsupported" },
			],
		},
		unsupported: {},
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
			},
		},
		failed: {
			on: {
				RESET: { target: "idle", actions: "clearCapture" },
				RETRY: { target: "listening", actions: "beginAttempt" },
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
	state: string;
	attemptId: string | null;
	sequence: number;
	fact: VoiceCaptureFact;
};

export const projectVoiceCaptureLifecycle = (
	snapshot: VoiceCaptureSnapshot,
): VoiceCaptureLifecycleProjection => ({
	state: String(snapshot.value),
	attemptId: snapshot.context.attemptId,
	sequence: snapshot.context.sequence,
	fact: projectVoiceCaptureFact(snapshot),
});

export const createVoiceCaptureActor = (input: VoiceCaptureInput) =>
	createActor(voiceCaptureMachine, { input });

type RecognitionConstructor = new () => SpeechRecognitionLike;

const defaultRecognition = (): SpeechRecognitionLike | null => {
	const scope = globalThis as typeof globalThis & {
		SpeechRecognition?: RecognitionConstructor;
		webkitSpeechRecognition?: RecognitionConstructor;
	};
	const Recognition =
		scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
	return Recognition ? new Recognition() : null;
};

const isPermissionDenial = (error: unknown): boolean =>
	(typeof DOMException !== "undefined" &&
		error instanceof DOMException &&
		error.name === "NotAllowedError") ||
	(typeof error === "object" &&
		error !== null &&
		"name" in error &&
		error.name === "NotAllowedError");

/** Browser host driver for the host-agnostic voice-capture machine. */
export function createBrowserVoiceCapture(): VoiceCapture {
	let recognition: SpeechRecognitionLike | null = null;
	let initialError: string | undefined;
	try {
		recognition = defaultRecognition();
	} catch {
		initialError = "Speech recognition could not be initialized.";
	}
	if (recognition) {
		recognition.continuous = false;
		recognition.interimResults = true;
		recognition.lang = "en-US";
	}

	const actor = createVoiceCaptureActor({
		supported: recognition !== null,
		...(initialError ? { initialError } : {}),
	});
	const listeners = new Set<(fact: VoiceCaptureFact) => void>();
	const lifecycleListeners = new Set<
		(lifecycle: VoiceCaptureLifecycleProjection) => void
	>();
	const handledPorts = new Set<string>();
	let fact: VoiceCaptureFact = { type: "voice-idle" };
	let lifecycle = projectVoiceCaptureLifecycle(actor.getSnapshot());

	const publish = (next: VoiceCaptureFact) => {
		fact = next;
		for (const listener of listeners) listener(fact);
	};

	const bindRecognition = (attemptId: string) => {
		if (!recognition) return;
		recognition.onresult = (event) => {
			const transcripts: string[] = [];
			let final = event.results.length > 0;
			for (let index = 0; index < event.results.length; index += 1) {
				const result = event.results[index];
				const transcript = result?.[0]?.transcript?.trim();
				if (transcript) transcripts.push(transcript);
				if (!result?.isFinal) final = false;
			}
			const text = transcripts.join(" ").trim();
			if (text) actor.send({ type: "RESULT", attemptId, text, final });
		};
		recognition.onerror = (event) => {
			if (
				event.error === "not-allowed" ||
				event.error === "service-not-allowed"
			) {
				actor.send({
					type: "PERMISSION_DENIED",
					attemptId,
					message: "Microphone access was denied.",
				});
				return;
			}
			actor.send({
				type: "FAIL",
				attemptId,
				message: event.message?.trim() || "Speech recognition failed.",
			});
		};
		recognition.onend = () => actor.send({ type: "END", attemptId });
	};

	const subscription = actor.subscribe((snapshot) => {
		lifecycle = projectVoiceCaptureLifecycle(snapshot);
		publish(projectVoiceCaptureFact(snapshot));
		for (const listener of lifecycleListeners) listener(lifecycle);
		const request = projectVoiceCapturePortRequest(snapshot);
		if (!request) return;
		const key = `${request.type}:${request.sequence}`;
		if (handledPorts.has(key)) return;
		handledPorts.add(key);
		switch (request.type) {
			case "start":
				if (!recognition || !request.attemptId) return;
				bindRecognition(request.attemptId);
				try {
					recognition.start();
				} catch (error) {
					actor.send({
						type: isPermissionDenial(error) ? "PERMISSION_DENIED" : "FAIL",
						attemptId: request.attemptId,
						message: isPermissionDenial(error)
							? "Microphone access was denied."
							: "Speech recognition could not start.",
					});
				}
				return;
			case "cancel":
				if (!recognition) return;
				try {
					recognition.abort();
				} catch {
					if (request.attemptId) {
						actor.send({
							type: "FAIL",
							attemptId: request.attemptId,
							message: "Speech recognition could not be cancelled.",
						});
					}
				}
				return;
			case "dispose":
				if (!recognition) return;
				recognition.onresult = null;
				recognition.onerror = null;
				recognition.onend = null;
				try {
					recognition.abort();
				} catch {
					// Browser disposal is an idempotent best-effort port effect.
				}
		}
	});
	actor.start();

	return {
		getFact: () => fact,
		getLifecycle: () => lifecycle,
		start: () => {
			actor.send({ type: "START" });
			return fact;
		},
		cancel: () => {
			actor.send({ type: "CANCEL" });
			return fact;
		},
		reset: () => {
			actor.send({ type: "RESET" });
			return fact;
		},
		retry: () => {
			actor.send({ type: "RETRY" });
			return fact;
		},
		useTranscript: (attemptId) => {
			actor.send({ type: "CONSUME", attemptId });
			const snapshot = actor.getSnapshot();
			if (
				snapshot.value !== "consumed" ||
				snapshot.context.attemptId !== attemptId
			) {
				return { ok: false, fact: projectVoiceCaptureFact(snapshot) };
			}
			return {
				ok: true,
				attemptId,
				prompt: {
					channel: "speech",
					text: snapshot.context.transcript.trim(),
				},
			};
		},
		subscribe: (listener) => {
			listeners.add(listener);
			return { unsubscribe: () => listeners.delete(listener) };
		},
		subscribeLifecycle: (listener) => {
			lifecycleListeners.add(listener);
			return { unsubscribe: () => lifecycleListeners.delete(listener) };
		},
		dispose: () => {
			actor.send({ type: "DISPOSE" });
			listeners.clear();
			lifecycleListeners.clear();
			subscription.unsubscribe();
			actor.stop();
		},
	};
}

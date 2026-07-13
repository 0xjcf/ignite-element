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
			prompt: { channel: "speech"; text: string };
	  }
	| { ok: false; fact: VoiceCaptureFact };

export type VoiceCapture = {
	getFact(): VoiceCaptureFact;
	start(): VoiceCaptureFact;
	cancel(): VoiceCaptureFact;
	useTranscript(): VoicePromptResult;
	subscribe(listener: (fact: VoiceCaptureFact) => void): {
		unsubscribe(): void;
	};
	dispose(): void;
};

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

/**
 * Capability-gated browser transcription. It only produces speech-modality
 * prompts; the Ignite actor remains the authority that admits the prompt.
 */
export function createBrowserVoiceCapture(
	options: {
		createRecognition?: () => SpeechRecognitionLike | null;
		language?: string;
	} = {},
): VoiceCapture {
	let recognition: SpeechRecognitionLike | null = null;
	let fact: VoiceCaptureFact;
	try {
		recognition = (options.createRecognition ?? defaultRecognition)();
		fact = recognition ? { type: "voice-idle" } : { type: "voice-unsupported" };
	} catch {
		fact = {
			type: "voice-error",
			message: "Speech recognition could not be initialized.",
		};
	}

	const listeners = new Set<(nextFact: VoiceCaptureFact) => void>();
	let disposed = false;
	const publish = (nextFact: VoiceCaptureFact): VoiceCaptureFact => {
		fact = nextFact;
		for (const listener of listeners) listener(fact);
		return fact;
	};

	if (recognition) {
		recognition.continuous = false;
		recognition.interimResults = true;
		recognition.lang = options.language?.trim() || "en-US";
		recognition.onresult = (event) => {
			if (disposed) return;
			const transcripts: string[] = [];
			let final = event.results.length > 0;
			for (let index = 0; index < event.results.length; index += 1) {
				const result = event.results[index];
				const transcript = result?.[0]?.transcript?.trim();
				if (transcript) transcripts.push(transcript);
				if (!result?.isFinal) final = false;
			}
			const text = transcripts.join(" ").trim();
			if (text) publish({ type: "voice-transcript", text, final });
		};
		recognition.onerror = (event) => {
			if (disposed || fact.type === "voice-cancelled") return;
			if (
				event.error === "not-allowed" ||
				event.error === "service-not-allowed"
			) {
				publish({
					type: "voice-permission-denied",
					message: "Microphone access was denied.",
				});
				return;
			}
			publish({
				type: "voice-error",
				message: event.message?.trim() || "Speech recognition failed.",
			});
		};
		recognition.onend = () => {
			if (!disposed && fact.type === "voice-listening") {
				publish({ type: "voice-idle" });
			}
		};
	}

	return {
		getFact: () => fact,
		start: () => {
			if (!recognition || disposed) return fact;
			publish({ type: "voice-listening" });
			try {
				recognition.start();
				return fact;
			} catch (error) {
				if (isPermissionDenial(error)) {
					return publish({
						type: "voice-permission-denied",
						message: "Microphone access was denied.",
					});
				}
				return publish({
					type: "voice-error",
					message: "Speech recognition could not start.",
				});
			}
		},
		cancel: () => {
			if (!recognition || disposed) return fact;
			const cancelled = publish({ type: "voice-cancelled" });
			try {
				recognition.abort();
			} catch {
				return publish({
					type: "voice-error",
					message: "Speech recognition could not be cancelled.",
				});
			}
			return cancelled;
		},
		useTranscript: () => {
			if (
				fact.type !== "voice-transcript" ||
				!fact.final ||
				fact.text.trim().length === 0
			) {
				return { ok: false, fact };
			}
			return {
				ok: true,
				prompt: { channel: "speech", text: fact.text.trim() },
			};
		},
		subscribe: (listener) => {
			listeners.add(listener);
			return { unsubscribe: () => listeners.delete(listener) };
		},
		dispose: () => {
			if (disposed) return;
			disposed = true;
			listeners.clear();
			if (!recognition) return;
			recognition.onresult = null;
			recognition.onerror = null;
			recognition.onend = null;
			try {
				recognition.abort();
			} catch {
				// Disposal is idempotent and best-effort at the browser boundary.
			}
		},
	};
}

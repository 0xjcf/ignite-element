import type {
	VoiceCapturePort,
	VoiceCapturePortReceipt,
	WorkbenchDisposable,
} from "../ports";

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
	abort(): void;
};

type RecognitionConstructor = new () => SpeechRecognitionLike;

const recognitionConstructor = (): RecognitionConstructor | null => {
	const scope = globalThis as typeof globalThis & {
		SpeechRecognition?: RecognitionConstructor;
		webkitSpeechRecognition?: RecognitionConstructor;
	};
	return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
};

const isPermissionDenial = (error: unknown): boolean =>
	(typeof DOMException !== "undefined" &&
		error instanceof DOMException &&
		error.name === "NotAllowedError") ||
	(typeof error === "object" &&
		error !== null &&
		"name" in error &&
		error.name === "NotAllowedError");

export const isBrowserVoiceCaptureSupported = (): boolean =>
	recognitionConstructor() !== null;

export const createBrowserVoiceCapturePort = (): VoiceCapturePort => {
	let active: WorkbenchDisposable | null = null;

	return (request, emit) => {
		if (request.type !== "start") {
			active?.dispose();
			active = null;
			return;
		}
		const attemptId = request.attemptId;
		if (!attemptId) return;
		const Recognition = recognitionConstructor();
		if (!Recognition) {
			emit({
				type: "FAIL",
				attemptId,
				message: "Speech recognition is unavailable in this browser.",
			});
			return;
		}

		let recognition: SpeechRecognitionLike;
		try {
			recognition = new Recognition();
		} catch {
			emit({
				type: "FAIL",
				attemptId,
				message: "Speech recognition could not be initialized.",
			});
			return;
		}
		recognition.continuous = false;
		recognition.interimResults = true;
		recognition.lang = "en-US";
		let disposed = false;
		const publish = (receipt: VoiceCapturePortReceipt) => {
			if (!disposed) emit(receipt);
		};
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
			if (text) publish({ type: "RESULT", attemptId, text, final });
		};
		recognition.onerror = (event) => {
			if (
				event.error === "not-allowed" ||
				event.error === "service-not-allowed"
			) {
				publish({
					type: "PERMISSION_DENIED",
					attemptId,
					message: "Microphone access was denied.",
				});
				return;
			}
			publish({
				type: "FAIL",
				attemptId,
				message: event.message?.trim() || "Speech recognition failed.",
			});
		};
		recognition.onend = () => publish({ type: "END", attemptId });

		const effect: WorkbenchDisposable = {
			dispose() {
				if (disposed) return;
				disposed = true;
				recognition.onresult = null;
				recognition.onerror = null;
				recognition.onend = null;
				try {
					recognition.abort();
				} catch {
					// Browser teardown is best-effort and remains outside actor truth.
				}
			},
		};
		active?.dispose();
		active = effect;
		try {
			recognition.start();
		} catch (error) {
			publish({
				type: isPermissionDenial(error) ? "PERMISSION_DENIED" : "FAIL",
				attemptId,
				message: isPermissionDenial(error)
					? "Microphone access was denied."
					: "Speech recognition could not start.",
			});
		}
		return effect;
	};
};

import { describe, expect, it, vi } from "vitest";
import { createBrowserVoiceCapture, type SpeechRecognitionLike } from "./voice";

function createRecognition() {
	const recognition: SpeechRecognitionLike = {
		continuous: false,
		interimResults: false,
		lang: "",
		onend: null,
		onerror: null,
		onresult: null,
		abort: vi.fn(),
		start: vi.fn(),
		stop: vi.fn(),
	};
	return recognition;
}

describe("browser voice capture", () => {
	it("reports unsupported browsers as a capability fact", () => {
		const voice = createBrowserVoiceCapture({
			createRecognition: () => null,
		});

		expect(voice.getFact()).toEqual({ type: "voice-unsupported" });
		expect(voice.start()).toEqual({ type: "voice-unsupported" });
		expect(voice.useTranscript()).toEqual({
			ok: false,
			fact: { type: "voice-unsupported" },
		});
	});

	it("turns a final transcript into the same semantic prompt with speech modality", () => {
		const recognition = createRecognition();
		const facts: unknown[] = [];
		const voice = createBrowserVoiceCapture({
			createRecognition: () => recognition,
			language: "en-US",
		});
		voice.subscribe((fact) => facts.push(fact));

		expect(voice.start()).toEqual({ type: "voice-listening" });
		expect(recognition.start).toHaveBeenCalledOnce();
		expect(recognition.lang).toBe("en-US");
		recognition.onresult?.({
			results: [
				{ 0: { transcript: "  Create a launch checklist  " }, isFinal: true },
			],
		});

		expect(voice.getFact()).toEqual({
			type: "voice-transcript",
			text: "Create a launch checklist",
			final: true,
		});
		expect(voice.useTranscript()).toEqual({
			ok: true,
			prompt: {
				channel: "speech",
				text: "Create a launch checklist",
			},
		});
		expect(facts).toContainEqual({
			type: "voice-transcript",
			text: "Create a launch checklist",
			final: true,
		});
	});

	it("cancels capture without submitting the partial transcript", () => {
		const recognition = createRecognition();
		const voice = createBrowserVoiceCapture({
			createRecognition: () => recognition,
		});

		voice.start();
		recognition.onresult?.({
			results: [{ 0: { transcript: "partial" }, isFinal: false }],
		});

		expect(voice.cancel()).toEqual({ type: "voice-cancelled" });
		expect(recognition.abort).toHaveBeenCalledOnce();
		expect(voice.useTranscript()).toEqual({
			ok: false,
			fact: { type: "voice-cancelled" },
		});
	});

	it("returns permission denial and recognition failures as facts", () => {
		const deniedRecognition = createRecognition();
		deniedRecognition.start = vi.fn(() => {
			throw new DOMException("Microphone denied", "NotAllowedError");
		});
		const denied = createBrowserVoiceCapture({
			createRecognition: () => deniedRecognition,
		});

		expect(() => denied.start()).not.toThrow();
		expect(denied.getFact()).toEqual({
			type: "voice-permission-denied",
			message: "Microphone access was denied.",
		});

		const failedRecognition = createRecognition();
		const failed = createBrowserVoiceCapture({
			createRecognition: () => failedRecognition,
		});
		failed.start();
		failedRecognition.onerror?.({ error: "network", message: "Offline" });

		expect(failed.getFact()).toEqual({
			type: "voice-error",
			message: "Offline",
		});
	});
});

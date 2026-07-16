import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createBrowserVoiceCapture,
	createVoiceCaptureActor,
	projectVoiceCaptureLifecycle,
	projectVoiceCapturePortRequest,
	type SpeechRecognitionLike,
} from "./voice";

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

const installRecognition = (recognition: SpeechRecognitionLike) => {
	vi.stubGlobal(
		"SpeechRecognition",
		// biome-ignore lint/complexity/useArrowFunction: constructor mocks must be constructable.
		vi.fn(function () {
			return recognition;
		}),
	);
};

afterEach(() => vi.unstubAllGlobals());

describe("browser voice capture", () => {
	it("uses an attempt-correlated serializable machine for consume and disposal", () => {
		const actor = createVoiceCaptureActor({ supported: true });
		actor.start();
		expect(actor.getSnapshot().value).toBe("idle");

		actor.send({ type: "START" });
		const attemptId = actor.getSnapshot().context.attemptId;
		expect(actor.getSnapshot().value).toBe("listening");
		expect(attemptId).toBe("voice:1");
		expect(() => JSON.stringify(actor.getSnapshot().context)).not.toThrow();
		expect(projectVoiceCapturePortRequest(actor.getSnapshot())).toEqual({
			type: "start",
			attemptId: "voice:1",
			sequence: 1,
		});

		actor.send({
			type: "RESULT",
			attemptId: "voice:stale",
			text: "stale transcript",
			final: true,
		});
		expect(actor.getSnapshot().value).toBe("listening");
		actor.send({
			type: "RESULT",
			attemptId: attemptId ?? "missing",
			text: "  Create a launch checklist  ",
			final: true,
		});
		expect(actor.getSnapshot()).toMatchObject({
			value: "transcript",
			context: {
				transcript: "Create a launch checklist",
				final: true,
			},
		});

		actor.send({ type: "CONSUME" });
		expect(actor.getSnapshot().value).toBe("consumed");
		expect(projectVoiceCaptureLifecycle(actor.getSnapshot())).toMatchObject({
			state: "consumed",
			attemptId: "voice:1",
			fact: { type: "voice-idle" },
		});
		actor.send({ type: "DISPOSE" });
		actor.send({ type: "DISPOSE" });
		expect(actor.getSnapshot().value).toBe("disposed");
		actor.stop();
	});

	it("reports unsupported browsers as a capability fact", () => {
		vi.stubGlobal("SpeechRecognition", undefined);
		vi.stubGlobal("webkitSpeechRecognition", undefined);
		const voice = createBrowserVoiceCapture();

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
		installRecognition(recognition);
		const voice = createBrowserVoiceCapture();
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
		installRecognition(recognition);
		const voice = createBrowserVoiceCapture();

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
		installRecognition(deniedRecognition);
		const denied = createBrowserVoiceCapture();

		expect(() => denied.start()).not.toThrow();
		expect(denied.getFact()).toEqual({
			type: "voice-permission-denied",
			message: "Microphone access was denied.",
		});

		const failedRecognition = createRecognition();
		installRecognition(failedRecognition);
		const failed = createBrowserVoiceCapture();
		failed.start();
		failedRecognition.onerror?.({ error: "network", message: "Offline" });

		expect(failed.getFact()).toEqual({
			type: "voice-error",
			message: "Offline",
		});
	});
});

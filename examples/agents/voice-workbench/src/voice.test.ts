import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createBrowserVoiceCapture,
	createVoiceCaptureActor,
	projectVoiceCaptureLifecycle,
	projectVoiceCapturePortRequest,
	type SpeechRecognitionLike,
	voiceCaptureMachine,
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
	it("declares the exact voice-capture lifecycle state shape", () => {
		expect(Object.keys(voiceCaptureMachine.config.states).sort()).toEqual([
			"cancelled",
			"checking",
			"consumed",
			"disposed",
			"failed",
			"idle",
			"listening",
			"permission-denied",
			"transcript",
			"unavailable",
			"unsupported",
		]);
	});

	it("classifies adapter initialization failure as unavailable", () => {
		const actor = createVoiceCaptureActor({
			supported: false,
			initialError: "Speech recognition could not be initialized.",
		}).start();

		expect(projectVoiceCaptureLifecycle(actor.getSnapshot())).toEqual({
			state: "unavailable",
			attemptId: null,
			sequence: 0,
			fact: {
				type: "voice-error",
				message: "Speech recognition could not be initialized.",
			},
		});
		expect(projectVoiceCapturePortRequest(actor.getSnapshot())).toBeNull();
		actor.stop();
	});

	it("keeps initialization failure inert to repeated START intent", () => {
		const actor = createVoiceCaptureActor({
			supported: false,
			initialError: "Speech recognition could not be initialized.",
		}).start();

		actor.send({ type: "START" });
		expect(actor.getSnapshot()).toMatchObject({
			value: "unavailable",
			context: {
				attemptId: null,
				sequence: 0,
				portSequence: 0,
				portAction: null,
			},
		});
		expect(projectVoiceCapturePortRequest(actor.getSnapshot())).toBeNull();
		actor.stop();
	});

	it("keeps a real browser constructor failure unavailable", () => {
		// biome-ignore lint/complexity/useArrowFunction: constructor mocks must be constructable.
		const Recognition = vi.fn(function () {
			throw new Error("Speech recognition constructor failed.");
		});
		vi.stubGlobal("SpeechRecognition", Recognition);
		const voice = createBrowserVoiceCapture();

		expect(Recognition).toHaveBeenCalledOnce();
		voice.start();
		expect(voice.getLifecycle()).toEqual({
			state: "unavailable",
			attemptId: null,
			sequence: 0,
			fact: {
				type: "voice-error",
				message: "Speech recognition could not be initialized.",
			},
		});
		voice.dispose();
	});

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
			text: "  Create a launch  ",
			final: false,
		});
		expect(actor.getSnapshot()).toMatchObject({
			value: "transcript",
			context: {
				transcript: "Create a launch",
				final: false,
			},
		});
		actor.send({ type: "CONSUME", attemptId: attemptId ?? "missing" });
		expect(actor.getSnapshot().value).toBe("transcript");
		actor.send({
			type: "RESULT",
			attemptId: attemptId ?? "missing",
			text: "  Create a launch checklist  ",
			final: true,
		});

		actor.send({ type: "CONSUME", attemptId: "voice:stale" });
		expect(actor.getSnapshot().value).toBe("transcript");
		actor.send({ type: "CONSUME", attemptId: attemptId ?? "missing" });
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

	it.each([
		[false, "idle", { type: "voice-idle" }],
		[
			true,
			"transcript",
			{ type: "voice-transcript", text: "Final transcript", final: true },
		],
	] as const)(
		"projects END from a %s transcript without inventing a host-side state",
		(final, expectedState, expectedFact) => {
			const actor = createVoiceCaptureActor({ supported: true }).start();
			actor.send({ type: "START" });
			actor.send({
				type: "RESULT",
				attemptId: "voice:1",
				text: final ? "Final transcript" : "Interim transcript",
				final,
			});
			actor.send({ type: "END", attemptId: "voice:stale" });
			expect(actor.getSnapshot().value).toBe("transcript");

			actor.send({ type: "END", attemptId: "voice:1" });
			expect(actor.getSnapshot().value).toBe(expectedState);
			expect(projectVoiceCaptureLifecycle(actor.getSnapshot())).toMatchObject({
				state: expectedState,
				sequence: 1,
				fact: expectedFact,
			});
			expect(projectVoiceCapturePortRequest(actor.getSnapshot())).toBeNull();
			expect(() => JSON.stringify(actor.getSnapshot().context)).not.toThrow();
			actor.stop();
		},
	);

	it("projects correlated END from listening to a cleared idle snapshot", () => {
		const actor = createVoiceCaptureActor({ supported: true }).start();
		actor.send({ type: "START" });
		actor.send({ type: "END", attemptId: "voice:stale" });
		expect(actor.getSnapshot().value).toBe("listening");
		actor.send({ type: "END", attemptId: "voice:1" });

		expect(actor.getSnapshot()).toMatchObject({
			value: "idle",
			context: { attemptId: null, transcript: "", final: false },
		});
		expect(projectVoiceCaptureLifecycle(actor.getSnapshot())).toEqual({
			state: "idle",
			attemptId: null,
			sequence: 1,
			fact: { type: "voice-idle" },
		});
		expect(projectVoiceCapturePortRequest(actor.getSnapshot())).toBeNull();
		actor.stop();
	});

	it.each(["consumed", "cancelled", "permission-denied", "failed"] as const)(
		"projects RESET from %s to idle and clears every port request",
		(state) => {
			const actor = createVoiceCaptureActor({ supported: true }).start();
			actor.send({ type: "START" });
			if (state === "consumed") {
				actor.send({
					type: "RESULT",
					attemptId: "voice:1",
					text: "Consumed transcript",
					final: true,
				});
				actor.send({ type: "CONSUME", attemptId: "voice:1" });
			} else if (state === "cancelled") {
				actor.send({ type: "CANCEL" });
			} else if (state === "permission-denied") {
				actor.send({
					type: "PERMISSION_DENIED",
					attemptId: "voice:1",
					message: "Permission denied.",
				});
			} else {
				actor.send({
					type: "FAIL",
					attemptId: "voice:1",
					message: "Recognition failed.",
				});
			}
			expect(actor.getSnapshot().value).toBe(state);

			actor.send({ type: "RESET" });
			expect(actor.getSnapshot()).toMatchObject({
				value: "idle",
				context: {
					attemptId: null,
					transcript: "",
					final: false,
					message: null,
				},
			});
			expect(projectVoiceCaptureLifecycle(actor.getSnapshot())).toEqual({
				state: "idle",
				attemptId: null,
				sequence: 1,
				fact: { type: "voice-idle" },
			});
			expect(projectVoiceCapturePortRequest(actor.getSnapshot())).toBeNull();
			actor.stop();
		},
	);

	it.each(["cancelled", "permission-denied", "failed"] as const)(
		"projects RETRY from %s as a fresh correlated start port",
		(state) => {
			const actor = createVoiceCaptureActor({ supported: true }).start();
			actor.send({ type: "START" });
			if (state === "cancelled") {
				actor.send({ type: "CANCEL" });
			} else if (state === "permission-denied") {
				actor.send({
					type: "PERMISSION_DENIED",
					attemptId: "voice:1",
					message: "Permission denied.",
				});
			} else {
				actor.send({
					type: "FAIL",
					attemptId: "voice:1",
					message: "Recognition failed.",
				});
			}
			const previousPortSequence =
				projectVoiceCapturePortRequest(actor.getSnapshot())?.sequence ?? 1;

			actor.send({ type: "RETRY" });
			expect(actor.getSnapshot()).toMatchObject({
				value: "listening",
				context: { attemptId: "voice:2", sequence: 2 },
			});
			expect(projectVoiceCaptureLifecycle(actor.getSnapshot())).toEqual({
				state: "listening",
				attemptId: "voice:2",
				sequence: 2,
				fact: { type: "voice-listening" },
			});
			expect(projectVoiceCapturePortRequest(actor.getSnapshot())).toEqual({
				type: "start",
				attemptId: "voice:2",
				sequence: previousPortSequence + 1,
			});
			actor.stop();
		},
	);

	it.each(["permission-denied", "failed"] as const)(
		"treats START from %s as a fresh correlated retry port",
		(state) => {
			const actor = createVoiceCaptureActor({ supported: true }).start();
			actor.send({ type: "START" });
			actor.send(
				state === "permission-denied"
					? {
							type: "PERMISSION_DENIED",
							attemptId: "voice:1",
							message: "Permission denied.",
						}
					: {
							type: "FAIL",
							attemptId: "voice:1",
							message: "Recognition failed.",
						},
			);
			expect(actor.getSnapshot().value).toBe(state);

			actor.send({ type: "START" });
			expect(actor.getSnapshot()).toMatchObject({
				value: "listening",
				context: {
					attemptId: "voice:2",
					sequence: 2,
					message: null,
				},
			});
			expect(projectVoiceCapturePortRequest(actor.getSnapshot())).toEqual({
				type: "start",
				attemptId: "voice:2",
				sequence: 2,
			});
			actor.stop();
		},
	);

	it("reports unsupported browsers as a capability fact", () => {
		vi.stubGlobal("SpeechRecognition", undefined);
		vi.stubGlobal("webkitSpeechRecognition", undefined);
		const voice = createBrowserVoiceCapture();

		expect(voice.getFact()).toEqual({ type: "voice-unsupported" });
		expect(voice.start()).toEqual({ type: "voice-unsupported" });
		expect(voice.useTranscript("voice:missing")).toEqual({
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
		expect(voice.useTranscript("voice:stale")).toEqual({
			ok: false,
			fact: {
				type: "voice-transcript",
				text: "Create a launch checklist",
				final: true,
			},
		});
		expect(voice.getLifecycle().state).toBe("transcript");
		expect(voice.useTranscript("voice:1")).toEqual({
			ok: true,
			attemptId: "voice:1",
			prompt: {
				channel: "speech",
				text: "Create a launch checklist",
			},
		});
		expect(voice.useTranscript("voice:1")).toEqual({
			ok: false,
			fact: { type: "voice-idle" },
		});
		expect(voice.getLifecycle()).toMatchObject({
			state: "consumed",
			attemptId: "voice:1",
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
		expect(voice.useTranscript("voice:1")).toEqual({
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

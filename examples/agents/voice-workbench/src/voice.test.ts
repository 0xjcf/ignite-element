import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createBrowserVoiceCapturePort,
	isBrowserVoiceCaptureSupported,
	type SpeechRecognitionLike,
} from "./adapters/browser-voice";
import {
	createVoiceCaptureActor,
	projectVoiceCaptureLifecycle,
	projectVoiceCapturePortRequest,
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
		expect(Object.keys(voiceCaptureMachine.config.states ?? {}).sort()).toEqual(
			[
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
			],
		);
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
		const receipts: unknown[] = [];
		const port = createBrowserVoiceCapturePort();

		port({ type: "start", attemptId: "voice:1", sequence: 1 }, (receipt) =>
			receipts.push(receipt),
		);

		expect(Recognition).toHaveBeenCalledOnce();
		expect(receipts).toEqual([
			{
				type: "FAIL",
				attemptId: "voice:1",
				message: "Speech recognition could not be initialized.",
			},
		]);
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

	it("reports unsupported browsers as a typed port receipt", () => {
		vi.stubGlobal("SpeechRecognition", undefined);
		vi.stubGlobal("webkitSpeechRecognition", undefined);
		const receipts: unknown[] = [];
		const port = createBrowserVoiceCapturePort();

		expect(isBrowserVoiceCaptureSupported()).toBe(false);
		port({ type: "start", attemptId: "voice:1", sequence: 1 }, (receipt) =>
			receipts.push(receipt),
		);
		expect(receipts).toEqual([
			{
				type: "FAIL",
				attemptId: "voice:1",
				message: "Speech recognition is unavailable in this browser.",
			},
		]);
	});

	it("returns final browser transcripts as correlated receipts", () => {
		const recognition = createRecognition();
		const receipts: unknown[] = [];
		installRecognition(recognition);
		const port = createBrowserVoiceCapturePort();

		port({ type: "start", attemptId: "voice:7", sequence: 7 }, (receipt) =>
			receipts.push(receipt),
		);
		expect(recognition.start).toHaveBeenCalledOnce();
		expect(recognition.lang).toBe("en-US");
		recognition.onresult?.({
			results: [
				{ 0: { transcript: "  Create a launch checklist  " }, isFinal: true },
			],
		});

		expect(receipts).toEqual([
			{
				type: "RESULT",
				attemptId: "voice:7",
				text: "Create a launch checklist",
				final: true,
			},
		]);
	});

	it("disposes the active browser recognition effect on cancel", () => {
		const recognition = createRecognition();
		installRecognition(recognition);
		const port = createBrowserVoiceCapturePort();

		port({ type: "start", attemptId: "voice:1", sequence: 1 }, () => {});
		port({ type: "cancel", attemptId: "voice:1", sequence: 2 }, () => {});
		expect(recognition.abort).toHaveBeenCalledOnce();
		expect(recognition.onresult).toBeNull();
		expect(recognition.onerror).toBeNull();
		expect(recognition.onend).toBeNull();
	});

	it("returns permission denial and recognition failures as receipts", () => {
		const deniedRecognition = createRecognition();
		deniedRecognition.start = vi.fn(() => {
			throw new DOMException("Microphone denied", "NotAllowedError");
		});
		installRecognition(deniedRecognition);
		const deniedReceipts: unknown[] = [];
		const denied = createBrowserVoiceCapturePort();

		expect(() =>
			denied({ type: "start", attemptId: "voice:1", sequence: 1 }, (receipt) =>
				deniedReceipts.push(receipt),
			),
		).not.toThrow();
		expect(deniedReceipts).toEqual([
			{
				type: "PERMISSION_DENIED",
				attemptId: "voice:1",
				message: "Microphone access was denied.",
			},
		]);

		const failedRecognition = createRecognition();
		installRecognition(failedRecognition);
		const failedReceipts: unknown[] = [];
		const failed = createBrowserVoiceCapturePort();
		failed({ type: "start", attemptId: "voice:2", sequence: 2 }, (receipt) =>
			failedReceipts.push(receipt),
		);
		failedRecognition.onerror?.({ error: "network", message: "Offline" });

		expect(failedReceipts).toEqual([
			{
				type: "FAIL",
				attemptId: "voice:2",
				message: "Offline",
			},
		]);
	});
});

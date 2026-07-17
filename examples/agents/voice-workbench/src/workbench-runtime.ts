import type { ModelFailureFact } from "./agent-loop";
import type { ModelTurnPortRequest } from "./model-turn";
import type {
	ModelTurnPortResult,
	SpeechDeliveryPortReceipt,
	VoiceCapturePortReceipt,
	VoiceWorkbenchPorts,
	WorkbenchClockPort,
	WorkbenchDisposable,
} from "./ports";
import type {
	VoiceWorkbenchSessionActor,
	VoiceWorkbenchSessionSnapshot,
} from "./session";
import type { SpeechDeliveryPortRequest } from "./speech";
import type { VoiceCapturePortRequest } from "./voice";

export const MODEL_TURN_TIMEOUT_MS = 45_000;

const defaultClock: WorkbenchClockPort = {
	setTimeout(callback, delayMs) {
		const timeout = setTimeout(callback, delayMs);
		return { dispose: () => clearTimeout(timeout) };
	},
};

const unexpectedModelFailure = (): ModelFailureFact => ({
	kind: "provider",
	message: "A model-turn port failed unexpectedly.",
});

const modelRequestKey = (request: ModelTurnPortRequest): string =>
	`${request.type}:${request.turnId}:${request.attemptId}`;

const voiceRequestKey = (request: VoiceCapturePortRequest): string =>
	`${request.type}:${request.sequence}:${request.attemptId ?? "none"}`;

const speechRequestKey = (request: SpeechDeliveryPortRequest): string =>
	`${request.type}:${request.requestSequence}:${request.sequence}:${request.attemptId}`;

export type VoiceWorkbenchRuntime = WorkbenchDisposable & {
	drive(snapshot?: VoiceWorkbenchSessionSnapshot): void;
};

export type CreateVoiceWorkbenchRuntimeOptions = {
	actor: VoiceWorkbenchSessionActor;
	ports: VoiceWorkbenchPorts;
	modelTurnTimeoutMs?: number;
};

export const createVoiceWorkbenchRuntime = ({
	actor,
	ports,
	modelTurnTimeoutMs = MODEL_TURN_TIMEOUT_MS,
}: CreateVoiceWorkbenchRuntimeOptions): VoiceWorkbenchRuntime => {
	const clock = ports.clock ?? defaultClock;
	const handled = new Set<string>();
	let disposed = false;
	let preparationController: AbortController | null = null;
	let modelTurnController: { turnId: string; controller: AbortController } | null =
		null;
	let modelTurnTimeout: { turnId: string; disposable: WorkbenchDisposable } | null =
		null;
	let voiceEffect: WorkbenchDisposable | null = null;
	let speechEffect: WorkbenchDisposable | null = null;

	const send = (event: Parameters<VoiceWorkbenchSessionActor["send"]>[0]) => {
		if (!disposed && actor.getSnapshot().status === "active") actor.send(event);
	};

	const stopPreparation = () => {
		preparationController?.abort();
		preparationController = null;
	};

	const stopModelTurn = () => {
		modelTurnController?.controller.abort();
		modelTurnController = null;
		modelTurnTimeout?.disposable.dispose();
		modelTurnTimeout = null;
	};

	const drivePreparation = (snapshot: VoiceWorkbenchSessionSnapshot) => {
		const request = snapshot.context.portRequests.modelPreparation;
		if (!request) {
			stopPreparation();
			return;
		}
		const key = `model-preparation:${request.sequence}`;
		if (handled.has(key)) return;
		handled.add(key);
		stopPreparation();
		const controller = new AbortController();
		preparationController = controller;
		void ports
			.modelPreparation(request, { signal: controller.signal })
			.then((receipt) => {
				send({ type: "MODEL_PREPARATION_PORT_RECEIVED", request, receipt });
			})
			.catch(() => {
				send({
					type: "MODEL_PREPARATION_PORT_RECEIVED",
					request,
					receipt: {
						type: "failed",
						sequence: request.sequence,
						failure: unexpectedModelFailure(),
					},
				});
			});
	};

	const driveModelTurn = (snapshot: VoiceWorkbenchSessionSnapshot) => {
		const request = snapshot.context.portRequests.modelTurn;
		if (!request) {
			if (!snapshot.children["model-turn"]) stopModelTurn();
			return;
		}
		if (modelTurnController?.turnId !== request.turnId) {
			stopModelTurn();
			modelTurnController = {
				turnId: request.turnId,
				controller: new AbortController(),
			};
			modelTurnTimeout = {
				turnId: request.turnId,
				disposable: clock.setTimeout(() => {
					send({
						type: "MODEL_TURN_TIMEOUT_REQUESTED",
						turnId: request.turnId,
						attemptId:
							actor.getSnapshot().context.portRequests.modelTurn?.attemptId ??
							request.attemptId,
					});
				}, modelTurnTimeoutMs),
			};
		}
		const key = modelRequestKey(request);
		if (handled.has(key)) return;
		handled.add(key);
		const controller = modelTurnController.controller;
		void ports
			.modelTurn(request, { signal: controller.signal })
			.then((result: ModelTurnPortResult) => {
				for (const fact of result.facts ?? []) send(fact);
				send({
					type: "MODEL_TURN_PORT_RECEIVED",
					request,
					receipt: result.receipt,
				});
			})
			.catch(() => {
				send({
					type: "MODEL_TURN_PORT_RECEIVED",
					request,
					receipt: {
						type: "PORT_FAILED",
						turnId: request.turnId,
						attemptId: request.attemptId,
						failure: unexpectedModelFailure(),
					},
				});
			});
	};

	const driveVoice = (snapshot: VoiceWorkbenchSessionSnapshot) => {
		const request = snapshot.context.portRequests.voiceCapture;
		if (!request) {
			if (!snapshot.children["voice-capture"]) {
				voiceEffect?.dispose();
				voiceEffect = null;
			}
			return;
		}
		const key = voiceRequestKey(request);
		if (handled.has(key)) return;
		handled.add(key);
		if (request.type === "start") {
			voiceEffect?.dispose();
			voiceEffect = null;
		}
		const effect = ports.voiceCapture(
			request,
			(receipt: VoiceCapturePortReceipt) =>
				send({ type: "VOICE_CAPTURE_PORT_RECEIVED", request, receipt }),
		);
		if (effect) voiceEffect = effect;
		if (request.type === "cancel" || request.type === "dispose") {
			voiceEffect?.dispose();
			voiceEffect = null;
		}
	};

	const driveSpeech = (snapshot: VoiceWorkbenchSessionSnapshot) => {
		const request = snapshot.context.portRequests.speechDelivery;
		if (!request) {
			if (!snapshot.children["speech-delivery"]) {
				speechEffect?.dispose();
				speechEffect = null;
			}
			return;
		}
		const key = speechRequestKey(request);
		if (handled.has(key)) return;
		handled.add(key);
		if (request.type === "speak") {
			speechEffect?.dispose();
			speechEffect = null;
		}
		const effect = ports.speechDelivery(
			request,
			(receipt: SpeechDeliveryPortReceipt) =>
				send({ type: "SPEECH_DELIVERY_PORT_RECEIVED", request, receipt }),
		);
		if (effect) speechEffect = effect;
		if (request.type === "cancel" || request.type === "dispose") {
			speechEffect?.dispose();
			speechEffect = null;
		}
	};

	const drive = (snapshot = actor.getSnapshot()) => {
		if (disposed) return;
		drivePreparation(snapshot);
		driveModelTurn(snapshot);
		driveVoice(snapshot);
		driveSpeech(snapshot);
	};

	const subscription = actor.subscribe(drive);
	drive();

	return {
		drive,
		dispose() {
			if (disposed) return;
			disposed = true;
			subscription.unsubscribe();
			stopPreparation();
			stopModelTurn();
			voiceEffect?.dispose();
			voiceEffect = null;
			speechEffect?.dispose();
			speechEffect = null;
			handled.clear();
		},
	};
};

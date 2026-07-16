/// <reference types="vite/client" />
import {
	createProjectionDocumentTarget,
	createProjectionSpeechTarget,
} from "ignite-element/xstate";
import {
	createProductPriceCapability,
	createProductPricingDomainPack,
} from "./domains/product-pricing";
import { createDomainRegistry } from "./domains/registry";
import { probeMlxWorkbenchReadiness } from "./model";
import {
	commitDocument,
	component,
	recordSpeechDeliveryLifecycle,
	recordVoiceCaptureLifecycle,
	reportModelAvailable,
	reportModelFailure,
	source,
} from "./session";
import {
	createSpeechDeliveryActor,
	projectSpeechDeliveryLifecycle,
	projectSpeechDeliveryPortRequest,
	projectSpeechDeliveryTerminalFact,
} from "./speech";
import { createBrowserVoiceCapture } from "./voice";
import { createWebSearchCapability } from "./web-search-capability";
import { renderWorkbench } from "./workbench";
import { type ModelTurnHandle, startSubmittedPrompt } from "./workbench-agent";

declare const __VOICE_WORKBENCH_WEB_SEARCH_AVAILABLE__: boolean;

type RuntimeConfiguration = {
	MLX_BASE_URL?: string;
	MLX_MODEL?: string;
	MLX_API_KEY?: string;
};

const runtimeConfiguration = globalThis as typeof globalThis &
	RuntimeConfiguration;
const environment = import.meta.env as ImportMetaEnv & RuntimeConfiguration;
const configuration = {
	baseUrl:
		runtimeConfiguration.MLX_BASE_URL ??
		environment.MLX_BASE_URL ??
		environment.VITE_MLX_BASE_URL,
	model:
		runtimeConfiguration.MLX_MODEL ??
		environment.MLX_MODEL ??
		environment.VITE_MLX_MODEL,
	apiKey:
		runtimeConfiguration.MLX_API_KEY ??
		environment.MLX_API_KEY ??
		environment.VITE_MLX_API_KEY,
};

const voice = createBrowserVoiceCapture();
const externalCapabilities = __VOICE_WORKBENCH_WEB_SEARCH_AVAILABLE__
	? [createWebSearchCapability()]
	: [];
const domains = createDomainRegistry([
	createProductPricingDomainPack({
		priceCapability: createProductPriceCapability(),
	}),
]);
let readinessAttempt = 0;
let readinessController: AbortController | null = null;
let speechAttempt = 0;
const activeSpeechDeliveries = new Set<{
	dispose(): void;
}>();

const prepareModel = async () => {
	const attempt = ++readinessAttempt;
	readinessController?.abort();
	const controller = new AbortController();
	readinessController = controller;
	const fact = await probeMlxWorkbenchReadiness({
		...configuration,
		signal: controller.signal,
	});
	if (attempt !== readinessAttempt || controller.signal.aborted) return;
	readinessController = null;
	if (fact.type === "MODEL_AVAILABLE") {
		reportModelAvailable();
		return;
	}
	reportModelFailure(fact.failure);
};

const deliverSpeech = (
	speech: { id: string; text: string },
	enabled: boolean,
) => {
	const attemptId = `${speech.id}:${++speechAttempt}`;
	const supported =
		typeof window.speechSynthesis?.speak === "function" &&
		typeof SpeechSynthesisUtterance !== "undefined";
	const actor = createSpeechDeliveryActor({
		...speech,
		attemptId,
		supported,
		muted: !enabled,
	});
	const handledPorts = new Set<string>();
	let disposed = false;
	let subscription: { unsubscribe(): void } | null = null;

	const delivery = {
		dispose: () => {
			if (disposed) return;
			disposed = true;
			actor.send({ type: "DISPOSE" });
			subscription?.unsubscribe();
			actor.stop();
			activeSpeechDeliveries.delete(delivery);
		},
	};
	activeSpeechDeliveries.add(delivery);

	subscription = actor.subscribe((snapshot) => {
		recordSpeechDeliveryLifecycle(projectSpeechDeliveryLifecycle(snapshot));
		if (projectSpeechDeliveryTerminalFact(snapshot)) {
			delivery.dispose();
			return;
		}

		const request = projectSpeechDeliveryPortRequest(snapshot);
		if (!request) return;
		const portKey = `${request.type}:${request.sequence}`;
		if (handledPorts.has(portKey)) return;
		handledPorts.add(portKey);
		switch (request.type) {
			case "mute":
				actor.send({ type: "MUTED", attemptId });
				return;
			case "unavailable":
				actor.send({ type: "UNAVAILABLE", attemptId });
				return;
			case "speak": {
				if (!supported) {
					actor.send({ type: "UNAVAILABLE", attemptId });
					return;
				}
				try {
					const utterance = new SpeechSynthesisUtterance(request.text);
					utterance.onend = () => actor.send({ type: "DELIVERED", attemptId });
					utterance.onerror = (event) =>
						actor.send({
							type: "FAIL",
							attemptId,
							message: event.error || "Speech delivery failed.",
						});
					window.speechSynthesis.speak(utterance);
					actor.send({ type: "QUEUED", attemptId });
				} catch {
					actor.send({
						type: "FAIL",
						attemptId,
						message: "Speech delivery failed.",
					});
				}
				return;
			}
			case "cancel":
			case "dispose":
				window.speechSynthesis?.cancel?.();
		}
	});
	actor.start();
};

const voiceSubscription = voice.subscribeLifecycle((lifecycle) => {
	recordVoiceCaptureLifecycle(lifecycle);
});
recordVoiceCaptureLifecycle(voice.getLifecycle());

let activeModelTurn: ModelTurnHandle | null = null;

const browserRequestSubscription = component.watchView((view, previous) => {
	const modelTurnControl = view.portRequests.modelTurnControl;
	if (
		modelTurnControl &&
		modelTurnControl.sequence !==
			previous.portRequests.modelTurnControl?.sequence &&
		activeModelTurn?.turnId === modelTurnControl.turnId
	) {
		activeModelTurn.cancel();
	}

	const voiceRequest = view.portRequests.voiceCapture;
	if (
		voiceRequest &&
		voiceRequest.sequence !== previous.portRequests.voiceCapture?.sequence
	) {
		if (voiceRequest.action === "start") voice.start();
		else voice.cancel();
	}

	const speechRequest = view.portRequests.speechDelivery;
	if (
		speechRequest &&
		speechRequest.sequence !== previous.portRequests.speechDelivery?.sequence
	) {
		deliverSpeech(speechRequest, view.presentation.speakResponses);
	}
});

const modelPreparationSubscription = component.watchView((view, previous) => {
	if (
		view.portRequests.modelPreparation &&
		!previous.portRequests.modelPreparation
	) {
		void prepareModel();
	}
});

const modelTurnSubscription = component.on("prompt-submitted", (event) => {
	activeModelTurn?.dispose();
	const handle = startSubmittedPrompt(
		configuration,
		event,
		externalCapabilities,
		domains,
	);
	activeModelTurn = handle;
	const clearActiveHandle = () => {
		if (activeModelTurn === handle) activeModelTurn = null;
	};
	void handle.done.then(clearActiveHandle, clearActiveHandle);
});

component("voice-workbench", renderWorkbench);
void prepareModel();

const documentProjection = component(
	createProjectionDocumentTarget({
		commitDocument: (projectionDocument) => {
			commitDocument({
				id: projectionDocument.id,
				title: projectionDocument.title,
				revision: projectionDocument.revision,
			});
		},
	}),
);

const speechProjection = component(
	createProjectionSpeechTarget({
		acknowledgeCommandName: "acknowledgeSpeech",
		resolveAcknowledgePayload: ({ id }) => ({ id }),
		commitSpeech: (speech) => {
			deliverSpeech(speech, component.getView().presentation.speakResponses);
		},
	}),
);

window.addEventListener("pagehide", (event) => {
	if (event.persisted) return;
	readinessAttempt += 1;
	readinessController?.abort();
	readinessController = null;
	activeModelTurn?.dispose();
	activeModelTurn = null;
	voiceSubscription.unsubscribe();
	browserRequestSubscription.unsubscribe();
	voice.dispose();
	for (const delivery of [...activeSpeechDeliveries]) delivery.dispose();
	modelPreparationSubscription.unsubscribe();
	modelTurnSubscription.unsubscribe();
	documentProjection.dispose();
	speechProjection.dispose();
	source.stop();
});

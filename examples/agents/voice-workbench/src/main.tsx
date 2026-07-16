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
import { component, source } from "./session";
import {
	createSpeechDeliveryActor,
	projectSpeechDeliveryFact,
	projectSpeechDeliveryPortRequest,
} from "./speech";
import { createBrowserVoiceCapture } from "./voice";
import { createWebSearchCapability } from "./web-search-capability";
import { renderWorkbench } from "./workbench";
import { completeSubmittedPrompt } from "./workbench-agent";

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
		await component.execute({ command: "reportModelAvailable" });
		return;
	}
	await component.execute({
		command: "reportModelFailure",
		input: fact.failure,
	});
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
	let lastFact = "";
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
		const fact = projectSpeechDeliveryFact(snapshot);
		const factKey = fact ? JSON.stringify(fact) : "";
		if (fact && factKey !== lastFact) {
			lastFact = factKey;
			switch (fact.type) {
				case "speech-delivery-completed":
					void component.execute({
						command: "commitSpeech",
						input: { ...speech, status: "played" },
					});
					break;
				case "speech-delivery-muted":
					void component.execute({
						command: "commitSpeech",
						input: { ...speech, status: "muted" },
					});
					break;
				case "speech-delivery-unavailable":
				case "speech-delivery-failed":
					void component.execute({
						command: "commitSpeech",
						input: { ...speech, status: "unavailable" },
					});
					break;
				case "speech-delivery-queued":
				case "speech-delivery-cancelled":
					break;
			}
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

const voiceSubscription = voice.subscribe((fact) => {
	void component.execute({ command: "presentVoice", input: fact });
});
void component.execute({ command: "presentVoice", input: voice.getFact() });

const browserRequestSubscription = component.watchView((view, previous) => {
	const voiceRequest = view.presentation.voiceCaptureRequest;
	if (
		voiceRequest &&
		voiceRequest.sequence !==
			previous.presentation.voiceCaptureRequest?.sequence
	) {
		if (voiceRequest.action === "start") voice.start();
		else voice.cancel();
	}

	const speechRequest = view.presentation.speechReplayRequest;
	if (
		speechRequest &&
		speechRequest.sequence !==
			previous.presentation.speechReplayRequest?.sequence
	) {
		deliverSpeech(speechRequest, view.presentation.speakResponses);
	}
});

const modelPreparationSubscription = component.watchView((view, previous) => {
	if (
		view.model.status === "preparing" &&
		previous.model.status !== "preparing"
	) {
		void prepareModel();
	}
});

const modelTurnSubscription = component.on("prompt-submitted", (event) => {
	void completeSubmittedPrompt(
		configuration,
		event,
		externalCapabilities,
		domains,
	);
});

component("voice-workbench", renderWorkbench);
void prepareModel();

const documentProjection = component(
	createProjectionDocumentTarget({
		commitDocument: (projectionDocument) => {
			void component.execute({
				command: "commitDocument",
				input: {
					id: projectionDocument.id,
					title: projectionDocument.title,
					revision: projectionDocument.revision,
				},
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

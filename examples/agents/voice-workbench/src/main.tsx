/// <reference types="vite/client" />
import {
	createProjectionDocumentTarget,
	createProjectionSpeechTarget,
} from "ignite-element/xstate";
import { probeMlxWorkbenchReadiness } from "./model";
import { component, source } from "./session";
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
let readinessAttempt = 0;
let readinessController: AbortController | null = null;

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

const speak = (text: string): "played" | "unavailable" => {
	if (
		typeof window.speechSynthesis?.speak !== "function" ||
		typeof SpeechSynthesisUtterance === "undefined"
	) {
		return "unavailable";
	}
	window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
	return "played";
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
		const status = view.presentation.speakResponses
			? speak(speechRequest.text)
			: "muted";
		void component.execute({
			command: "commitSpeech",
			input: {
				id: speechRequest.id,
				text: speechRequest.text,
				status,
			},
		});
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
	void completeSubmittedPrompt(configuration, event, externalCapabilities);
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
			const status = component.getView().presentation.speakResponses
				? speak(speech.text)
				: "muted";
			void component.execute({
				command: "commitSpeech",
				input: { id: speech.id, text: speech.text, status },
			});
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
	modelPreparationSubscription.unsubscribe();
	modelTurnSubscription.unsubscribe();
	documentProjection.dispose();
	speechProjection.dispose();
	source.stop();
});

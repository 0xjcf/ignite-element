/// <reference types="vite/client" />
import {
	createProjectionDocumentTarget,
	createProjectionSpeechTarget,
} from "ignite-element/xstate";
import { type ModelTurnResult, runModelTurn } from "./agent-loop";
import { createMlxWorkbenchModel, probeMlxWorkbenchReadiness } from "./model";
import { component, source, type WorkbenchTurnFact } from "./session";
import { createBrowserVoiceCapture } from "./voice";
import {
	renderWorkbench,
	type WorkbenchControls,
	type WorkbenchPrompt,
} from "./workbench";

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

const model = createMlxWorkbenchModel({ component, ...configuration });
const voice = createBrowserVoiceCapture();
let readinessAttempt = 0;
let readinessController: AbortController | null = null;

const prepareModel = async () => {
	const attempt = ++readinessAttempt;
	readinessController?.abort();
	const controller = new AbortController();
	readinessController = controller;
	source.send({ type: "MODEL_PREPARATION_STARTED" });
	const fact = await probeMlxWorkbenchReadiness({
		...configuration,
		signal: controller.signal,
	});
	if (attempt !== readinessAttempt || controller.signal.aborted) return;
	readinessController = null;
	source.send(fact);
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

const toTurnFact = (result: ModelTurnResult): WorkbenchTurnFact => {
	if (result.accepted) return { type: "accepted", trace: result.trace };
	if (result.reason === "model-failed") {
		return {
			type: "model-failed",
			failureKind: result.failure.kind,
			message: result.failure.message,
			trace: result.trace,
		};
	}
	if (!("command" in result)) {
		return { type: result.reason, trace: result.trace };
	}
	return {
		type: result.reason,
		command: result.command,
		trace: result.trace,
	};
};

const submit = async (prompt: WorkbenchPrompt) => {
	if (!component.getView().canSubmitPrompt) return;
	const result = await runModelTurn({ component, model, prompt });
	source.send({ type: "PRESENTATION_TURN_RECORDED", fact: toTurnFact(result) });
	if (result.accepted && prompt.channel === "text") {
		source.send({ type: "PRESENTATION_DRAFT_CHANGED", draft: "" });
	}
};

const controls: WorkbenchControls = {
	cancelVoice: () => {
		voice.cancel();
	},
	playSpeech: () => {
		const view = component.getView();
		const text = view.response?.speech;
		if (!text) return;
		const status = view.presentation.speakResponses ? speak(text) : "muted";
		source.send({
			type: "PRESENTATION_SPEECH_COMMITTED",
			speech: {
				id: view.speech?.id ?? `manual-${view.revision}`,
				text,
				status,
			},
		});
	},
	replayTrace: () => source.send({ type: "PRESENTATION_REPLAYED" }),
	retryModel: () => void prepareModel(),
	setArtifactView: (view) =>
		source.send({ type: "PRESENTATION_ARTIFACT_VIEW_CHANGED", view }),
	setMobilePanel: (panel) =>
		source.send({ type: "PRESENTATION_MOBILE_PANEL_CHANGED", panel }),
	setSpeechPreference: (enabled) =>
		source.send({
			type: "PRESENTATION_SPEECH_PREFERENCE_CHANGED",
			enabled,
		}),
	startVoice: () => {
		voice.start();
	},
	submitPrompt: (prompt) => void submit(prompt),
	updateDraft: (draft) =>
		source.send({ type: "PRESENTATION_DRAFT_CHANGED", draft }),
	useVoiceTranscript: () => {
		const transcript = voice.useTranscript();
		if (!transcript.ok) {
			source.send({
				type: "PRESENTATION_VOICE_CHANGED",
				fact: transcript.fact,
			});
			return;
		}
		const prompt = transcript.prompt;
		voice.cancel();
		void submit(prompt);
	},
};

const voiceSubscription = voice.subscribe((fact) =>
	source.send({ type: "PRESENTATION_VOICE_CHANGED", fact }),
);
source.send({ type: "PRESENTATION_VOICE_CHANGED", fact: voice.getFact() });

component("voice-workbench", (projection) =>
	renderWorkbench(projection, controls),
);
void prepareModel();

const terminalSubscription = component.on("response-completed", () => {
	const response = component.getView().response;
	if (!response) return;
	console.info(`[voice-workbench] ${response.text}`);
	source.send({
		type: "PRESENTATION_TERMINAL_COMMITTED",
		terminal: { text: response.text },
	});
});

const documentProjection = component(
	createProjectionDocumentTarget({
		commitDocument: (projectionDocument) => {
			source.send({
				type: "PRESENTATION_DOCUMENT_COMMITTED",
				document: {
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
			source.send({
				type: "PRESENTATION_SPEECH_COMMITTED",
				speech: { id: speech.id, text: speech.text, status },
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
	voice.dispose();
	terminalSubscription.unsubscribe();
	documentProjection.dispose();
	speechProjection.dispose();
	source.stop();
});

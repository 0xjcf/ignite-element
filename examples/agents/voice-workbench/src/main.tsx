/// <reference types="vite/client" />
import {
	createProjectionDocumentTarget,
	createProjectionSpeechTarget,
} from "ignite-element/xstate";
import { type ModelTurnResult, runModelTurn } from "./agent-loop";
import { createMlxWorkbenchModel } from "./model";
import { component, source } from "./session";
import { createBrowserVoiceCapture, type VoiceCaptureFact } from "./voice";
import { renderWorkbench } from "./workbench";

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

component("voice-workbench", renderWorkbench);

const host = document.querySelector("voice-workbench");
if (!(host instanceof HTMLElement)) {
	throw new Error("The voice workbench host element is missing.");
}

const model = createMlxWorkbenchModel({ component, ...configuration });
const voice = createBrowserVoiceCapture();
let speakResponses = true;
let lastTurn: ModelTurnResult | null = null;

const speak = (text: string) => {
	if (
		typeof window.speechSynthesis?.speak !== "function" ||
		typeof SpeechSynthesisUtterance === "undefined"
	) {
		return;
	}
	window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
};

const syncSpeechPreference = () => {
	const toggle = host.shadowRoot?.querySelector("#speak-toggle");
	if (toggle instanceof HTMLInputElement) toggle.checked = speakResponses;
};

const voiceState = (fact: VoiceCaptureFact): string => {
	switch (fact.type) {
		case "voice-listening":
			return "listening";
		case "voice-transcript":
			return "transcript";
		case "voice-permission-denied":
		case "voice-error":
			return "permission";
		case "voice-unsupported":
			return "unsupported";
		case "voice-idle":
		case "voice-cancelled":
			return "idle";
	}
};

const syncVoice = (fact: VoiceCaptureFact) => {
	const root = host.shadowRoot;
	if (!root) return;
	const shell = root.querySelector(".shell");
	if (shell instanceof HTMLElement) {
		shell.dataset.voiceState = voiceState(fact);
	}
	const status = root.querySelector("#voice-status");
	const transcript = root.querySelector("#live-transcript");
	const microphone = root.querySelector("#mic-button");
	const useTranscript = root.querySelector("#use-transcript");
	if (status) {
		status.textContent =
			fact.type === "voice-transcript"
				? fact.final
					? "Transcript ready"
					: "Listening…"
				: fact.type === "voice-listening"
					? "Listening…"
					: "Speech input";
	}
	if (transcript) {
		transcript.textContent =
			fact.type === "voice-transcript" ? fact.text : "Waiting for speech";
	}
	if (microphone instanceof HTMLButtonElement) {
		const unsupported = fact.type === "voice-unsupported";
		microphone.disabled = unsupported || !component.getView().canSubmitPrompt;
		microphone.title = unsupported
			? "Speech recognition is unavailable in this browser"
			: "Start speech input";
	}
	if (useTranscript instanceof HTMLButtonElement) {
		useTranscript.disabled = fact.type !== "voice-transcript" || !fact.final;
	}
	if (fact.type === "voice-permission-denied" || fact.type === "voice-error") {
		const alert = root.querySelector('[role="alert"]');
		const heading = alert?.querySelector("strong");
		const detail = alert?.querySelector("p");
		if (heading) {
			heading.textContent =
				fact.type === "voice-permission-denied"
					? "Microphone access was denied"
					: "Speech input is unavailable";
		}
		if (detail) {
			detail.textContent = `${fact.message} Continue by typing; your current draft is preserved.`;
		}
	}
};

const turnMessage = (result: ModelTurnResult): string => {
	if (result.accepted) return "Actor accepted the model-authored turn.";
	if (result.reason === "model-failed") return result.failure.message;
	return `${result.command} was ${
		result.reason === "command-not-allowed"
			? "not allowed by the model command policy"
			: "rejected by the actor"
	}.`;
};

const syncTurn = () => {
	const result = host.shadowRoot?.querySelector("#turn-result");
	if (result) result.textContent = lastTurn ? turnMessage(lastTurn) : "";
};

const refreshPresentation = () => {
	queueMicrotask(() => {
		syncSpeechPreference();
		syncVoice(voice.getFact());
		syncTurn();
	});
};

const viewSubscription = component.watchView(refreshPresentation);
const voiceSubscription = voice.subscribe(syncVoice);
syncSpeechPreference();
syncVoice(voice.getFact());

const submit = async (prompt: { channel: "text" | "speech"; text: string }) => {
	if (!component.getView().canSubmitPrompt) return;
	lastTurn = await runModelTurn({ component, model, prompt });
	syncTurn();
};

const onPrompt = (event: Event) => {
	const prompt = (event as CustomEvent).detail as unknown;
	if (
		typeof prompt !== "object" ||
		prompt === null ||
		!("channel" in prompt) ||
		!("text" in prompt) ||
		(prompt.channel !== "text" && prompt.channel !== "speech") ||
		typeof prompt.text !== "string" ||
		prompt.text.trim().length === 0
	) {
		return;
	}
	void submit({ channel: prompt.channel, text: prompt.text.trim() });
};

const onVoiceStart = () => syncVoice(voice.start());
const onVoiceCancel = () => syncVoice(voice.cancel());
const onVoiceUse = () => {
	const transcript = voice.useTranscript();
	if (!transcript.ok) {
		syncVoice(transcript.fact);
		return;
	}
	const prompt = transcript.prompt;
	voice.cancel();
	syncVoice({ type: "voice-idle" });
	void submit(prompt);
};
const onSpeechPreference = (event: Event) => {
	const detail = (event as CustomEvent).detail as unknown;
	if (
		typeof detail === "object" &&
		detail !== null &&
		"enabled" in detail &&
		typeof detail.enabled === "boolean"
	) {
		speakResponses = detail.enabled;
	}
};
const onSpeechPlay = () => {
	const speech = component.getView().response?.speech;
	if (speech) speak(speech);
};
const onReplay = () => {
	syncTurn();
	const output = host.shadowRoot?.querySelector("#turn-result");
	if (output instanceof HTMLElement) output.focus();
};

host.addEventListener("workbench-prompt", onPrompt);
host.addEventListener("workbench-voice-start", onVoiceStart);
host.addEventListener("workbench-voice-cancel", onVoiceCancel);
host.addEventListener("workbench-voice-use", onVoiceUse);
host.addEventListener("workbench-speech-preference", onSpeechPreference);
host.addEventListener("workbench-speech-play", onSpeechPlay);
host.addEventListener("workbench-replay", onReplay);

const terminalSubscription = component.on("response-completed", () => {
	const response = component.getView().response;
	if (response) console.info(`[voice-workbench] ${response.text}`);
});

const documentProjection = component(
	createProjectionDocumentTarget({
		commitDocument: (projectionDocument) => {
			const output = document.querySelector("#document-commit");
			if (output) {
				output.textContent = `Committed ${projectionDocument.title ?? projectionDocument.id} revision ${projectionDocument.revision}`;
			}
		},
	}),
);

const speechProjection = component(
	createProjectionSpeechTarget({
		acknowledgeCommandName: "acknowledgeSpeech",
		resolveAcknowledgePayload: ({ id }) => ({ id }),
		commitSpeech: (speech) => {
			const output = document.querySelector("#speech-commit");
			if (output) output.textContent = speech.text;
			if (speakResponses) speak(speech.text);
		},
	}),
);

window.addEventListener("pagehide", (event) => {
	if (event.persisted) return;
	host.removeEventListener("workbench-prompt", onPrompt);
	host.removeEventListener("workbench-voice-start", onVoiceStart);
	host.removeEventListener("workbench-voice-cancel", onVoiceCancel);
	host.removeEventListener("workbench-voice-use", onVoiceUse);
	host.removeEventListener("workbench-speech-preference", onSpeechPreference);
	host.removeEventListener("workbench-speech-play", onSpeechPlay);
	host.removeEventListener("workbench-replay", onReplay);
	viewSubscription.unsubscribe();
	voiceSubscription.unsubscribe();
	voice.dispose();
	terminalSubscription.unsubscribe();
	documentProjection.dispose();
	speechProjection.dispose();
	source.stop();
});

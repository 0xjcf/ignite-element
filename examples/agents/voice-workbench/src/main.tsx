/// <reference types="vite/client" />
import { igniteTools, isOk } from "ignite-element/tools";
import {
	createProjectionDocumentTarget,
	createProjectionSpeechTarget,
} from "ignite-element/xstate";
import {
	type ModelExchange,
	type ModelToolFeedback,
	type ModelTurnResult,
	modelTools,
	modelTurn,
} from "./agent-loop";
import { probeMlxWorkbenchReadiness, requestMlxWorkbenchModel } from "./model";
import { component, source, type WorkbenchTurnFact } from "./session";
import { createBrowserVoiceCapture } from "./voice";
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

const voice = createBrowserVoiceCapture();
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

const completeSubmittedPrompt = async (event: {
	modality: "text" | "speech";
	text: string;
}) => {
	const prompt = { channel: event.modality, text: event.text };
	const history: ModelExchange[] = [];
	let result: ModelTurnResult | null = null;
	let priorTrace: ModelTurnResult["trace"] = [];
	for (let round = 0; round < 5; round += 1) {
		const tools = igniteTools(component);
		const response = await requestMlxWorkbenchModel(configuration, {
			prompt,
			tools: modelTools(tools.manifest),
			view: component.getView().modelContext,
			history,
		});
		const protocol = modelTurn(response);
		let step = protocol.next();
		while (!step.done) {
			const call = step.value;
			const execution = await tools.run({
				name: call.command,
				input: call.input,
			});
			const rejectedByActor = isOk(execution)
				? execution.value.events.find(
						(actorEvent) => actorEvent.type === "artifact-rejected",
					)
				: undefined;
			const feedback: ModelToolFeedback = {
				id: call.id ?? `model-round-${round}`,
				command: call.command,
				status: !isOk(execution)
					? "tool-error"
					: rejectedByActor
						? "actor-rejected"
						: "accepted",
				...(!isOk(execution)
					? {
							reason: execution.error.kind,
							...(execution.error.kind === "InvalidInput"
								? { issues: execution.error.issues }
								: {}),
						}
					: rejectedByActor && "reason" in rejectedByActor
						? { reason: String(rejectedByActor.reason) }
						: {}),
				view: component.getView().modelContext,
				events: isOk(execution)
					? execution.value.events.map((actorEvent) => ({
							type: actorEvent.type,
							...("reason" in actorEvent
								? { reason: String(actorEvent.reason) }
								: {}),
						}))
					: [],
			};
			step = protocol.next(feedback);
		}
		result = {
			...step.value,
			trace: [...priorTrace, ...step.value.trace],
		};
		if ("exchange" in step.value) history.push(step.value.exchange);
		priorTrace = result.trace;
		if (result.accepted || result.reason === "model-failed") break;
	}
	if (!result) return;
	if (!result.accepted && result.reason !== "model-failed") {
		const tools = igniteTools(component);
		const recovery = await tools.run({
			name: "completeResponse",
			input: {
				text: "The model could not finish an accepted artifact within this turn. Refine the prompt and try again.",
			},
		});
		result = {
			...result,
			trace: [
				...result.trace,
				{ command: "completeResponse", accepted: isOk(recovery) },
			],
		};
	}
	await component.execute({
		command: "recordTurn",
		input: toTurnFact(result),
	});
	if (result.accepted && event.modality === "text") {
		await component.execute({ command: "changeDraft", input: "" });
	}
};

const modelTurnSubscription = component.on("prompt-submitted", (event) => {
	void completeSubmittedPrompt(event);
});

component("voice-workbench", renderWorkbench);
void prepareModel();

const terminalSubscription = component.on("response-completed", () => {
	const response = component.getView().response;
	if (!response) return;
	console.info(`[voice-workbench] ${response.text}`);
	void component.execute({
		command: "commitTerminal",
		input: { text: response.text },
	});
});

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
	terminalSubscription.unsubscribe();
	documentProjection.dispose();
	speechProjection.dispose();
	source.stop();
});

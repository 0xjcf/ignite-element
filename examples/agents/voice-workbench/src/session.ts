import { igniteCore } from "ignite-element/xstate";
import { and, assign, createActor, setup, stateIn } from "xstate";
import type { ModelFailureFact } from "./agent-loop";
import {
	type AcknowledgeSpeechInput,
	type CompleteResponseInput,
	type ConversationAction,
	type ConversationFact,
	type ConversationSession,
	type CreateArtifactInput,
	createInitialSession,
	type ReviseArtifactInput,
	reduceConversationSession,
	type SubmitPromptInput,
} from "./domain";
import type { VoiceCaptureFact } from "./voice";

export type WorkbenchArtifactView = "document" | "schema";
export type WorkbenchPanel = "conversation" | "artifact" | "runtime";
export type WorkbenchTurnTrace = readonly {
	command: string;
	accepted: boolean;
}[];
export type WorkbenchTurnFact =
	| { type: "accepted"; trace: WorkbenchTurnTrace }
	| {
			type: "prompt-rejected" | "response-incomplete";
			trace: WorkbenchTurnTrace;
	  }
	| {
			type: "model-failed";
			failureKind:
				| "configuration"
				| "network"
				| "timeout"
				| "provider"
				| "invalid-response";
			message: string;
			trace: WorkbenchTurnTrace;
	  }
	| {
			type: "command-not-allowed" | "command-rejected";
			command: string;
			trace: WorkbenchTurnTrace;
	  };

export type WorkbenchPresentation = {
	artifactView: WorkbenchArtifactView;
	documentCommit: {
		id: string;
		title?: string;
		revision: string;
	} | null;
	draft: string;
	mobilePanel: WorkbenchPanel;
	replaySequence: number;
	speakResponses: boolean;
	speechCommit: {
		id: string;
		text: string;
		status: "played" | "muted" | "unavailable";
	} | null;
	terminalCommit: { text: string } | null;
	turn: WorkbenchTurnFact | null;
	voice: VoiceCaptureFact;
};

export type WorkbenchPresentationEvent =
	| { type: "PRESENTATION_DRAFT_CHANGED"; draft: string }
	| { type: "PRESENTATION_VOICE_CHANGED"; fact: VoiceCaptureFact }
	| {
			type: "PRESENTATION_ARTIFACT_VIEW_CHANGED";
			view: WorkbenchArtifactView;
	  }
	| { type: "PRESENTATION_MOBILE_PANEL_CHANGED"; panel: WorkbenchPanel }
	| { type: "PRESENTATION_SPEECH_PREFERENCE_CHANGED"; enabled: boolean }
	| { type: "PRESENTATION_TURN_RECORDED"; fact: WorkbenchTurnFact }
	| {
			type: "PRESENTATION_DOCUMENT_COMMITTED";
			document: NonNullable<WorkbenchPresentation["documentCommit"]>;
	  }
	| {
			type: "PRESENTATION_SPEECH_COMMITTED";
			speech: NonNullable<WorkbenchPresentation["speechCommit"]>;
	  }
	| {
			type: "PRESENTATION_TERMINAL_COMMITTED";
			terminal: NonNullable<WorkbenchPresentation["terminalCommit"]>;
	  }
	| { type: "PRESENTATION_REPLAYED" };

type WorkbenchSession = ConversationSession & {
	modelFailure: ModelFailureFact | null;
	presentation: WorkbenchPresentation;
};
export type ModelReadinessEvent =
	| { type: "MODEL_PREPARATION_STARTED" }
	| { type: "MODEL_AVAILABLE" }
	| { type: "MODEL_FAILED"; failure: ModelFailureFact };
type WorkbenchEvent =
	| ConversationAction
	| ModelReadinessEvent
	| WorkbenchPresentationEvent;

const createInitialPresentation = (): WorkbenchPresentation => ({
	artifactView: "document",
	documentCommit: null,
	draft: "",
	mobilePanel: "conversation",
	replaySequence: 0,
	speakResponses: true,
	speechCommit: null,
	terminalCommit: null,
	turn: null,
	voice: { type: "voice-idle" },
});

const describeTurn = (turn: WorkbenchTurnFact | null): string => {
	if (!turn) return "";
	switch (turn.type) {
		case "accepted":
			return "Actor accepted the model-authored turn.";
		case "model-failed":
			return turn.message;
		case "prompt-rejected":
			return "The actor did not admit this prompt.";
		case "response-incomplete":
			return "The model omitted a completed response, so the actor recovered the turn.";
		case "command-not-allowed":
			return `${turn.command} was not allowed by the model command policy.`;
		case "command-rejected":
			return `${turn.command} was rejected by the actor.`;
	}
};

const describeFact = (fact: ConversationFact | null): string => {
	if (!fact) return "no actor facts yet";
	switch (fact.type) {
		case "prompt-submitted":
			return `${fact.type} · ${fact.modality}`;
		case "artifact-created":
		case "artifact-revised":
			return `${fact.type} · revision ${fact.revision}`;
		case "artifact-rejected":
			return `${fact.type} · ${fact.reason}`;
		case "speech-acknowledged":
			return `${fact.type} · ${fact.id}`;
		case "response-completed":
			return fact.type;
	}
};

const voiceState = (
	fact: VoiceCaptureFact,
): "idle" | "listening" | "transcript" | "permission" | "unsupported" => {
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

const isConversationAction = (
	event: WorkbenchEvent,
): event is ConversationAction => {
	switch (event.type) {
		case "SUBMIT_PROMPT":
		case "CREATE_ARTIFACT":
		case "REVISE_ARTIFACT":
		case "COMPLETE_RESPONSE":
		case "ACKNOWLEDGE_SPEECH":
			return true;
		default:
			return false;
	}
};

const updatePresentation = (
	context: WorkbenchSession,
	patch: Partial<WorkbenchPresentation>,
): WorkbenchSession => ({
	...context,
	presentation: { ...context.presentation, ...patch },
});

const machine = setup({
	types: {
		context: {} as WorkbenchSession,
		events: {} as WorkbenchEvent,
	},
	actions: {
		applyTransition: assign(({ context, event }) => {
			if (!isConversationAction(event)) return context;
			const result = reduceConversationSession(context, event);
			if (result.accepted) {
				return { ...result.session, presentation: context.presentation };
			}
			return {
				...context,
				factSequence: context.factSequence + 1,
				lastFact: { type: "artifact-rejected", reason: result.reason },
			};
		}),
		clearModelFailure: assign({ modelFailure: () => null }),
		recordModelFailure: assign({
			modelFailure: ({ event }) =>
				event.type === "MODEL_FAILED" ? event.failure : null,
		}),
	},
	guards: {
		transitionAccepted: ({ context, event }) =>
			isConversationAction(event) &&
			reduceConversationSession(context, event).accepted,
	},
}).createMachine({
	id: "conversation-session",
	type: "parallel",
	context: () => ({
		...createInitialSession("voice-workbench"),
		modelFailure: null,
		presentation: createInitialPresentation(),
	}),
	on: {
		ACKNOWLEDGE_SPEECH: { actions: "applyTransition" },
		PRESENTATION_DRAFT_CHANGED: {
			actions: assign(({ context, event }) =>
				updatePresentation(context, { draft: event.draft }),
			),
		},
		PRESENTATION_VOICE_CHANGED: {
			actions: assign(({ context, event }) =>
				updatePresentation(context, { voice: event.fact }),
			),
		},
		PRESENTATION_ARTIFACT_VIEW_CHANGED: {
			actions: assign(({ context, event }) =>
				updatePresentation(context, { artifactView: event.view }),
			),
		},
		PRESENTATION_MOBILE_PANEL_CHANGED: {
			actions: assign(({ context, event }) =>
				updatePresentation(context, { mobilePanel: event.panel }),
			),
		},
		PRESENTATION_SPEECH_PREFERENCE_CHANGED: {
			actions: assign(({ context, event }) =>
				updatePresentation(context, { speakResponses: event.enabled }),
			),
		},
		PRESENTATION_TURN_RECORDED: {
			actions: assign(({ context, event }) =>
				updatePresentation(context, { turn: event.fact }),
			),
		},
		PRESENTATION_DOCUMENT_COMMITTED: {
			actions: assign(({ context, event }) =>
				updatePresentation(context, { documentCommit: event.document }),
			),
		},
		PRESENTATION_SPEECH_COMMITTED: {
			actions: assign(({ context, event }) =>
				updatePresentation(context, { speechCommit: event.speech }),
			),
		},
		PRESENTATION_TERMINAL_COMMITTED: {
			actions: assign(({ context, event }) =>
				updatePresentation(context, { terminalCommit: event.terminal }),
			),
		},
		PRESENTATION_REPLAYED: {
			actions: assign(({ context }) =>
				updatePresentation(context, {
					replaySequence: context.presentation.replaySequence + 1,
				}),
			),
		},
	},
	states: {
		provider: {
			initial: "preparing",
			states: {
				preparing: {
					on: {
						MODEL_AVAILABLE: {
							target: "available",
							actions: "clearModelFailure",
						},
						MODEL_FAILED: {
							target: "failed",
							actions: "recordModelFailure",
						},
					},
				},
				available: {
					on: {
						MODEL_PREPARATION_STARTED: {
							target: "preparing",
							actions: "clearModelFailure",
						},
						MODEL_FAILED: {
							target: "failed",
							actions: "recordModelFailure",
						},
					},
				},
				failed: {
					on: {
						MODEL_PREPARATION_STARTED: {
							target: "preparing",
							actions: "clearModelFailure",
						},
						MODEL_AVAILABLE: {
							target: "available",
							actions: "clearModelFailure",
						},
					},
				},
			},
		},
		turn: {
			initial: "ready",
			states: {
				ready: {
					on: {
						SUBMIT_PROMPT: [
							{
								guard: and([
									stateIn({ provider: "available" }),
									"transitionAccepted",
								]),
								target: "responding",
								actions: "applyTransition",
							},
							{
								guard: stateIn({ provider: "available" }),
								actions: "applyTransition",
							},
						],
					},
				},
				responding: {
					on: {
						CREATE_ARTIFACT: { actions: "applyTransition" },
						REVISE_ARTIFACT: { actions: "applyTransition" },
						COMPLETE_RESPONSE: [
							{
								guard: "transitionAccepted",
								target: "ready",
								actions: "applyTransition",
							},
							{ actions: "applyTransition" },
						],
					},
				},
			},
		},
	},
});

export const source = createActor(machine).start();

export const component = igniteCore({
	source,
	cleanup: true,
	events: (event) => ({
		"prompt-submitted": event<{
			turnId: string;
			modality: "text" | "speech";
			text: string;
		}>(),
		"artifact-created": event<{ artifactId: string; revision: string }>(),
		"artifact-revised": event<{ artifactId: string; revision: string }>(),
		"artifact-rejected": event<{
			reason: "validation" | "conflict";
		}>(),
		"response-completed": event(),
		"speech-acknowledged": event<{ id: string }>(),
	}),
	view: ({ snapshot }) => {
		const modelPreparing = snapshot.matches({ provider: "preparing" });
		const modelFailed = snapshot.matches({ provider: "failed" });
		const modelAvailable = snapshot.matches({ provider: "available" });
		const responding = snapshot.matches({ turn: "responding" });
		const turnReady = snapshot.matches({ turn: "ready" });
		const status = modelPreparing
			? "preparing"
			: modelFailed
				? "failed"
				: responding
					? "responding"
					: "ready";
		const artifacts = snapshot.context.documents.map((document) => ({
			...document,
			nodes: document.nodes.map((node) => {
				const payload = node.kind === "action" ? node.payload : null;
				const speech =
					typeof payload === "object" &&
					payload !== null &&
					!Array.isArray(payload) &&
					typeof payload.speech === "string" &&
					payload.speech.trim().length > 0
						? payload.speech.trim()
						: undefined;
				const input =
					node.kind === "action" &&
					node.commandName === "completeResponse" &&
					typeof payload === "object" &&
					payload !== null &&
					!Array.isArray(payload) &&
					typeof payload.text === "string" &&
					payload.text.trim().length > 0 &&
					(payload.speech === undefined || speech !== undefined)
						? {
								text: payload.text.trim(),
								...(speech ? { speech } : {}),
							}
						: null;
				return {
					...node,
					action: input ? { enabled: responding, input } : null,
				};
			}),
		}));
		const activeArtifact =
			artifacts.find(
				(artifact) => artifact.id === snapshot.context.activeArtifactId,
			) ??
			artifacts[artifacts.length - 1] ??
			null;
		const turnCount = snapshot.context.messages.filter(
			(message) => message.role === "user",
		).length;
		const presentation = snapshot.context.presentation;
		const voice = presentation.voice;
		const transcript = voice.type === "voice-transcript" ? voice.text : null;
		const transcriptReady = voice.type === "voice-transcript" && voice.final;
		const voiceFailure =
			voice.type === "voice-permission-denied" || voice.type === "voice-error"
				? voice
				: null;
		const documentSchema = JSON.stringify(
			activeArtifact
				? {
						id: activeArtifact.id,
						title: activeArtifact.title,
						revision: activeArtifact.revision,
						nodes: activeArtifact.nodes.map(
							({ action: _action, ...node }) => node,
						),
					}
				: { artifacts: [] },
			null,
			2,
		);
		return {
			sessionId: snapshot.context.sessionId,
			status,
			statusLabel: modelPreparing
				? "Preparing local model"
				: modelFailed
					? "Model unavailable"
					: responding
						? "Responding"
						: "Ready",
			canSubmitPrompt: modelAvailable && turnReady,
			canRetryModel: modelFailed,
			activeArtifact,
			turnCount,
			turnLabel: `${turnCount} ${turnCount === 1 ? "turn" : "turns"}`,
			speechStatus: snapshot.context.speech?.status ?? "idle",
			documentSchema,
			voiceState: voiceState(voice),
			transcript,
			transcriptReady,
			microphoneUnavailable: voice.type === "voice-unsupported",
			voiceFailure,
			turnMessage: describeTurn(presentation.turn),
			lastFactLabel: describeFact(snapshot.context.lastFact),
			modelPreparing,
			modelFailed,
			promptPlaceholder: modelPreparing
				? "Waiting for the local model to finish preparing…"
				: modelFailed
					? "Retry the local model before sending a prompt…"
					: "Ask the agent to create or revise an artifact…",
			turnState: responding ? "responding" : "ready",
			model: {
				status: modelPreparing
					? "preparing"
					: modelFailed
						? "failed"
						: "available",
				failure: snapshot.context.modelFailure,
			},
			revision: snapshot.context.revision,
			messageCount: snapshot.context.messages.length,
			messages: snapshot.context.messages,
			lastFact: snapshot.context.lastFact,
			artifacts,
			speech: snapshot.context.speech,
			activeArtifactId: snapshot.context.activeArtifactId,
			response: snapshot.context.response,
			canRevise: responding && snapshot.context.documents.length > 0,
			presentation: snapshot.context.presentation,
		};
	},
	commands: ({ actor, command }) => {
		const responsePayloadInput = command.object(
			{
				text: command.string({ minLength: 1 }),
				speech: command.string({ minLength: 1 }),
			},
			{ required: ["text"] },
		);
		const actionNodeInput = command.object(
			{
				kind: command.enum(["action"]),
				id: command.string({ minLength: 1 }),
				label: command.string({ minLength: 1 }),
				commandName: command.enum(["completeResponse"]),
				payload: responsePayloadInput,
				description: command.string({ minLength: 1 }),
			},
			{
				required: ["kind", "id", "label", "commandName", "payload"],
			},
		);
		const semanticNodeInput = command.object(
			{
				id: command.string({ minLength: 1 }),
				kind: command.enum([
					"text",
					"checklist",
					"action",
					"form",
					"table",
					"timeline",
					"chart",
					"code-diff",
					"decision-log",
				]),
				text: command.string({ minLength: 1 }),
				items: command.array(
					command.object(
						{
							id: command.string({ minLength: 1 }),
							label: command.string({ minLength: 1 }),
							checked: command.boolean(),
						},
						{ required: ["id", "label", "checked"] },
					),
				),
				label: command.string({ minLength: 1 }),
				commandName: command.enum(["completeResponse"]),
				payload: responsePayloadInput,
				description: command.string({ minLength: 1 }),
				title: command.string({ minLength: 1 }),
				fields: command.array(
					command.object(
						{
							id: command.string({ minLength: 1 }),
							label: command.string({ minLength: 1 }),
							input: command.object(
								{
									type: command.enum(["string", "number", "boolean"]),
									title: command.string({ minLength: 1 }),
									description: command.string({ minLength: 1 }),
									minimum: command.number(),
									maximum: command.number(),
									minLength: command.number({ minimum: 0 }),
									maxLength: command.number({ minimum: 0 }),
								},
								{ required: ["type"] },
							),
							value: command.string(),
							description: command.string({ minLength: 1 }),
						},
						{ required: ["id", "label", "input"] },
					),
				),
				submit: actionNodeInput,
				columns: command.array(
					command.object(
						{
							id: command.string({ minLength: 1 }),
							label: command.string({ minLength: 1 }),
						},
						{ required: ["id", "label"] },
					),
				),
				rows: command.array(
					command.object(
						{
							id: command.string({ minLength: 1 }),
							cells: command.array(),
						},
						{ required: ["id", "cells"] },
					),
				),
				events: command.array(
					command.object(
						{
							id: command.string({ minLength: 1 }),
							label: command.string({ minLength: 1 }),
							timestamp: command.string({ minLength: 1 }),
							detail: command.string({ minLength: 1 }),
						},
						{ required: ["id", "label", "timestamp"] },
					),
				),
				chartType: command.enum(["bar", "line", "pie"]),
				series: command.array(
					command.object(
						{
							id: command.string({ minLength: 1 }),
							label: command.string({ minLength: 1 }),
							value: command.number(),
						},
						{ required: ["id", "label", "value"] },
					),
				),
				language: command.string({ minLength: 1 }),
				before: command.string({ minLength: 1 }),
				after: command.string({ minLength: 1 }),
				entries: command.array(
					command.object(
						{
							id: command.string({ minLength: 1 }),
							title: command.string({ minLength: 1 }),
							decision: command.string({ minLength: 1 }),
							rationale: command.string({ minLength: 1 }),
						},
						{ required: ["id", "title", "decision"] },
					),
				),
			},
			{ required: ["id", "kind"] },
		);

		return {
			acknowledgeSpeech: command(
				(input: AcknowledgeSpeechInput) =>
					actor.send({ type: "ACKNOWLEDGE_SPEECH", input }),
				{
					description: "Acknowledge the currently pending speech request.",
					canExecute: ({ snapshot }) =>
						snapshot.context.speech?.status === "pending",
					input: command.object({ id: command.string({ minLength: 1 }) }),
				},
			),
			completeResponse: command(
				(input: CompleteResponseInput) =>
					actor.send({ type: "COMPLETE_RESPONSE", input }),
				{
					description: "Complete the active response turn.",
					canExecute: ({ snapshot }) =>
						snapshot.matches({ turn: "responding" }),
					input: command.object(
						{
							text: command.string({ minLength: 1 }),
							speech: command.string({ minLength: 1 }),
						},
						{ required: ["text"] },
					),
				},
			),
			createArtifact: command(
				(input: CreateArtifactInput) =>
					actor.send({ type: "CREATE_ARTIFACT", input }),
				{
					description:
						"Create a validated semantic artifact for the active turn.",
					canExecute: ({ snapshot }) =>
						snapshot.matches({ turn: "responding" }),
					input: command.object({
						id: command.string({ minLength: 1 }),
						title: command.string({ minLength: 1 }),
						nodes: command.array(semanticNodeInput, { minItems: 1 }),
					}),
				},
			),
			reviseArtifact: command(
				(input: ReviseArtifactInput) =>
					actor.send({ type: "REVISE_ARTIFACT", input }),
				{
					description:
						"Revise an artifact when its expected revision still matches.",
					canExecute: ({ snapshot }) =>
						snapshot.matches({ turn: "responding" }) &&
						snapshot.context.documents.length > 0,
					input: command.object({
						artifactId: command.string({ minLength: 1 }),
						expectedRevision: command.string({ minLength: 1 }),
						nodes: command.array(semanticNodeInput, { minItems: 1 }),
					}),
				},
			),
			submitPrompt: command(
				(input: SubmitPromptInput) =>
					actor.send({ type: "SUBMIT_PROMPT", input }),
				{
					description: "Open the next text or speech conversation turn.",
					canExecute: ({ snapshot }) =>
						snapshot.matches({ provider: "available" }) &&
						snapshot.matches({ turn: "ready" }),
					input: command.object({
						modality: command.enum(["text", "speech"]),
						text: command.string({ minLength: 1 }),
					}),
				},
			),
		};
	},
	effects: ({ emit, select }) => {
		const fact = select((snapshot) => snapshot.context.lastFact);
		const sequence = select((snapshot) => snapshot.context.factSequence);
		if (!sequence.changed || !fact.current) return;
		emit(fact.current as ConversationFact);
	},
});

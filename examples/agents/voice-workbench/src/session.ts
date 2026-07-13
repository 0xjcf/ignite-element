import { igniteCore } from "ignite-element/xstate";
import { assign, createActor, setup } from "xstate";
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

const machine = setup({
	types: {
		context: {} as ConversationSession,
		events: {} as ConversationAction,
	},
	actions: {
		applyTransition: assign(({ context, event }) => {
			const result = reduceConversationSession(context, event);
			if (result.accepted) return result.session;
			return {
				...context,
				factSequence: context.factSequence + 1,
				lastFact: { type: "artifact-rejected", reason: result.reason },
			};
		}),
	},
	guards: {
		transitionAccepted: ({ context, event }) =>
			reduceConversationSession(context, event).accepted,
	},
}).createMachine({
	id: "conversation-session",
	initial: "ready",
	context: () => createInitialSession("voice-workbench"),
	on: {
		ACKNOWLEDGE_SPEECH: { actions: "applyTransition" },
	},
	states: {
		ready: {
			on: {
				SUBMIT_PROMPT: [
					{
						guard: "transitionAccepted",
						target: "responding",
						actions: "applyTransition",
					},
					{ actions: "applyTransition" },
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
		const responding = snapshot.matches("responding");
		const status = responding ? "responding" : "ready";
		return {
			sessionId: snapshot.context.sessionId,
			status,
			statusLabel: responding ? "Responding" : "Ready",
			canSubmitPrompt: snapshot.matches("ready"),
			revision: snapshot.context.revision,
			messageCount: snapshot.context.messages.length,
			artifacts: snapshot.context.documents.map((document) => ({
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
			})),
			speech: snapshot.context.speech,
			activeArtifactId: snapshot.context.activeArtifactId,
			response: snapshot.context.response,
			canRevise: responding && snapshot.context.documents.length > 0,
		};
	},
	commands: ({ actor, command }) => ({
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
				canExecute: ({ snapshot }) => snapshot.matches("responding"),
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
				canExecute: ({ snapshot }) => snapshot.matches("responding"),
				input: command.object({
					id: command.string({ minLength: 1 }),
					title: command.string({ minLength: 1 }),
					nodes: command.array(
						command.object({
							id: command.string({ minLength: 1 }),
							kind: command.string({ minLength: 1 }),
						}),
						{ minItems: 1 },
					),
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
					snapshot.matches("responding") &&
					snapshot.context.documents.length > 0,
				input: command.object({
					artifactId: command.string({ minLength: 1 }),
					expectedRevision: command.string({ minLength: 1 }),
					nodes: command.array(
						command.object({
							id: command.string({ minLength: 1 }),
							kind: command.string({ minLength: 1 }),
						}),
						{ minItems: 1 },
					),
				}),
			},
		),
		submitPrompt: command(
			(input: SubmitPromptInput) =>
				actor.send({ type: "SUBMIT_PROMPT", input }),
			{
				description: "Open the next text or speech conversation turn.",
				canExecute: ({ snapshot }) => snapshot.matches("ready"),
				input: command.object({
					modality: command.enum(["text", "speech"]),
					text: command.string({ minLength: 1 }),
				}),
			},
		),
	}),
	effects: ({ emit, select }) => {
		const fact = select((snapshot) => snapshot.context.lastFact);
		const sequence = select((snapshot) => snapshot.context.factSequence);
		if (!sequence.changed || !fact.current) return;
		emit(fact.current as ConversationFact);
	},
});

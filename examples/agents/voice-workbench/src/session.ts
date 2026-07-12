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
	projectConversationView,
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
}).createMachine({
	id: "conversation-session",
	initial: "running",
	context: () => createInitialSession("voice-workbench"),
	states: {
		running: {
			on: {
				SUBMIT_PROMPT: { actions: "applyTransition" },
				CREATE_ARTIFACT: { actions: "applyTransition" },
				REVISE_ARTIFACT: { actions: "applyTransition" },
				COMPLETE_RESPONSE: { actions: "applyTransition" },
				ACKNOWLEDGE_SPEECH: { actions: "applyTransition" },
			},
		},
	},
});

export const source = createActor(machine).start();

export const component = igniteCore({
	source,
	cleanup: true,
	events: (event) => ({
		"artifact-created": event<{ artifactId: string; revision: string }>(),
		"artifact-revised": event<{ artifactId: string; revision: string }>(),
		"artifact-rejected": event<{
			reason: "validation" | "conflict";
		}>(),
		"response-completed": event(),
		"speech-acknowledged": event<{ id: string }>(),
	}),
	view: ({ snapshot }) => projectConversationView(snapshot.context),
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
				canExecute: ({ snapshot }) => snapshot.context.phase === "responding",
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
				canExecute: ({ snapshot }) => snapshot.context.phase === "responding",
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
					snapshot.context.phase === "responding" &&
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
				canExecute: ({ snapshot }) => snapshot.context.phase === "ready",
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

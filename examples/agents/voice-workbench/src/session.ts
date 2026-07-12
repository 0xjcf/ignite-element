import type { EventBuilder } from "@ignite-element/core";
import { igniteCore } from "ignite-element/xstate";
import { assign, createActor, setup } from "xstate";
import {
	ARTIFACT_KINDS,
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
			},
		},
	},
});

type SessionActor = ReturnType<typeof createActor<typeof machine>>;
type WorkbenchCommands = {
	completeResponse: (input: CompleteResponseInput) => unknown;
	createArtifact: (input: CreateArtifactInput) => unknown;
	reviseArtifact: (input: ReviseArtifactInput) => unknown;
	submitPrompt: (input: SubmitPromptInput) => unknown;
};

type WorkbenchView = ReturnType<typeof projectConversationView>;

const eventDefinitions = (event: EventBuilder) => ({
	"artifact-created": event<{ artifactId: string; revision: number }>(),
	"artifact-revised": event<{ artifactId: string; revision: number }>(),
	"artifact-rejected": event<{ reason: "validation" | "conflict" }>(),
	"response-completed": event(),
});

export const source: SessionActor = createActor(machine).start();

export const component = igniteCore<
	typeof machine,
	typeof eventDefinitions,
	WorkbenchView,
	WorkbenchCommands
>({
	source,
	cleanup: true,
	events: eventDefinitions,
	view: ({ snapshot }) => projectConversationView(snapshot.context),
	commands: ({ actor, command }) => ({
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
					kind: command.enum(ARTIFACT_KINDS),
					nodes: command.array(
						command.object({ type: command.string({ minLength: 1 }) }),
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
					snapshot.context.artifacts.length > 0,
				input: command.object({
					artifactId: command.string({ minLength: 1 }),
					expectedRevision: command.number({ minimum: 1 }),
					nodes: command.array(
						command.object({ type: command.string({ minLength: 1 }) }),
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

export type VoiceWorkbenchComponent = typeof component;

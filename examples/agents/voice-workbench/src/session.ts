import type { IgniteAgentRuntime } from "ignite-element";
import { igniteCore } from "ignite-element/xstate";
import { assign, createActor, setup } from "xstate";
import {
	ARTIFACT_KINDS,
	type ArtifactNode,
	type CompleteResponseInput,
	type ConversationAction,
	type ConversationFact,
	type ConversationSession,
	type CreateArtifactInput,
	createInitialSession,
	projectConversationView,
	type ReviseArtifactInput,
	reduceConversationSession,
} from "./domain";

const machine = setup({
	types: {
		context: {} as ConversationSession,
		events: {} as ConversationAction,
		input: {} as { sessionId: string },
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
	initial: "active",
	context: ({ input }) => createInitialSession(input.sessionId),
	states: {
		active: {
			on: {
				RECORD_PROMPT: { actions: "applyTransition" },
				RECORD_PROPOSAL: { actions: "applyTransition" },
				CREATE_ARTIFACT: { actions: "applyTransition" },
				REVISE_ARTIFACT: { actions: "applyTransition" },
				COMPLETE_RESPONSE: {
					target: "completed",
					actions: "applyTransition",
				},
			},
		},
		completed: {},
	},
});

type SessionActor = ReturnType<typeof createActor<typeof machine>>;

type ConversationCommands = {
	completeResponse: (input: CompleteResponseInput) => unknown;
	createArtifact: (input: CreateArtifactInput) => unknown;
	reviseArtifact: (input: ReviseArtifactInput) => unknown;
};

type ConversationEvents = {
	readonly "artifact-created": {
		readonly __payload?: { artifactId: string; revision: number };
	};
	readonly "artifact-revised": {
		readonly __payload?: { artifactId: string; revision: number };
	};
	readonly "artifact-rejected": {
		readonly __payload?: { reason: "validation" | "conflict" };
	};
	readonly "response-completed": { readonly __payload?: Record<never, never> };
};

type ConversationView = ReturnType<typeof projectConversationView>;
type ConversationSnapshot = { context: ConversationSession };

export type ConversationRuntime = IgniteAgentRuntime<
	ConversationSnapshot,
	ConversationCommands,
	ConversationEvents,
	ConversationSession,
	ConversationView
>;

export type ConversationSessionHandle = {
	runtime: ConversationRuntime;
	recordPrompt(channel: "text" | "speech", text: string): void;
	recordProposal(command: string): void;
	close(): void;
};

function createRuntime(actor: SessionActor) {
	return igniteCore({
		source: actor,
		events: (event) => ({
			"artifact-created": event<{ artifactId: string; revision: number }>(),
			"artifact-revised": event<{ artifactId: string; revision: number }>(),
			"artifact-rejected": event<{
				reason: "validation" | "conflict";
			}>(),
			"response-completed": event(),
		}),
		view: ({ snapshot }) => projectConversationView(snapshot.context),
		commands: ({ actor: source, command }) => ({
			completeResponse: command(
				(input: CompleteResponseInput) =>
					source.send({ type: "COMPLETE_RESPONSE", input }),
				{
					description:
						"Complete the current response with text and optional speech.",
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
					source.send({ type: "CREATE_ARTIFACT", input }),
				{
					description: "Create a validated semantic artifact.",
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
					source.send({ type: "REVISE_ARTIFACT", input }),
				{
					description:
						"Revise an artifact when its expected revision still matches.",
					canExecute: ({ snapshot }) =>
						snapshot.context.status === "active" &&
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
		}),
		effects: ({ emit, select }) => {
			const fact = select((snapshot) => snapshot.context.lastFact);
			const sequence = select((snapshot) => snapshot.context.factSequence);
			if (!sequence.changed || !fact.current) return;
			emit(fact.current as ConversationFact);
		},
	});
}

export function createConversationSession(
	sessionId: string,
): ConversationSessionHandle {
	const actor = createActor(machine, { input: { sessionId } }).start();
	const runtime = createRuntime(actor);
	let closed = false;

	return {
		runtime: runtime as unknown as ConversationRuntime,
		recordPrompt(channel: "text" | "speech", text: string) {
			actor.send({ type: "RECORD_PROMPT", channel, text });
		},
		recordProposal(command: string) {
			actor.send({ type: "RECORD_PROPOSAL", command });
		},
		close() {
			if (closed) return;
			closed = true;
			actor.stop();
		},
	};
}

export type { ArtifactNode };

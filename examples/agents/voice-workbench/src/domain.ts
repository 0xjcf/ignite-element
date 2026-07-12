import type {
	createProjectionDocumentTarget,
	createProjectionSpeechTarget,
} from "ignite-element/xstate";

type ProjectionDocument = Parameters<
	Parameters<typeof createProjectionDocumentTarget>[0]["commitDocument"]
>[0];
type ProjectionDocumentNode = ProjectionDocument["nodes"][number];
type ProjectionSpeechRequest = Parameters<
	Parameters<typeof createProjectionSpeechTarget>[0]["commitSpeech"]
>[0];

export type CreateArtifactInput = {
	id: string;
	title: string;
	nodes: readonly ProjectionDocumentNode[];
};

export type ReviseArtifactInput = {
	artifactId: string;
	expectedRevision: string;
	nodes: readonly ProjectionDocumentNode[];
};

export type CompleteResponseInput = { text: string; speech?: string };
export type SubmitPromptInput = {
	modality: "text" | "speech";
	text: string;
};
export type AcknowledgeSpeechInput = { id: string };

export type ConversationMessage = {
	role: "user" | "assistant";
	channel: "text" | "speech";
	text: string;
};

export type ConversationFact =
	| { type: "artifact-created"; artifactId: string; revision: string }
	| { type: "artifact-revised"; artifactId: string; revision: string }
	| { type: "artifact-rejected"; reason: "validation" | "conflict" }
	| { type: "response-completed" }
	| { type: "speech-acknowledged"; id: string };

export type ConversationSession = {
	sessionId: string;
	phase: "ready" | "responding";
	revision: number;
	factSequence: number;
	messages: readonly ConversationMessage[];
	documents: readonly ProjectionDocument[];
	speech: ProjectionSpeechRequest | null;
	activeArtifactId: string | null;
	response: CompleteResponseInput | null;
	lastFact: ConversationFact | null;
};

export type ConversationAction =
	| { type: "SUBMIT_PROMPT"; input: SubmitPromptInput }
	| { type: "CREATE_ARTIFACT"; input: CreateArtifactInput }
	| { type: "REVISE_ARTIFACT"; input: ReviseArtifactInput }
	| { type: "COMPLETE_RESPONSE"; input: CompleteResponseInput }
	| { type: "ACKNOWLEDGE_SPEECH"; input: AcknowledgeSpeechInput };

export type TransitionResult =
	| { accepted: true; session: ConversationSession }
	| {
			accepted: false;
			reason: "validation" | "conflict";
			session: ConversationSession;
	  };

export function createInitialSession(sessionId: string): ConversationSession {
	return {
		sessionId,
		phase: "ready",
		revision: 0,
		factSequence: 0,
		messages: [],
		documents: [],
		speech: null,
		activeArtifactId: null,
		response: null,
		lastFact: null,
	};
}

const accepted = (
	session: ConversationSession,
	patch: Partial<ConversationSession>,
): TransitionResult => ({
	accepted: true,
	session: { ...session, ...patch, revision: session.revision + 1 },
});

const rejected = (
	session: ConversationSession,
	reason: "validation" | "conflict",
): TransitionResult => ({ accepted: false, reason, session });

const isNonEmpty = (value: string): boolean => value.trim().length > 0;
const validNodes = (nodes: readonly ProjectionDocumentNode[]): boolean =>
	nodes.length > 0 &&
	nodes.every((node) => isNonEmpty(node.id) && isNonEmpty(node.kind));

const nextDocumentRevision = (revision: string): string => {
	const current = Number.parseInt(revision, 10);
	return Number.isSafeInteger(current) && current >= 0
		? String(current + 1)
		: `${revision}.1`;
};

export function reduceConversationSession(
	session: ConversationSession,
	action: ConversationAction,
): TransitionResult {
	switch (action.type) {
		case "SUBMIT_PROMPT":
			if (session.phase !== "ready" || !isNonEmpty(action.input.text)) {
				return rejected(session, "validation");
			}
			return accepted(session, {
				phase: "responding",
				response: null,
				messages: [
					...session.messages,
					{
						role: "user",
						channel: action.input.modality,
						text: action.input.text.trim(),
					},
				],
			});
		case "CREATE_ARTIFACT": {
			const input = action.input;
			if (
				session.phase !== "responding" ||
				!isNonEmpty(input.id) ||
				!isNonEmpty(input.title) ||
				!validNodes(input.nodes) ||
				session.documents.some((document) => document.id === input.id)
			) {
				return rejected(session, "validation");
			}
			const document: ProjectionDocument = { ...input, revision: "1" };
			return accepted(session, {
				documents: [...session.documents, document],
				activeArtifactId: document.id,
				lastFact: {
					type: "artifact-created",
					artifactId: document.id,
					revision: document.revision,
				},
				factSequence: session.factSequence + 1,
			});
		}
		case "REVISE_ARTIFACT": {
			if (session.phase !== "responding") {
				return rejected(session, "validation");
			}
			const index = session.documents.findIndex(
				(document) => document.id === action.input.artifactId,
			);
			const current = session.documents[index];
			if (!current || current.revision !== action.input.expectedRevision) {
				return rejected(session, "conflict");
			}
			if (!validNodes(action.input.nodes)) {
				return rejected(session, "validation");
			}
			const revision = nextDocumentRevision(current.revision);
			const documents = session.documents.map((document, documentIndex) =>
				documentIndex === index
					? { ...document, nodes: action.input.nodes, revision }
					: document,
			);
			return accepted(session, {
				documents,
				activeArtifactId: current.id,
				lastFact: {
					type: "artifact-revised",
					artifactId: current.id,
					revision,
				},
				factSequence: session.factSequence + 1,
			});
		}
		case "COMPLETE_RESPONSE": {
			if (session.phase !== "responding" || !isNonEmpty(action.input.text)) {
				return rejected(session, "validation");
			}
			const text = action.input.text.trim();
			const speechText = action.input.speech?.trim();
			return accepted(session, {
				phase: "ready",
				response: { text, ...(speechText ? { speech: speechText } : {}) },
				speech: speechText
					? {
							id: `response-${session.revision + 1}`,
							text: speechText,
							status: "pending",
						}
					: null,
				messages: [
					...session.messages,
					{ role: "assistant", channel: "text", text },
				],
				lastFact: { type: "response-completed" },
				factSequence: session.factSequence + 1,
			});
		}
		case "ACKNOWLEDGE_SPEECH":
			if (
				!session.speech ||
				session.speech.status !== "pending" ||
				session.speech.id !== action.input.id
			) {
				return rejected(session, "conflict");
			}
			return accepted(session, {
				speech: { ...session.speech, status: "acknowledged" },
				lastFact: { type: "speech-acknowledged", id: action.input.id },
				factSequence: session.factSequence + 1,
			});
	}
}

export function projectConversationView(session: ConversationSession) {
	return {
		sessionId: session.sessionId,
		status: session.phase,
		revision: session.revision,
		messageCount: session.messages.length,
		documents: session.documents,
		speech: session.speech,
		activeArtifactId: session.activeArtifactId,
		response: session.response,
		canRevise: session.phase === "responding" && session.documents.length > 0,
	};
}

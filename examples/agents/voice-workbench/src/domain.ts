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
	title?: string;
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
	| {
			type: "prompt-submitted";
			turnId: string;
			modality: "text" | "speech";
			text: string;
	  }
	| { type: "artifact-created"; artifactId: string; revision: string }
	| { type: "artifact-revised"; artifactId: string; revision: string }
	| { type: "artifact-rejected"; reason: "validation" | "conflict" }
	| { type: "response-completed" }
	| { type: "speech-acknowledged"; id: string };

export type ConversationSession = {
	sessionId: string;
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmpty = (value: unknown): value is string =>
	typeof value === "string" && value.trim().length > 0;

const isOptionalString = (value: unknown): value is string | undefined =>
	value === undefined || isNonEmpty(value);

const isSchemaValue = (value: unknown, depth = 0): boolean => {
	if (depth > 12) return false;
	if (
		value === null ||
		typeof value === "string" ||
		typeof value === "boolean"
	) {
		return true;
	}
	if (typeof value === "number") return Number.isFinite(value);
	if (Array.isArray(value)) {
		return value.every((entry) => isSchemaValue(entry, depth + 1));
	}
	if (!isRecord(value)) return false;
	return Object.values(value).every((entry) => isSchemaValue(entry, depth + 1));
};

const hasUniqueIds = (values: readonly unknown[]): boolean => {
	const ids = new Set<string>();
	for (const value of values) {
		if (!isRecord(value) || !isNonEmpty(value.id) || ids.has(value.id)) {
			return false;
		}
		ids.add(value.id);
	}
	return true;
};

const validActionNode = (value: unknown): boolean => {
	if (
		!isRecord(value) ||
		value.kind !== "action" ||
		!isNonEmpty(value.id) ||
		!isNonEmpty(value.label) ||
		value.commandName !== "completeResponse" ||
		!isOptionalString(value.description) ||
		!isRecord(value.payload) ||
		!isNonEmpty(value.payload.text) ||
		!isOptionalString(value.payload.speech)
	) {
		return false;
	}
	return true;
};

const validNode = (value: unknown): value is ProjectionDocumentNode => {
	if (!isRecord(value) || !isNonEmpty(value.id)) return false;

	switch (value.kind) {
		case "text":
			return isNonEmpty(value.text);
		case "checklist":
			return (
				Array.isArray(value.items) &&
				hasUniqueIds(value.items) &&
				value.items.every(
					(item) =>
						isRecord(item) &&
						isNonEmpty(item.label) &&
						typeof item.checked === "boolean",
				)
			);
		case "action":
			return validActionNode(value);
		case "form":
			return (
				isOptionalString(value.title) &&
				Array.isArray(value.fields) &&
				hasUniqueIds(value.fields) &&
				value.fields.every(
					(field) =>
						isRecord(field) &&
						isNonEmpty(field.label) &&
						isRecord(field.input) &&
						isSchemaValue(field.input) &&
						(field.value === undefined || isSchemaValue(field.value)) &&
						isOptionalString(field.description),
				) &&
				(value.submit === undefined || validActionNode(value.submit))
			);
		case "table":
			return (
				Array.isArray(value.columns) &&
				hasUniqueIds(value.columns) &&
				value.columns.every(
					(column) => isRecord(column) && isNonEmpty(column.label),
				) &&
				Array.isArray(value.rows) &&
				hasUniqueIds(value.rows) &&
				value.rows.every(
					(row) =>
						isRecord(row) &&
						Array.isArray(row.cells) &&
						row.cells.every((cell) => isSchemaValue(cell)),
				)
			);
		case "timeline":
			return (
				Array.isArray(value.events) &&
				hasUniqueIds(value.events) &&
				value.events.every(
					(event) =>
						isRecord(event) &&
						isNonEmpty(event.label) &&
						isNonEmpty(event.timestamp) &&
						isOptionalString(event.detail),
				)
			);
		case "chart":
			return (
				(value.chartType === "bar" ||
					value.chartType === "line" ||
					value.chartType === "pie") &&
				Array.isArray(value.series) &&
				hasUniqueIds(value.series) &&
				value.series.every(
					(series) =>
						isRecord(series) &&
						isNonEmpty(series.label) &&
						typeof series.value === "number" &&
						Number.isFinite(series.value),
				)
			);
		case "code-diff":
			return (
				isOptionalString(value.language) &&
				isOptionalString(value.before) &&
				isOptionalString(value.after)
			);
		case "decision-log":
			return (
				Array.isArray(value.entries) &&
				hasUniqueIds(value.entries) &&
				value.entries.every(
					(entry) =>
						isRecord(entry) &&
						isNonEmpty(entry.title) &&
						isNonEmpty(entry.decision) &&
						isOptionalString(entry.rationale),
				)
			);
		default:
			return false;
	}
};

const validNodes = (
	nodes: unknown,
): nodes is readonly ProjectionDocumentNode[] =>
	Array.isArray(nodes) &&
	nodes.length > 0 &&
	hasUniqueIds(nodes) &&
	nodes.every(validNode);

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
		case "SUBMIT_PROMPT": {
			if (!isNonEmpty(action.input.text)) {
				return rejected(session, "validation");
			}
			const text = action.input.text.trim();
			const turnId = `${session.sessionId}:${session.revision + 1}`;
			return accepted(session, {
				response: null,
				messages: [
					...session.messages,
					{
						role: "user",
						channel: action.input.modality,
						text,
					},
				],
				lastFact: {
					type: "prompt-submitted",
					turnId,
					modality: action.input.modality,
					text,
				},
				factSequence: session.factSequence + 1,
			});
		}
		case "CREATE_ARTIFACT": {
			const input = action.input;
			if (
				!isNonEmpty(input.id) ||
				!isOptionalString(input.title) ||
				!validNodes(input.nodes) ||
				session.documents.some((document) => document.id === input.id)
			) {
				return rejected(session, "validation");
			}
			const document: ProjectionDocument = {
				id: input.id.trim(),
				...(input.title ? { title: input.title.trim() } : {}),
				nodes: input.nodes,
				revision: "1",
			};
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
			if (!isNonEmpty(action.input.text)) {
				return rejected(session, "validation");
			}
			const text = action.input.text.trim();
			const speechText = action.input.speech?.trim();
			return accepted(session, {
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

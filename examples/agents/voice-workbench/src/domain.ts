export const ARTIFACT_KINDS = [
	"text",
	"markdown",
	"checklist",
	"form",
	"table",
	"timeline",
	"decision-log",
	"code-diff",
	"command-action",
] as const;

export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export type ArtifactNode =
	| { type: "text" | "markdown"; content: string }
	| {
			type: "checklist";
			items: ReadonlyArray<{ text: string; checked: boolean }>;
	  }
	| {
			type: "form";
			fields: ReadonlyArray<{
				name: string;
				label: string;
				inputType: "text" | "email" | "number";
				required?: boolean;
			}>;
	  }
	| {
			type: "table";
			columns: readonly string[];
			rows: ReadonlyArray<readonly string[]>;
	  }
	| {
			type: "timeline";
			items: ReadonlyArray<{ label: string; detail: string }>;
	  }
	| {
			type: "decision-log";
			entries: ReadonlyArray<{ decision: string; rationale: string }>;
	  }
	| { type: "code-diff"; language: string; diff: string }
	| { type: "command-action"; command: string; label: string };

export type CreateArtifactInput = {
	id: string;
	title: string;
	kind: ArtifactKind;
	nodes: readonly ArtifactNode[];
};

export type ReviseArtifactInput = {
	artifactId: string;
	expectedRevision: number;
	nodes: readonly ArtifactNode[];
};

export type CompleteResponseInput = {
	text: string;
	speech?: string;
};

export type SubmitPromptInput = {
	modality: "text" | "speech";
	text: string;
};

export type ConversationMessage = {
	role: "user" | "assistant";
	channel: "text" | "speech" | "tool";
	text: string;
};

export type Artifact = CreateArtifactInput & { revision: number };

export type ConversationFact =
	| { type: "artifact-created"; artifactId: string; revision: number }
	| { type: "artifact-revised"; artifactId: string; revision: number }
	| { type: "artifact-rejected"; reason: "validation" | "conflict" }
	| { type: "response-completed" };

export type ConversationSession = {
	sessionId: string;
	phase: "ready" | "responding";
	revision: number;
	factSequence: number;
	messages: readonly ConversationMessage[];
	artifacts: readonly Artifact[];
	activeArtifactId: string | null;
	response: CompleteResponseInput | null;
	lastFact: ConversationFact | null;
};

export type ConversationAction =
	| { type: "SUBMIT_PROMPT"; input: SubmitPromptInput }
	| { type: "CREATE_ARTIFACT"; input: CreateArtifactInput }
	| { type: "REVISE_ARTIFACT"; input: ReviseArtifactInput }
	| { type: "COMPLETE_RESPONSE"; input: CompleteResponseInput };

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
		artifacts: [],
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

const isArtifactKind = (value: string): value is ArtifactKind =>
	ARTIFACT_KINDS.includes(value as ArtifactKind);

const validNodes = (nodes: readonly ArtifactNode[]): boolean =>
	nodes.length > 0 && nodes.every((node) => isArtifactKind(node.type));

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
				!isArtifactKind(input.kind) ||
				!validNodes(input.nodes) ||
				session.artifacts.some((artifact) => artifact.id === input.id)
			) {
				return rejected(session, "validation");
			}
			const artifact: Artifact = { ...input, revision: 1 };
			return accepted(session, {
				artifacts: [...session.artifacts, artifact],
				activeArtifactId: artifact.id,
				lastFact: {
					type: "artifact-created",
					artifactId: artifact.id,
					revision: artifact.revision,
				},
				factSequence: session.factSequence + 1,
			});
		}
		case "REVISE_ARTIFACT": {
			if (session.phase !== "responding") {
				return rejected(session, "validation");
			}
			const index = session.artifacts.findIndex(
				(artifact) => artifact.id === action.input.artifactId,
			);
			const current = session.artifacts[index];
			if (!current || current.revision !== action.input.expectedRevision) {
				return rejected(session, "conflict");
			}
			if (!validNodes(action.input.nodes)) {
				return rejected(session, "validation");
			}
			const revision = current.revision + 1;
			const artifacts = session.artifacts.map((artifact, artifactIndex) =>
				artifactIndex === index
					? { ...artifact, nodes: action.input.nodes, revision }
					: artifact,
			);
			return accepted(session, {
				artifacts,
				activeArtifactId: current.id,
				lastFact: {
					type: "artifact-revised",
					artifactId: current.id,
					revision,
				},
				factSequence: session.factSequence + 1,
			});
		}
		case "COMPLETE_RESPONSE":
			if (session.phase !== "responding" || !isNonEmpty(action.input.text)) {
				return rejected(session, "validation");
			}
			return accepted(session, {
				phase: "ready",
				response: {
					text: action.input.text.trim(),
					...(action.input.speech?.trim()
						? { speech: action.input.speech.trim() }
						: {}),
				},
				messages: [
					...session.messages,
					{
						role: "assistant",
						channel: "text",
						text: action.input.text.trim(),
					},
				],
				lastFact: { type: "response-completed" },
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
		artifactCount: session.artifacts.length,
		artifacts: session.artifacts,
		activeArtifactId: session.activeArtifactId,
		response: session.response,
		canRevise: session.phase === "responding" && session.artifacts.length > 0,
	};
}

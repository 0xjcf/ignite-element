import {
	isPendingSpeechRequest,
	validateProjectionSelection,
} from "./projectionDocument";
import type {
	ProjectionDocument,
	ProjectionSpeechRequest,
} from "../types/agent";
import type { IgniteAgentSchema, IgniteSchemaValue } from "../types/schema";

type ProjectionCommitResult =
	| { status: "committed" }
	| { status: "unsupported"; reason: string };

type ProjectionCommitValue = ProjectionCommitResult | undefined;

export type ProjectionInspection = {
	readonly snapshot: unknown;
	readonly view: unknown;
	readonly schema: IgniteAgentSchema<IgniteSchemaValue, IgniteSchemaValue>;
	readonly canExecute: (commandName: string) => boolean;
	readonly revision: string;
	readonly documents: readonly ProjectionDocument[];
	readonly speech: ProjectionSpeechRequest | null;
};

type Projection<Format extends "document" | "speech", Output> = {
	readonly channel: Format;
	select(inspection: ProjectionInspection): Output | null;
	identity(value: Output): string;
};

export type ProjectionBindingState = {
	readonly documentRevisionById: Map<string, string>;
	activeSpeechId: string | null;
	lastAcknowledgedSpeechId: string | null;
};

export type ProjectionBindingFact =
	| {
			channel: "document";
			status: "committed";
			documentId: string;
			revision: string;
	  }
	| {
			channel: "document";
			status: "skipped";
			reason: "missing-document" | "duplicate-document";
	  }
	| {
			channel: "document";
			status: "unsupported";
			documentId: string;
			revision: string;
			reason: string;
	  }
	| {
			channel: "document";
			status: "error";
			documentId: string;
			revision: string;
			reason: string;
	  }
	| {
			channel: "speech";
			status: "committed";
			speechId: string;
	  }
	| {
			channel: "speech";
			status: "skipped";
			reason: "missing-speech" | "duplicate-speech" | "acknowledged-speech";
	  }
	| {
			channel: "speech";
			status: "unsupported";
			speechId: string;
			reason: string;
	  }
	| {
			channel: "speech";
			status: "error";
			speechId: string;
			reason: string;
	  };

export function createProjectionBindingState(): ProjectionBindingState {
	return {
		documentRevisionById: new Map<string, string>(),
		activeSpeechId: null,
		lastAcknowledgedSpeechId: null,
	};
}

export function createProjectionDocument(
	documentId?: string,
): Projection<"document", ProjectionDocument> {
	return {
		channel: "document",
		select(inspection) {
			return typeof documentId === "string"
				? (inspection.documents.find((entry) => entry.id === documentId) ??
						null)
				: (inspection.documents[0] ?? null);
		},
		identity(document) {
			return `${document.id}:${document.revision}`;
		},
	};
}

export function createProjectionSpeech(): Projection<
	"speech",
	ProjectionSpeechRequest
> {
	return {
		channel: "speech",
		select(inspection) {
			return inspection.speech;
		},
		identity(speech) {
			return speech.id;
		},
	};
}

function normalizeCommitResult(
	result: ProjectionCommitValue,
): ProjectionCommitResult {
	return result ?? { status: "committed" };
}

export async function commitProjectionDocumentTarget({
	state,
	inspection,
	projection = createProjectionDocument(),
	commitDocument,
}: {
	state: ProjectionBindingState;
	inspection: ProjectionInspection;
	projection?: Projection<"document", ProjectionDocument>;
	commitDocument: (
		document: ProjectionDocument,
	) =>
		| ProjectionCommitValue
		| void
		| Promise<ProjectionCommitValue>
		| Promise<void>;
}): Promise<ProjectionBindingFact> {
	const document = projection.select(inspection);

	if (!document) {
		return {
			channel: "document",
			status: "skipped",
			reason: "missing-document",
		};
	}

	const previousRevision = state.documentRevisionById.get(document.id);
	if (previousRevision === document.revision) {
		return {
			channel: "document",
			status: "skipped",
			reason: "duplicate-document",
		};
	}

	const issues = validateProjectionSelection(document, inspection);
	if (issues.length > 0) {
		return {
			channel: "document",
			status: "error",
			documentId: document.id,
			revision: document.revision,
			reason: issues.join("; "),
		};
	}

	state.documentRevisionById.set(document.id, document.revision);

	try {
		const result = normalizeCommitResult(
			(await commitDocument(document)) ?? undefined,
		);
		if (result.status === "unsupported") {
			return {
				channel: "document",
				status: "unsupported",
				documentId: document.id,
				revision: document.revision,
				reason: result.reason,
			};
		}

		return {
			channel: "document",
			status: "committed",
			documentId: document.id,
			revision: document.revision,
		};
	} catch (error) {
		return {
			channel: "document",
			status: "error",
			documentId: document.id,
			revision: document.revision,
			reason: error instanceof Error ? error.message : String(error),
		};
	}
}

export async function commitProjectionSpeechTarget({
	state,
	inspection,
	projection = createProjectionSpeech(),
	commitSpeech,
	acknowledge,
}: {
	state: ProjectionBindingState;
	inspection: ProjectionInspection;
	projection?: Projection<"speech", ProjectionSpeechRequest>;
	commitSpeech: (
		speech: ProjectionSpeechRequest,
	) =>
		| ProjectionCommitValue
		| void
		| Promise<ProjectionCommitValue>
		| Promise<void>;
	acknowledge: (speech: ProjectionSpeechRequest) => Promise<void>;
}): Promise<ProjectionBindingFact> {
	const speech = projection.select(inspection);
	const wasAcknowledged = speech !== null && speech.status === "acknowledged";
	if (!isPendingSpeechRequest(speech)) {
		return {
			channel: "speech",
			status: "skipped",
			reason: wasAcknowledged ? "acknowledged-speech" : "missing-speech",
		};
	}

	if (
		state.activeSpeechId === projection.identity(speech) ||
		state.lastAcknowledgedSpeechId === projection.identity(speech)
	) {
		return {
			channel: "speech",
			status: "skipped",
			reason: "duplicate-speech",
		};
	}

	state.activeSpeechId = projection.identity(speech);

	try {
		const result = normalizeCommitResult(
			(await commitSpeech(speech)) ?? undefined,
		);
		if (result.status === "unsupported") {
			return {
				channel: "speech",
				status: "unsupported",
				speechId: speech.id,
				reason: result.reason,
			};
		}

		await acknowledge(speech);
		state.lastAcknowledgedSpeechId = projection.identity(speech);
		return {
			channel: "speech",
			status: "committed",
			speechId: speech.id,
		};
	} catch (error) {
		return {
			channel: "speech",
			status: "error",
			speechId: speech.id,
			reason: error instanceof Error ? error.message : String(error),
		};
	}
}

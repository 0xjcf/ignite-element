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

type ProjectionCommitValue = ProjectionCommitResult | void;

export type ProjectionInspection = {
	readonly snapshot: unknown;
	readonly view: unknown;
	readonly schema: IgniteAgentSchema<IgniteSchemaValue, IgniteSchemaValue>;
	readonly canExecute: (commandName: string) => boolean;
	readonly revision: string;
	readonly documents: readonly ProjectionDocument[];
	readonly speech: ProjectionSpeechRequest | null;
};

export type ProjectionBindingState = {
	readonly documentRevisions: Set<string>;
	readonly speechIds: Set<string>;
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
		documentRevisions: new Set<string>(),
		speechIds: new Set<string>(),
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
	documentId,
	commitDocument,
}: {
	state: ProjectionBindingState;
	inspection: ProjectionInspection;
	documentId?: string;
	commitDocument: (
		document: ProjectionDocument,
	) => ProjectionCommitValue | Promise<ProjectionCommitValue>;
}): Promise<ProjectionBindingFact> {
	const document =
		typeof documentId === "string"
			? inspection.documents.find((entry) => entry.id === documentId)
			: inspection.documents[0];

	if (!document) {
		return {
			channel: "document",
			status: "skipped",
			reason: "missing-document",
		};
	}

	const reservationKey = `${document.id}:${document.revision}`;
	if (state.documentRevisions.has(reservationKey)) {
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

	state.documentRevisions.add(reservationKey);

	try {
		const result = normalizeCommitResult(await commitDocument(document));
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
	commitSpeech,
	acknowledge,
}: {
	state: ProjectionBindingState;
	inspection: ProjectionInspection;
	commitSpeech: (
		speech: ProjectionSpeechRequest,
	) => ProjectionCommitValue | Promise<ProjectionCommitValue>;
	acknowledge: (speech: ProjectionSpeechRequest) => Promise<void>;
}): Promise<ProjectionBindingFact> {
	const speech = inspection.speech;
	const wasAcknowledged =
		inspection.speech !== null && inspection.speech.status === "acknowledged";
	if (!isPendingSpeechRequest(speech)) {
		return {
			channel: "speech",
			status: "skipped",
			reason: wasAcknowledged ? "acknowledged-speech" : "missing-speech",
		};
	}

	if (state.speechIds.has(speech.id)) {
		return {
			channel: "speech",
			status: "skipped",
			reason: "duplicate-speech",
		};
	}

	state.speechIds.add(speech.id);

	try {
		const result = normalizeCommitResult(await commitSpeech(speech));
		if (result.status === "unsupported") {
			return {
				channel: "speech",
				status: "unsupported",
				speechId: speech.id,
				reason: result.reason,
			};
		}

		await acknowledge(speech);
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

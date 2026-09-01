import type {
	ProjectionDocument,
	ProjectionSpeechRequest,
} from "../types/agent";
import type { IgniteAgentSchema, IgniteSchemaValue } from "../types/schema";
import {
	isPendingSpeechRequest,
	validateProjectionSelection,
} from "./projectionDocument";

type ProjectionCommitResult =
	| { status: "committed" }
	| { status: "unsupported"; reason: string };

type ProjectionCommitValue = ProjectionCommitResult | undefined;

export type ProjectionInspection = {
	readonly snapshot: unknown;
	readonly states: unknown;
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
	readonly documentIdentityById: Map<string, string>;
	activeSpeechId: string | null;
	deliveredSpeechId: string | null;
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
			documentId?: string;
			revision?: string;
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
			speechId?: string;
			reason: string;
	  };

function errorReason(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function createProjectionBindingState(): ProjectionBindingState {
	return {
		documentIdentityById: new Map<string, string>(),
		activeSpeechId: null,
		deliveredSpeechId: null,
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

function releaseDocumentReservation(
	state: ProjectionBindingState,
	documentId: string,
	documentIdentity: string,
): void {
	if (state.documentIdentityById.get(documentId) === documentIdentity) {
		state.documentIdentityById.delete(documentId);
	}
}

function releaseSpeechReservation(
	state: ProjectionBindingState,
	speechId: string,
): void {
	if (state.activeSpeechId === speechId) {
		state.activeSpeechId = null;
	}
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
	let document: ProjectionDocument | null;
	try {
		document = projection.select(inspection);
	} catch (error) {
		return {
			channel: "document",
			status: "error",
			reason: errorReason(error),
		};
	}

	if (!document) {
		return {
			channel: "document",
			status: "skipped",
			reason: "missing-document",
		};
	}

	let documentIdentity: string;
	try {
		documentIdentity = projection.identity(document);
	} catch (error) {
		return {
			channel: "document",
			status: "error",
			documentId: document.id,
			revision: document.revision,
			reason: errorReason(error),
		};
	}

	const previousIdentity = state.documentIdentityById.get(document.id);
	if (previousIdentity === documentIdentity) {
		return {
			channel: "document",
			status: "skipped",
			reason: "duplicate-document",
		};
	}

	state.documentIdentityById.set(document.id, documentIdentity);

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

	try {
		const result = normalizeCommitResult(
			(await commitDocument(document)) ?? undefined,
		);
		if (result.status === "unsupported") {
			releaseDocumentReservation(state, document.id, documentIdentity);
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
		releaseDocumentReservation(state, document.id, documentIdentity);
		return {
			channel: "document",
			status: "error",
			documentId: document.id,
			revision: document.revision,
			reason: errorReason(error),
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
	let speech: ProjectionSpeechRequest | null;
	try {
		speech = projection.select(inspection);
	} catch (error) {
		return {
			channel: "speech",
			status: "error",
			reason: errorReason(error),
		};
	}
	const wasAcknowledged = speech !== null && speech.status === "acknowledged";
	if (!isPendingSpeechRequest(speech)) {
		return {
			channel: "speech",
			status: "skipped",
			reason: wasAcknowledged ? "acknowledged-speech" : "missing-speech",
		};
	}
	let speechId: string;
	try {
		speechId = projection.identity(speech);
	} catch (error) {
		return {
			channel: "speech",
			status: "error",
			speechId: speech.id,
			reason: errorReason(error),
		};
	}

	if (
		state.activeSpeechId === speechId ||
		state.lastAcknowledgedSpeechId === speechId
	) {
		return {
			channel: "speech",
			status: "skipped",
			reason: "duplicate-speech",
		};
	}

	const deliveryPending = state.deliveredSpeechId !== speechId;
	state.activeSpeechId = speechId;

	try {
		if (deliveryPending) {
			const result = normalizeCommitResult(
				(await commitSpeech(speech)) ?? undefined,
			);
			if (result.status === "unsupported") {
				releaseSpeechReservation(state, speechId);
				return {
					channel: "speech",
					status: "unsupported",
					speechId: speech.id,
					reason: result.reason,
				};
			}

			state.deliveredSpeechId = speechId;
		}

		await acknowledge(speech);
		releaseSpeechReservation(state, speechId);
		if (state.deliveredSpeechId === speechId) {
			state.deliveredSpeechId = null;
		}
		state.lastAcknowledgedSpeechId = speechId;
		return {
			channel: "speech",
			status: "committed",
			speechId: speech.id,
		};
	} catch (error) {
		releaseSpeechReservation(state, speechId);
		return {
			channel: "speech",
			status: "error",
			speechId: speech.id,
			reason: errorReason(error),
		};
	}
}

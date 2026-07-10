import type {
	IgniteProjectionTarget,
	ProjectionDocument,
	ProjectionSpeechRequest,
} from "../types/agent";
import { igniteProjectionTargetBrand } from "../types/projectionTargetBrand";

type ProjectionTargetCommitResult =
	| { status: "committed" }
	| { status: "unsupported"; reason: string };

type ProjectionTargetCommitValue = ProjectionTargetCommitResult | undefined;

type InternalProjectionDocumentTarget = IgniteProjectionTarget & {
	readonly [igniteProjectionTargetBrand]: true;
	readonly kind: "document";
	readonly documentId?: string;
	readonly commitDocument: (
		document: ProjectionDocument,
	) =>
		| ProjectionTargetCommitValue
		| void
		| Promise<ProjectionTargetCommitValue>
		| Promise<void>;
};

type InternalProjectionSpeechTarget = IgniteProjectionTarget & {
	readonly [igniteProjectionTargetBrand]: true;
	readonly kind: "speech";
	readonly acknowledgeCommandName: string;
	readonly commitSpeech: (
		speech: ProjectionSpeechRequest,
	) =>
		| ProjectionTargetCommitValue
		| void
		| Promise<ProjectionTargetCommitValue>
		| Promise<void>;
	readonly resolveAcknowledgePayload?: (
		speech: ProjectionSpeechRequest,
	) => unknown;
};

export type InternalProjectionTarget =
	| InternalProjectionDocumentTarget
	| InternalProjectionSpeechTarget;

type ProjectionDocumentTargetOptions = {
	readonly documentId?: string;
	readonly commitDocument: (
		document: ProjectionDocument,
	) =>
		| ProjectionTargetCommitValue
		| void
		| Promise<ProjectionTargetCommitValue>
		| Promise<void>;
};

type ProjectionSpeechTargetOptions = {
	readonly acknowledgeCommandName: string;
	readonly commitSpeech: (
		speech: ProjectionSpeechRequest,
	) =>
		| ProjectionTargetCommitValue
		| void
		| Promise<ProjectionTargetCommitValue>
		| Promise<void>;
	readonly resolveAcknowledgePayload?: (
		speech: ProjectionSpeechRequest,
	) => unknown;
};

export function createProjectionDocumentTarget(
	options: ProjectionDocumentTargetOptions,
): IgniteProjectionTarget {
	const target: InternalProjectionDocumentTarget = {
		[igniteProjectionTargetBrand]: true,
		kind: "document",
		documentId: options.documentId,
		commitDocument: options.commitDocument,
	};
	return target;
}

export function createProjectionSpeechTarget(
	options: ProjectionSpeechTargetOptions,
): IgniteProjectionTarget {
	const target: InternalProjectionSpeechTarget = {
		[igniteProjectionTargetBrand]: true,
		kind: "speech",
		acknowledgeCommandName: options.acknowledgeCommandName,
		commitSpeech: options.commitSpeech,
		resolveAcknowledgePayload: options.resolveAcknowledgePayload,
	};
	return target;
}

function isProjectionDocumentTarget(
	value: object,
): value is InternalProjectionDocumentTarget {
	return (
		Reflect.get(value, igniteProjectionTargetBrand) === true &&
		Reflect.get(value, "kind") === "document" &&
		(typeof Reflect.get(value, "documentId") === "undefined" ||
			typeof Reflect.get(value, "documentId") === "string") &&
		typeof Reflect.get(value, "commitDocument") === "function"
	);
}

function isProjectionSpeechTarget(
	value: object,
): value is InternalProjectionSpeechTarget {
	return (
		Reflect.get(value, igniteProjectionTargetBrand) === true &&
		Reflect.get(value, "kind") === "speech" &&
		typeof Reflect.get(value, "acknowledgeCommandName") === "string" &&
		typeof Reflect.get(value, "commitSpeech") === "function" &&
		(typeof Reflect.get(value, "resolveAcknowledgePayload") === "undefined" ||
			typeof Reflect.get(value, "resolveAcknowledgePayload") === "function")
	);
}

export function isProjectionTarget(
	value: unknown,
): value is InternalProjectionTarget {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	return isProjectionDocumentTarget(value) || isProjectionSpeechTarget(value);
}

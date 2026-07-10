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

type ProjectionDocumentTargetShell = IgniteProjectionTarget & {
	readonly kind: "document";
	readonly documentId?: string;
};

type ProjectionSpeechTargetShell = IgniteProjectionTarget & {
	readonly kind: "speech";
};

type InternalProjectionDocumentTarget = {
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

type InternalProjectionSpeechTarget = {
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

type InternalProjectionTarget =
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

const projectionTargetConfigurations = new WeakMap<
	object,
	InternalProjectionTarget
>();

export function createProjectionDocumentTarget(
	options: ProjectionDocumentTargetOptions,
): IgniteProjectionTarget {
	const target: ProjectionDocumentTargetShell = {
		[igniteProjectionTargetBrand]: true,
		kind: "document",
		documentId: options.documentId,
	};
	Object.defineProperties(target, {
		[igniteProjectionTargetBrand]: {
			value: true,
			enumerable: false,
			writable: false,
			configurable: false,
		},
		kind: {
			value: "document",
			enumerable: false,
			writable: false,
			configurable: false,
		},
		documentId: {
			value: options.documentId,
			enumerable: false,
			writable: false,
			configurable: false,
		},
	});
	projectionTargetConfigurations.set(
		target,
		Object.freeze({
			kind: "document",
			documentId: options.documentId,
			commitDocument: options.commitDocument,
		}),
	);
	return Object.freeze(target);
}

export function createProjectionSpeechTarget(
	options: ProjectionSpeechTargetOptions,
): IgniteProjectionTarget {
	const target: ProjectionSpeechTargetShell = {
		[igniteProjectionTargetBrand]: true,
		kind: "speech",
	};
	Object.defineProperties(target, {
		[igniteProjectionTargetBrand]: {
			value: true,
			enumerable: false,
			writable: false,
			configurable: false,
		},
		kind: {
			value: "speech",
			enumerable: false,
			writable: false,
			configurable: false,
		},
	});
	projectionTargetConfigurations.set(
		target,
		Object.freeze({
			kind: "speech",
			acknowledgeCommandName: options.acknowledgeCommandName,
			commitSpeech: options.commitSpeech,
			resolveAcknowledgePayload: options.resolveAcknowledgePayload,
		}),
	);
	return Object.freeze(target);
}

export function resolveProjectionTarget(
	value: unknown,
): InternalProjectionTarget | undefined {
	if (typeof value !== "object" || value === null) {
		return undefined;
	}

	return projectionTargetConfigurations.get(value);
}

export function isProjectionTarget(value: unknown): boolean {
	return resolveProjectionTarget(value) !== undefined;
}

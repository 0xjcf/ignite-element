import type {
	IgniteProjectionInspection,
	IgniteProjectionTarget,
	ProjectionDocument,
	ProjectionSpeechRequest,
} from "../types/agent";
import { igniteProjectionTargetBrand } from "../types/projectionTargetBrand";

type BivariantHandler<Args extends unknown[], Result> = {
	bivarianceHack(...args: Args): Result;
}["bivarianceHack"];

export type ProjectionDocumentTargetOptions<
	Snapshot = unknown,
	SchemaState = unknown,
	View extends Record<string, unknown> = Record<never, never>,
> = {
	selectDocument: BivariantHandler<
		[IgniteProjectionInspection<Snapshot, SchemaState, View>],
		ProjectionDocument | null | undefined
	>;
	commitDocument: BivariantHandler<
		[
			ProjectionDocument,
			IgniteProjectionInspection<Snapshot, SchemaState, View>,
		],
		void | Promise<void>
	>;
};

export type ProjectionSpeechTargetOptions<
	Snapshot = unknown,
	SchemaState = unknown,
	View extends Record<string, unknown> = Record<never, never>,
> = {
	selectSpeech: BivariantHandler<
		[IgniteProjectionInspection<Snapshot, SchemaState, View>],
		ProjectionSpeechRequest | null | undefined
	>;
	commitSpeech: BivariantHandler<
		[
			ProjectionSpeechRequest,
			IgniteProjectionInspection<Snapshot, SchemaState, View>,
		],
		void | Promise<void>
	>;
	acknowledgeCommandName: string;
	resolveAcknowledgePayload?: BivariantHandler<
		[
			ProjectionSpeechRequest,
			IgniteProjectionInspection<Snapshot, SchemaState, View>,
		],
		unknown
	>;
};

type InternalProjectionTarget =
	| (IgniteProjectionTarget & {
			readonly [igniteProjectionTargetBrand]: "ignite.projection.target";
			readonly kind: "document";
			readonly selectDocument: ProjectionDocumentTargetOptions["selectDocument"];
			readonly commitDocument: ProjectionDocumentTargetOptions["commitDocument"];
	  })
	| (IgniteProjectionTarget & {
			readonly [igniteProjectionTargetBrand]: "ignite.projection.target";
			readonly kind: "speech";
			readonly selectSpeech: ProjectionSpeechTargetOptions["selectSpeech"];
			readonly commitSpeech: ProjectionSpeechTargetOptions["commitSpeech"];
			readonly acknowledgeCommandName: string;
			readonly resolveAcknowledgePayload?: ProjectionSpeechTargetOptions["resolveAcknowledgePayload"];
	  });

export function createProjectionDocumentTarget<
	Snapshot = unknown,
	SchemaState = unknown,
	View extends Record<string, unknown> = Record<never, never>,
>(
	options: ProjectionDocumentTargetOptions<Snapshot, SchemaState, View>,
): IgniteProjectionTarget {
	const target: InternalProjectionTarget = {
		[igniteProjectionTargetBrand]: "ignite.projection.target",
		kind: "document",
		...options,
	};
	return target;
}

export function createProjectionSpeechTarget<
	Snapshot = unknown,
	SchemaState = unknown,
	View extends Record<string, unknown> = Record<never, never>,
>(
	options: ProjectionSpeechTargetOptions<Snapshot, SchemaState, View>,
): IgniteProjectionTarget {
	const target: InternalProjectionTarget = {
		[igniteProjectionTargetBrand]: "ignite.projection.target",
		kind: "speech",
		...options,
	};
	return target;
}

export function isProjectionTarget(
	value: unknown,
): value is InternalProjectionTarget {
	return (
		typeof value === "object" &&
		value !== null &&
		igniteProjectionTargetBrand in value
	);
}

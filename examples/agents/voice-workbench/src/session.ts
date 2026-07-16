import type { NeutralTool } from "ignite-element/tools";
import {
	type IgniteAgentCommandSchema,
	igniteCore,
} from "ignite-element/xstate";
import { assign, createActor, type SnapshotFrom, setup } from "xstate";
import type { ModelFailureFact } from "./agent-loop";
import type { CapabilityFallbackAttempt } from "./capability-federation";
import {
	type AcknowledgeSpeechInput,
	type CompleteResponseInput,
	type ConversationAction,
	type ConversationFact,
	type ConversationSession,
	type CreateArtifactInput,
	createInitialSession,
	type RestoreArtifactRevisionInput,
	type ReviseArtifactInput,
	reduceConversationSession,
	type SelectArtifactInput,
	type SetChecklistItemInput,
	type SubmitPromptInput,
} from "./domain";
import type { DomainPolicyDecision } from "./domains/contracts";
import type { ProductPriceReasonCode } from "./domains/product-pricing/price-capability";
import type { ModelTurnLifecycleProjection } from "./model-turn";
import type {
	SpeechDeliveryFact,
	SpeechDeliveryLifecycleProjection,
} from "./speech";
import type {
	VoiceCaptureFact,
	VoiceCaptureLifecycleProjection,
} from "./voice";

export type WorkbenchArtifactView = "document" | "schema";
export type WorkbenchPanel = "conversation" | "artifact" | "runtime";
export type WorkbenchRuntimePreview =
	| "browser"
	| "terminal"
	| "speech"
	| "headless";
export type WorkbenchRuntimeManifestEntry = NeutralTool & { ownerId: string };
type WorkbenchPricingProofRowBase = {
	subject: string;
	product?: string;
	size?: string;
	cacheStatus: "miss" | "hit" | "coalesced";
	nativeStatus:
		| "hit"
		| "miss"
		| "schema-drift"
		| "transport-error"
		| "coalesced"
		| "not-needed";
	braveStatus:
		| "not-needed"
		| "not-configured"
		| "not-eligible"
		| "attempted-success"
		| "attempted-miss"
		| "attempted-failure"
		| "coalesced";
};
export type WorkbenchPricingProofRow = WorkbenchPricingProofRowBase &
	(
		| {
				priceStatus: "sourced";
				reasonCode?: never;
				reason?: never;
		  }
		| {
				priceStatus: "unverified";
				reasonCode: ProductPriceReasonCode;
				reason: string;
		  }
	);
export type WorkbenchCapabilityOutcome = {
	type: WorkbenchCapabilityProof["outcome"];
	ownerId: string;
	toolName: string;
	message: string;
	status?: number;
	retry?: WorkbenchCapabilityProof["retry"];
	cacheStatus?: WorkbenchCapabilityProof["cacheStatus"];
	cacheTtlMs?: number;
	fallback?: CapabilityFallbackAttempt;
	pricingRows?: readonly WorkbenchPricingProofRow[];
};
export type WorkbenchTurnTrace = readonly {
	command: string;
	accepted: boolean;
}[];
export type WorkbenchCapabilityProof = {
	provider: string;
	tool: string;
	outcome:
		| "success"
		| "unavailable"
		| "validation"
		| "timeout"
		| "provider-failure";
	queryCount?: number;
	sourceCount?: number;
	status?: number;
	retry?: {
		attempts: number;
		maxAttempts: number;
		retryAfterMs?: number;
		exhausted: boolean;
	};
	cacheStatus?: "miss" | "hit" | "coalesced";
	cacheTtlMs?: number;
	fallback?: CapabilityFallbackAttempt;
	pricingRows?: readonly WorkbenchPricingProofRow[];
};
export type WorkbenchCollisionProof = {
	outcome: "collision";
	toolNames: readonly string[];
	owners: readonly string[];
};
type WorkbenchTurnOutcome =
	| { type: "accepted"; trace: WorkbenchTurnTrace }
	| {
			type: "prompt-rejected" | "response-incomplete";
			trace: WorkbenchTurnTrace;
	  }
	| {
			type: "model-failed";
			failureKind:
				| "configuration"
				| "network"
				| "timeout"
				| "provider"
				| "invalid-response";
			message: string;
			trace: WorkbenchTurnTrace;
	  }
	| {
			type: "command-not-allowed" | "command-rejected";
			command: string;
			trace: WorkbenchTurnTrace;
	  };
export type WorkbenchTurnFact = WorkbenchTurnOutcome & {
	capability?: WorkbenchCapabilityProof;
	collision?: WorkbenchCollisionProof;
};

export type WorkbenchPresentation = {
	artifactView: WorkbenchArtifactView;
	documentCommit: {
		id: string;
		title?: string;
		revision: string;
	} | null;
	draft: string;
	mobilePanel: WorkbenchPanel;
	replaySequence: number;
	runtimeManifest: readonly WorkbenchRuntimeManifestEntry[];
	runtimePreview: WorkbenchRuntimePreview;
	capabilityOutcomes: readonly WorkbenchCapabilityOutcome[];
	domainPolicy: DomainPolicyDecision | null;
	speakResponses: boolean;
	speechCommit: {
		id: string;
		text: string;
		status: "played" | "muted" | "unavailable";
	} | null;
	speechDelivery: SpeechDeliveryFact | null;
	speechReplayRequest: { id: string; text: string; sequence: number } | null;
	turn: WorkbenchTurnFact | null;
	voice: VoiceCaptureFact;
	voiceCaptureRequest: {
		action: "start" | "cancel";
		sequence: number;
	} | null;
};

export type WorkbenchPresentationIntent =
	| { type: "draft-changed"; draft: string }
	| {
			type: "artifact-view-changed";
			view: WorkbenchArtifactView;
	  }
	| { type: "mobile-panel-changed"; panel: WorkbenchPanel }
	| { type: "speech-preference-changed"; enabled: boolean }
	| {
			type: "speech-replay-requested";
			request: NonNullable<WorkbenchPresentation["speechReplayRequest"]>;
	  }
	| { type: "replayed" }
	| {
			type: "runtime-preview-selected";
			preview: WorkbenchRuntimePreview;
	  }
	| {
			type: "voice-capture-requested";
			action: "start" | "cancel";
			sequence: number;
	  }
	| { type: "turn-started" };

export type WorkbenchAdapterFact =
	| { type: "voice-recorded"; fact: VoiceCaptureFact }
	| {
			type: "document-committed";
			document: NonNullable<WorkbenchPresentation["documentCommit"]>;
	  }
	| {
			type: "speech-committed";
			speech: NonNullable<WorkbenchPresentation["speechCommit"]>;
	  }
	| {
			type: "speech-delivery-recorded";
			fact: SpeechDeliveryFact;
			text: string;
	  };

export type WorkbenchReadModelFact =
	| { type: "turn-recorded"; fact: WorkbenchTurnFact }
	| {
			type: "runtime-manifest-recorded";
			manifest: readonly WorkbenchRuntimeManifestEntry[];
	  }
	| {
			type: "capability-outcome-recorded";
			outcome: WorkbenchCapabilityOutcome;
	  }
	| {
			type: "domain-policy-recorded";
			decision: DomainPolicyDecision;
	  };

export type WorkbenchPresentationEnvelope =
	| { channel: "user-intent"; update: WorkbenchPresentationIntent }
	| { channel: "private-adapter"; update: WorkbenchAdapterFact }
	| { channel: "read-model"; update: WorkbenchReadModelFact };

export type PresentationUpdateEvent = {
	type: "PRESENTATION_UPDATED";
	envelope: WorkbenchPresentationEnvelope;
};

export type VoiceWorkbenchSession = ConversationSession & {
	modelFailure: ModelFailureFact | null;
	presentation: WorkbenchPresentation;
	activeTurnId: string | null;
	pendingCompletion: CompleteResponseInput | null;
	lastTurnTerminal: VoiceWorkbenchTurnTerminalEvent | null;
	childLifecycles: {
		modelTurn: ModelTurnLifecycleProjection | null;
		voiceCapture: VoiceCaptureLifecycleProjection | null;
		speechDelivery: SpeechDeliveryLifecycleProjection | null;
	};
};
export type ModelReadinessEvent =
	| { type: "MODEL_PREPARATION_STARTED" }
	| { type: "MODEL_AVAILABLE" }
	| { type: "MODEL_FAILED"; failure: ModelFailureFact };
export type VoiceWorkbenchTurnTerminalEvent =
	| { type: "TURN_COMPLETED"; turnId: string }
	| { type: "TURN_FAILED"; turnId: string; failure: ModelFailureFact }
	| { type: "CANCELLED"; turnId: string }
	| { type: "TIMEOUT"; turnId: string }
	| { type: "ROUND_LIMIT_REACHED"; turnId: string };
export type VoiceWorkbenchPrivateEvent =
	| {
			type: "DOCUMENT_COMMITTED";
			document: NonNullable<WorkbenchPresentation["documentCommit"]>;
	  }
	| {
			type: "SPEECH_COMMITTED";
			speech: NonNullable<WorkbenchPresentation["speechCommit"]>;
	  }
	| { type: "VOICE_RECORDED"; fact: VoiceCaptureFact }
	| {
			type: "CAPABILITY_OUTCOME_RECORDED";
			outcome: WorkbenchCapabilityOutcome;
	  }
	| { type: "DOMAIN_POLICY_RECORDED"; decision: DomainPolicyDecision }
	| {
			type: "RUNTIME_MANIFEST_RECORDED";
			manifest: readonly WorkbenchRuntimeManifestEntry[];
	  }
	| { type: "TURN_RECORDED"; fact: WorkbenchTurnFact }
	| {
			type: "MODEL_TURN_LIFECYCLE_UPDATED";
			lifecycle: ModelTurnLifecycleProjection;
	  }
	| {
			type: "VOICE_CAPTURE_LIFECYCLE_UPDATED";
			lifecycle: VoiceCaptureLifecycleProjection;
	  }
	| {
			type: "SPEECH_DELIVERY_LIFECYCLE_UPDATED";
			lifecycle: SpeechDeliveryLifecycleProjection;
	  };
export type VoiceWorkbenchSessionEvent =
	| ConversationAction
	| ModelReadinessEvent
	| VoiceWorkbenchTurnTerminalEvent
	| PresentationUpdateEvent
	| VoiceWorkbenchPrivateEvent;

export type WorkbenchSpeechAcknowledgementFact = Extract<
	ConversationFact,
	{ type: "speech-acknowledged" }
>;

export type WorkbenchSpeechDeliveryFact = SpeechDeliveryFact;

export type WorkbenchSpeechLifecycleFact =
	| WorkbenchSpeechAcknowledgementFact
	| WorkbenchSpeechDeliveryFact;

export type VoiceWorkbenchLifecycleOwnership = {
	surface:
		| "session-provider-turn"
		| "model-turn"
		| "voice-capture"
		| "speech-delivery"
		| "conversation-artifact-aggregate"
		| "domain-policy"
		| "capability-results"
		| "presentation";
	owner: string;
	disposition: "statechart" | "reducer" | "typed-fact" | "presentation";
	implementation: "executable" | "planned";
	maturity: "target" | "transitional";
};

export const voiceWorkbenchLifecycleOwnership = [
	{
		surface: "session-provider-turn",
		owner: "voiceWorkbenchSessionMachine",
		disposition: "statechart",
		implementation: "executable",
		maturity: "target",
	},
	{
		surface: "model-turn",
		owner: "model-turn child actor",
		disposition: "statechart",
		implementation: "executable",
		maturity: "target",
	},
	{
		surface: "voice-capture",
		owner: "voice-capture child actor",
		disposition: "statechart",
		implementation: "executable",
		maturity: "target",
	},
	{
		surface: "speech-delivery",
		owner: "speech-delivery child actor",
		disposition: "statechart",
		implementation: "executable",
		maturity: "target",
	},
	{
		surface: "conversation-artifact-aggregate",
		owner: "reduceConversationSession",
		disposition: "reducer",
		implementation: "executable",
		maturity: "target",
	},
	{
		surface: "domain-policy",
		owner: "domain pack policies",
		disposition: "typed-fact",
		implementation: "executable",
		maturity: "target",
	},
	{
		surface: "capability-results",
		owner: "capability ports",
		disposition: "typed-fact",
		implementation: "executable",
		maturity: "target",
	},
	{
		surface: "presentation",
		owner: "reduceWorkbenchPresentation",
		disposition: "reducer",
		implementation: "executable",
		maturity: "target",
	},
] as const satisfies readonly VoiceWorkbenchLifecycleOwnership[];

export type VoiceWorkbenchSessionStateValue =
	| "preparing"
	| "unavailable"
	| { available: "idle" | "responding" };

export const voiceWorkbenchKnownForbiddenStateValues =
	[] as const satisfies readonly VoiceWorkbenchSessionStateValue[];

export const isVoiceWorkbenchKnownForbiddenStateValue = (
	_value: unknown,
): boolean => false;

const createInitialPresentation = (): WorkbenchPresentation => ({
	artifactView: "document",
	documentCommit: null,
	draft: "",
	mobilePanel: "conversation",
	replaySequence: 0,
	runtimeManifest: [],
	runtimePreview: "browser",
	capabilityOutcomes: [],
	domainPolicy: null,
	speakResponses: true,
	speechCommit: null,
	speechDelivery: null,
	speechReplayRequest: null,
	turn: null,
	voice: { type: "voice-idle" },
	voiceCaptureRequest: null,
});

export const reduceWorkbenchPresentation = (
	presentation: WorkbenchPresentation,
	envelope: WorkbenchPresentationEnvelope,
): WorkbenchPresentation => {
	const update = envelope.update;
	switch (update.type) {
		case "draft-changed":
			return { ...presentation, draft: update.draft };
		case "artifact-view-changed":
			return { ...presentation, artifactView: update.view };
		case "mobile-panel-changed":
			return { ...presentation, mobilePanel: update.panel };
		case "speech-preference-changed":
			return { ...presentation, speakResponses: update.enabled };
		case "speech-replay-requested":
			return { ...presentation, speechReplayRequest: update.request };
		case "replayed":
			return {
				...presentation,
				replaySequence: presentation.replaySequence + 1,
			};
		case "runtime-preview-selected":
			return { ...presentation, runtimePreview: update.preview };
		case "voice-capture-requested":
			return {
				...presentation,
				voiceCaptureRequest: {
					action: update.action,
					sequence: update.sequence,
				},
			};
		case "turn-started":
			return {
				...presentation,
				capabilityOutcomes: [],
				domainPolicy: null,
				runtimeManifest: [],
				speechDelivery: null,
				turn: null,
			};
		case "voice-recorded":
			return { ...presentation, voice: update.fact };
		case "document-committed":
			return { ...presentation, documentCommit: update.document };
		case "speech-committed":
			return { ...presentation, speechCommit: update.speech };
		case "speech-delivery-recorded": {
			const status =
				update.fact.type === "speech-delivery-completed"
					? "played"
					: update.fact.type === "speech-delivery-muted"
						? "muted"
						: update.fact.type === "speech-delivery-unavailable" ||
								update.fact.type === "speech-delivery-failed"
							? "unavailable"
							: null;
			return {
				...presentation,
				speechDelivery: update.fact,
				...(status
					? {
							speechCommit: {
								id: update.fact.id,
								text: update.text,
								status,
							},
						}
					: {}),
			};
		}
		case "turn-recorded":
			return { ...presentation, turn: update.fact };
		case "runtime-manifest-recorded":
			return { ...presentation, runtimeManifest: update.manifest };
		case "capability-outcome-recorded":
			return {
				...presentation,
				capabilityOutcomes: [
					...presentation.capabilityOutcomes,
					update.outcome,
				].slice(-12),
			};
		case "domain-policy-recorded":
			return { ...presentation, domainPolicy: update.decision };
	}
};

const describeTurn = (turn: WorkbenchTurnFact | null): string => {
	if (!turn) return "";
	switch (turn.type) {
		case "accepted":
			return "Actor accepted the model-authored turn.";
		case "model-failed":
			return turn.message;
		case "prompt-rejected":
			return "The actor did not admit this prompt.";
		case "response-incomplete":
			return "The model omitted a completed response, so the actor recovered the turn.";
		case "command-not-allowed":
			return `${turn.command} was not allowed by the model command policy.`;
		case "command-rejected":
			return `${turn.command} was rejected by the actor.`;
	}
};

const describeFact = (fact: ConversationFact | null): string => {
	if (!fact) return "no actor facts yet";
	switch (fact.type) {
		case "prompt-submitted":
			return `${fact.type} · ${fact.modality}`;
		case "artifact-created":
		case "artifact-revised":
			return `${fact.type} · revision ${fact.revision}`;
		case "artifact-restored":
			return `${fact.type} · ${fact.fromRevision} → ${fact.revision}`;
		case "artifact-selected":
			return `${fact.type} · ${fact.artifactId}`;
		case "artifact-rejected":
			return `${fact.type} · ${fact.reason}`;
		case "speech-acknowledged":
			return `${fact.type} · ${fact.id}`;
		case "response-completed":
			return fact.type;
	}
};

const fallbackAttemptSummary = (fallback: CapabilityFallbackAttempt): string =>
	`fallback ${fallback.from} → ${fallback.provider} · trigger HTTP ${fallback.status} · ${fallback.outcome}`;

const capabilityProofSummary = (proof: WorkbenchCapabilityProof): string =>
	[
		proof.outcome,
		proof.status === undefined ? null : `HTTP ${proof.status}`,
		proof.queryCount === undefined
			? null
			: `${proof.queryCount} ${proof.queryCount === 1 ? "query" : "queries"}`,
		proof.sourceCount === undefined
			? null
			: `${proof.sourceCount} ${proof.sourceCount === 1 ? "source" : "sources"}`,
		proof.retry === undefined
			? null
			: `${proof.retry.attempts}/${proof.retry.maxAttempts} attempts${proof.retry.retryAfterMs === undefined ? "" : ` · waited ${proof.retry.retryAfterMs}ms`}`,
		proof.cacheStatus === undefined
			? null
			: `cache ${proof.cacheStatus}${proof.cacheTtlMs === undefined ? "" : ` · TTL ${proof.cacheTtlMs}ms`}`,
		proof.fallback === undefined
			? null
			: fallbackAttemptSummary(proof.fallback),
	]
		.filter((value): value is string => value !== null)
		.join(" · ");

const describeRespondingProgress = (
	fact: ConversationFact | null,
): {
	actorOutcome: string;
	actorOutcomeRecorded: boolean;
	pendingResult: string;
} => {
	if (!fact || fact.type === "prompt-submitted") {
		return {
			actorOutcome: "No actor command accepted yet",
			actorOutcomeRecorded: false,
			pendingResult: "Awaiting the first model or capability result",
		};
	}

	switch (fact.type) {
		case "artifact-created":
		case "artifact-revised":
			return {
				actorOutcome: `Actor accepted artifact revision ${fact.revision}`,
				actorOutcomeRecorded: true,
				pendingResult: "Awaiting the next model or capability result",
			};
		case "artifact-restored":
			return {
				actorOutcome: `Actor restored artifact as revision ${fact.revision}`,
				actorOutcomeRecorded: true,
				pendingResult: "Awaiting the next model or capability result",
			};
		case "artifact-rejected":
			return {
				actorOutcome: `Actor rejected the previous command: ${fact.reason}`,
				actorOutcomeRecorded: true,
				pendingResult: "Awaiting a repaired model command",
			};
		case "artifact-selected":
			return {
				actorOutcome: `Actor selected artifact ${fact.artifactId}`,
				actorOutcomeRecorded: true,
				pendingResult: "Awaiting the next model or capability result",
			};
		case "speech-acknowledged":
			return {
				actorOutcome: "Actor acknowledged projected speech",
				actorOutcomeRecorded: true,
				pendingResult: "Awaiting the next model or capability result",
			};
		case "response-completed":
			return {
				actorOutcome: "Actor completed the response",
				actorOutcomeRecorded: true,
				pendingResult: "Completing the authorized turn",
			};
	}
};

const voiceState = (
	fact: VoiceCaptureFact,
): "idle" | "listening" | "transcript" | "permission" | "unsupported" => {
	switch (fact.type) {
		case "voice-listening":
			return "listening";
		case "voice-transcript":
			return "transcript";
		case "voice-permission-denied":
		case "voice-error":
			return "permission";
		case "voice-unsupported":
			return "unsupported";
		case "voice-idle":
		case "voice-cancelled":
			return "idle";
	}
};

const runtimePreviewDefinitions = [
	{ id: "browser", label: "Browser preview" },
	{ id: "terminal", label: "Terminal preview" },
	{ id: "speech", label: "Speech preview" },
	{ id: "headless", label: "Headless preview" },
] as const;

const isSchemaRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const schemaType = (schema: Record<string, unknown>): string => {
	if (typeof schema.type === "string") return schema.type;
	if (Array.isArray(schema.enum)) return "enum";
	return "value";
};

const formatSchema = (schema: unknown, rootName = "input"): string => {
	const lines: string[] = [];
	const visit = (
		value: unknown,
		name: string,
		required: boolean,
		depth: number,
	) => {
		if (!isSchemaRecord(value)) return;
		const indent = "  ".repeat(depth);
		lines.push(
			`${indent}${name} · ${schemaType(value)}${required ? " · required" : ""}`,
		);
		for (const constraint of [
			"minLength",
			"maxLength",
			"minimum",
			"maximum",
			"minItems",
			"maxItems",
		] as const) {
			if (typeof value[constraint] === "number") {
				lines.push(`${indent}  ${constraint}: ${value[constraint]}`);
			}
		}
		if (Array.isArray(value.enum)) {
			lines.push(`${indent}  allowed: ${value.enum.join(" | ")}`);
		}
		const requiredNames = new Set(
			Array.isArray(value.required)
				? value.required.filter(
						(entry): entry is string => typeof entry === "string",
					)
				: [],
		);
		if (isSchemaRecord(value.properties)) {
			for (const [propertyName, propertySchema] of Object.entries(
				value.properties,
			)) {
				visit(
					propertySchema,
					propertyName,
					requiredNames.has(propertyName),
					depth + 1,
				);
			}
		}
		if (value.items !== undefined) visit(value.items, "items", true, depth + 1);
	};
	visit(schema, rootName, false, 0);
	return lines.join("\n");
};

let componentBlueprintCommands: IgniteAgentCommandSchema = {};

const isConversationAction = (
	event: VoiceWorkbenchSessionEvent,
): event is ConversationAction => {
	switch (event.type) {
		case "SUBMIT_PROMPT":
		case "CREATE_ARTIFACT":
		case "REVISE_ARTIFACT":
		case "RESTORE_ARTIFACT_REVISION":
		case "SELECT_ARTIFACT":
		case "SET_CHECKLIST_ITEM":
		case "COMPLETE_RESPONSE":
		case "ACKNOWLEDGE_SPEECH":
			return true;
		default:
			return false;
	}
};

const isTurnTerminalEvent = (
	event: VoiceWorkbenchSessionEvent,
): event is VoiceWorkbenchTurnTerminalEvent => {
	switch (event.type) {
		case "TURN_COMPLETED":
		case "TURN_FAILED":
		case "CANCELLED":
		case "TIMEOUT":
		case "ROUND_LIMIT_REACHED":
			return true;
		default:
			return false;
	}
};

const acceptsModelTurnLifecycle = (
	context: VoiceWorkbenchSession,
	lifecycle: ModelTurnLifecycleProjection,
): boolean => {
	if (!context.activeTurnId || lifecycle.turnId !== context.activeTurnId) {
		return false;
	}
	const current = context.childLifecycles.modelTurn;
	if (!current || current.turnId !== lifecycle.turnId) return true;
	if (lifecycle.round < current.round) return false;
	return (
		lifecycle.round > current.round || lifecycle.attemptId === current.attemptId
	);
};

const acceptsSpeechDeliveryLifecycle = (
	current: SpeechDeliveryLifecycleProjection | null,
	lifecycle: SpeechDeliveryLifecycleProjection,
): boolean =>
	current === null ||
	current.attemptId === lifecycle.attemptId ||
	lifecycle.state === "pending";

const acceptsVoiceCaptureLifecycle = (
	current: VoiceCaptureLifecycleProjection | null,
	lifecycle: VoiceCaptureLifecycleProjection,
): boolean => {
	if (!current) return true;
	if (lifecycle.sequence < current.sequence) return false;
	if (lifecycle.sequence > current.sequence) return true;
	if (lifecycle.attemptId === null) return true;
	return (
		current.attemptId !== null && lifecycle.attemptId === current.attemptId
	);
};

const privatePresentationEnvelope = (
	event: VoiceWorkbenchPrivateEvent,
): WorkbenchPresentationEnvelope | null => {
	switch (event.type) {
		case "DOCUMENT_COMMITTED":
			return {
				channel: "private-adapter",
				update: { type: "document-committed", document: event.document },
			};
		case "SPEECH_COMMITTED":
			return {
				channel: "private-adapter",
				update: { type: "speech-committed", speech: event.speech },
			};
		case "VOICE_RECORDED":
			return {
				channel: "private-adapter",
				update: { type: "voice-recorded", fact: event.fact },
			};
		case "CAPABILITY_OUTCOME_RECORDED":
			return {
				channel: "read-model",
				update: { type: "capability-outcome-recorded", outcome: event.outcome },
			};
		case "DOMAIN_POLICY_RECORDED":
			return {
				channel: "read-model",
				update: { type: "domain-policy-recorded", decision: event.decision },
			};
		case "RUNTIME_MANIFEST_RECORDED":
			return {
				channel: "read-model",
				update: { type: "runtime-manifest-recorded", manifest: event.manifest },
			};
		case "TURN_RECORDED":
			return {
				channel: "read-model",
				update: { type: "turn-recorded", fact: event.fact },
			};
		case "VOICE_CAPTURE_LIFECYCLE_UPDATED":
			return {
				channel: "private-adapter",
				update: { type: "voice-recorded", fact: event.lifecycle.fact },
			};
		case "SPEECH_DELIVERY_LIFECYCLE_UPDATED":
			return event.lifecycle.fact
				? {
						channel: "private-adapter",
						update: {
							type: "speech-delivery-recorded",
							fact: event.lifecycle.fact,
							text: event.lifecycle.text,
						},
					}
				: null;
		case "MODEL_TURN_LIFECYCLE_UPDATED":
			return null;
	}
};

export const voiceWorkbenchSessionMachine = setup({
	types: {
		context: {} as VoiceWorkbenchSession,
		events: {} as VoiceWorkbenchSessionEvent,
	},
	actions: {
		applyTransition: assign(({ context, event }) => {
			if (!isConversationAction(event)) return context;
			const result = reduceConversationSession(context, event);
			if (result.accepted) {
				const activeTurnId =
					event.type === "SUBMIT_PROMPT" &&
					result.session.lastFact?.type === "prompt-submitted"
						? result.session.lastFact.turnId
						: context.activeTurnId;
				return {
					...result.session,
					modelFailure: context.modelFailure,
					activeTurnId,
					pendingCompletion:
						event.type === "SUBMIT_PROMPT" ? null : context.pendingCompletion,
					lastTurnTerminal:
						event.type === "SUBMIT_PROMPT" ? null : context.lastTurnTerminal,
					childLifecycles: {
						...context.childLifecycles,
						...(event.type === "SUBMIT_PROMPT" ? { modelTurn: null } : {}),
					},
					presentation:
						event.type === "SUBMIT_PROMPT"
							? reduceWorkbenchPresentation(context.presentation, {
									channel: "user-intent",
									update: { type: "turn-started" },
								})
							: context.presentation,
				};
			}
			return {
				...context,
				factSequence: context.factSequence + 1,
				lastFact: {
					type: "artifact-rejected",
					reason: result.reason,
					...(result.issues ? { issues: result.issues } : {}),
				},
			};
		}),
		stageCompletion: assign(({ context, event }) => {
			if (event.type !== "COMPLETE_RESPONSE") return context;
			const result = reduceConversationSession(context, event);
			if (!result.accepted || !result.session.response) return context;
			return {
				...context,
				pendingCompletion: result.session.response,
			};
		}),
		rejectCompletion: assign(({ context, event }) => {
			if (event.type !== "COMPLETE_RESPONSE") return context;
			const result = reduceConversationSession(context, event);
			return {
				...context,
				factSequence: context.factSequence + 1,
				lastFact: {
					type: "artifact-rejected",
					reason: result.accepted ? "conflict" : result.reason,
					...(!result.accepted && result.issues
						? { issues: result.issues }
						: {}),
				},
			};
		}),
		commitCompletedTurn: assign(({ context, event }) => {
			if (event.type !== "TURN_COMPLETED" || !context.pendingCompletion) {
				return context;
			}
			const result = reduceConversationSession(context, {
				type: "COMPLETE_RESPONSE",
				input: context.pendingCompletion,
			});
			if (!result.accepted) {
				return { ...context, pendingCompletion: null };
			}
			return {
				...result.session,
				modelFailure: context.modelFailure,
				presentation: context.presentation,
				activeTurnId: context.activeTurnId,
				pendingCompletion: null,
				lastTurnTerminal: event,
				childLifecycles: context.childLifecycles,
			};
		}),
		discardPendingCompletion: assign({ pendingCompletion: () => null }),
		applyPresentationUpdate: assign(({ context, event }) => {
			if (event.type !== "PRESENTATION_UPDATED") return context;
			return {
				...context,
				presentation: reduceWorkbenchPresentation(
					context.presentation,
					event.envelope,
				),
			};
		}),
		applyPrivateEvent: assign(({ context, event }) => {
			if (
				isConversationAction(event) ||
				isTurnTerminalEvent(event) ||
				event.type === "MODEL_PREPARATION_STARTED" ||
				event.type === "MODEL_AVAILABLE" ||
				event.type === "MODEL_FAILED" ||
				event.type === "PRESENTATION_UPDATED"
			) {
				return context;
			}
			switch (event.type) {
				case "MODEL_TURN_LIFECYCLE_UPDATED": {
					if (!acceptsModelTurnLifecycle(context, event.lifecycle)) {
						return context;
					}
					return {
						...context,
						childLifecycles: {
							...context.childLifecycles,
							modelTurn: event.lifecycle,
						},
					};
				}
				case "VOICE_CAPTURE_LIFECYCLE_UPDATED": {
					if (
						!acceptsVoiceCaptureLifecycle(
							context.childLifecycles.voiceCapture,
							event.lifecycle,
						)
					) {
						return context;
					}
					const envelope = privatePresentationEnvelope(event);
					return {
						...context,
						presentation: envelope
							? reduceWorkbenchPresentation(context.presentation, envelope)
							: context.presentation,
						childLifecycles: {
							...context.childLifecycles,
							voiceCapture: event.lifecycle,
						},
					};
				}
				case "SPEECH_DELIVERY_LIFECYCLE_UPDATED": {
					if (
						!acceptsSpeechDeliveryLifecycle(
							context.childLifecycles.speechDelivery,
							event.lifecycle,
						)
					) {
						return context;
					}
					const envelope = privatePresentationEnvelope(event);
					return {
						...context,
						presentation: envelope
							? reduceWorkbenchPresentation(context.presentation, envelope)
							: context.presentation,
						childLifecycles: {
							...context.childLifecycles,
							speechDelivery: event.lifecycle,
						},
					};
				}
				default: {
					const envelope = privatePresentationEnvelope(event);
					return {
						...context,
						presentation: envelope
							? reduceWorkbenchPresentation(context.presentation, envelope)
							: context.presentation,
					};
				}
			}
		}),
		clearActiveTurn: assign({ activeTurnId: () => null }),
		recordTurnTerminal: assign(({ context, event }) =>
			isTurnTerminalEvent(event)
				? { ...context, lastTurnTerminal: event }
				: context,
		),
		clearModelFailure: assign({ modelFailure: () => null }),
		recordModelFailure: assign({
			modelFailure: ({ event }) =>
				event.type === "MODEL_FAILED" ? event.failure : null,
		}),
		recordActiveTurnModelFailure: assign(({ context, event }) => {
			if (event.type !== "MODEL_FAILED") return context;
			const currentTurn = context.presentation.turn;
			const failureTurn: WorkbenchTurnFact =
				currentTurn?.type === "model-failed"
					? currentTurn
					: {
							type: "model-failed",
							failureKind: event.failure.kind,
							message: event.failure.message,
							trace: [],
						};
			return {
				...context,
				modelFailure: event.failure,
				presentation: reduceWorkbenchPresentation(context.presentation, {
					channel: "read-model",
					update: { type: "turn-recorded", fact: failureTurn },
				}),
			};
		}),
	},
	guards: {
		transitionAccepted: ({ context, event }) =>
			isConversationAction(event) &&
			reduceConversationSession(context, event).accepted,
		terminalMatchesActiveTurn: ({ context, event }) =>
			isTurnTerminalEvent(event) && event.turnId === context.activeTurnId,
		completedTurnIsReady: ({ context, event }) =>
			event.type === "TURN_COMPLETED" &&
			event.turnId === context.activeTurnId &&
			context.pendingCompletion !== null,
		completionCanStage: ({ context, event }) =>
			event.type === "COMPLETE_RESPONSE" &&
			context.pendingCompletion === null &&
			reduceConversationSession(context, event).accepted,
	},
}).createMachine({
	id: "conversation-session",
	initial: "preparing",
	context: () => ({
		...createInitialSession("voice-workbench"),
		modelFailure: null,
		presentation: createInitialPresentation(),
		activeTurnId: null,
		pendingCompletion: null,
		lastTurnTerminal: null,
		childLifecycles: {
			modelTurn: null,
			voiceCapture: null,
			speechDelivery: null,
		},
	}),
	on: {
		ACKNOWLEDGE_SPEECH: { actions: "applyTransition" },
		PRESENTATION_UPDATED: { actions: "applyPresentationUpdate" },
		DOCUMENT_COMMITTED: { actions: "applyPrivateEvent" },
		SPEECH_COMMITTED: { actions: "applyPrivateEvent" },
		VOICE_RECORDED: { actions: "applyPrivateEvent" },
		CAPABILITY_OUTCOME_RECORDED: { actions: "applyPrivateEvent" },
		DOMAIN_POLICY_RECORDED: { actions: "applyPrivateEvent" },
		RUNTIME_MANIFEST_RECORDED: { actions: "applyPrivateEvent" },
		TURN_RECORDED: { actions: "applyPrivateEvent" },
		MODEL_TURN_LIFECYCLE_UPDATED: { actions: "applyPrivateEvent" },
		VOICE_CAPTURE_LIFECYCLE_UPDATED: { actions: "applyPrivateEvent" },
		SPEECH_DELIVERY_LIFECYCLE_UPDATED: { actions: "applyPrivateEvent" },
	},
	states: {
		preparing: {
			on: {
				MODEL_AVAILABLE: {
					target: "available",
					actions: "clearModelFailure",
				},
				MODEL_FAILED: {
					target: "unavailable",
					actions: "recordModelFailure",
				},
			},
		},
		unavailable: {
			on: {
				MODEL_PREPARATION_STARTED: {
					target: "preparing",
					actions: "clearModelFailure",
				},
				MODEL_AVAILABLE: {
					target: "available",
					actions: "clearModelFailure",
				},
			},
		},
		available: {
			initial: "idle",
			on: {
				SET_CHECKLIST_ITEM: { actions: "applyTransition" },
				MODEL_PREPARATION_STARTED: {
					target: "#conversation-session.preparing",
					actions: ["clearModelFailure", "discardPendingCompletion"],
				},
				MODEL_FAILED: {
					target: "#conversation-session.unavailable",
					actions: "recordModelFailure",
				},
			},
			states: {
				idle: {
					on: {
						RESTORE_ARTIFACT_REVISION: { actions: "applyTransition" },
						SELECT_ARTIFACT: { actions: "applyTransition" },
						SUBMIT_PROMPT: [
							{
								guard: "transitionAccepted",
								target: "responding",
								actions: "applyTransition",
							},
							{ actions: "applyTransition" },
						],
					},
				},
				responding: {
					exit: "clearActiveTurn",
					on: {
						MODEL_FAILED: {
							target: "#conversation-session.unavailable",
							actions: [
								"recordActiveTurnModelFailure",
								"discardPendingCompletion",
							],
						},
						CREATE_ARTIFACT: { actions: "applyTransition" },
						REVISE_ARTIFACT: { actions: "applyTransition" },
						COMPLETE_RESPONSE: [
							{
								guard: "completionCanStage",
								actions: "stageCompletion",
							},
							{ actions: "rejectCompletion" },
						],
						TURN_COMPLETED: {
							guard: "completedTurnIsReady",
							target: "idle",
							actions: "commitCompletedTurn",
						},
						TURN_FAILED: {
							guard: "terminalMatchesActiveTurn",
							target: "idle",
							actions: ["recordTurnTerminal", "discardPendingCompletion"],
						},
						CANCELLED: {
							guard: "terminalMatchesActiveTurn",
							target: "idle",
							actions: ["recordTurnTerminal", "discardPendingCompletion"],
						},
						TIMEOUT: {
							guard: "terminalMatchesActiveTurn",
							target: "idle",
							actions: ["recordTurnTerminal", "discardPendingCompletion"],
						},
						ROUND_LIMIT_REACHED: {
							guard: "terminalMatchesActiveTurn",
							target: "idle",
							actions: ["recordTurnTerminal", "discardPendingCompletion"],
						},
					},
				},
			},
		},
	},
});

export type VoiceWorkbenchSessionSnapshot = SnapshotFrom<
	typeof voiceWorkbenchSessionMachine
>;

export const voiceWorkbenchSessionInvariants = {
	respondingRequiresAvailable: (snapshot: VoiceWorkbenchSessionSnapshot) =>
		!snapshot.matches({ available: "responding" }) ||
		snapshot.matches("available"),
	hasNoKnownForbiddenState: (snapshot: VoiceWorkbenchSessionSnapshot) =>
		!isVoiceWorkbenchKnownForbiddenStateValue(snapshot.value),
} as const;

export const createVoiceWorkbenchSessionActor = () =>
	createActor(voiceWorkbenchSessionMachine);

export type VoiceWorkbenchSessionActor = ReturnType<
	typeof createVoiceWorkbenchSessionActor
>;

export const source = createVoiceWorkbenchSessionActor().start();

/** Example-private adapter/read-model ports. These are intentionally absent from getSchema(). */
export const reportModelAvailable = (): void =>
	source.send({ type: "MODEL_AVAILABLE" });

export const reportModelFailure = (failure: ModelFailureFact): void =>
	source.send({ type: "MODEL_FAILED", failure });

export const commitDocument = (
	document: NonNullable<WorkbenchPresentation["documentCommit"]>,
): void => source.send({ type: "DOCUMENT_COMMITTED", document });

export const commitSpeech = (
	speech: NonNullable<WorkbenchPresentation["speechCommit"]>,
): void => source.send({ type: "SPEECH_COMMITTED", speech });

export const presentVoice = (fact: VoiceCaptureFact): void =>
	source.send({ type: "VOICE_RECORDED", fact });

export const recordCapabilityOutcome = (
	outcome: WorkbenchCapabilityOutcome,
): void => source.send({ type: "CAPABILITY_OUTCOME_RECORDED", outcome });

export const recordDomainPolicyDecision = (
	decision: DomainPolicyDecision,
): void => source.send({ type: "DOMAIN_POLICY_RECORDED", decision });

export const recordRuntimeManifest = (
	manifest: readonly WorkbenchRuntimeManifestEntry[],
): void => source.send({ type: "RUNTIME_MANIFEST_RECORDED", manifest });

export const recordTurn = (fact: WorkbenchTurnFact): void =>
	source.send({ type: "TURN_RECORDED", fact });

export const recordModelTurnLifecycle = (
	lifecycle: ModelTurnLifecycleProjection,
): void => source.send({ type: "MODEL_TURN_LIFECYCLE_UPDATED", lifecycle });

export const recordVoiceCaptureLifecycle = (
	lifecycle: VoiceCaptureLifecycleProjection,
): void => source.send({ type: "VOICE_CAPTURE_LIFECYCLE_UPDATED", lifecycle });

export const recordSpeechDeliveryLifecycle = (
	lifecycle: SpeechDeliveryLifecycleProjection,
): void =>
	source.send({ type: "SPEECH_DELIVERY_LIFECYCLE_UPDATED", lifecycle });

export const recordTurnTerminal = (
	event: VoiceWorkbenchTurnTerminalEvent,
): void => source.send(event);

const PRODUCT_PRICE_REASON_LABELS: Record<ProductPriceReasonCode, string> = {
	"candidate-ambiguous": "Candidate selection ambiguous",
	"candidate-low-confidence": "Candidate needs clarification",
	"product-not-found": "Product not found",
	"offer-unavailable": "Current offer unavailable",
	"provider-response-invalid": "Provider response invalid",
	"provider-unavailable": "Pricing provider unavailable",
};

const readableArtifactTitle = (
	title: string | undefined,
	id: string,
): string => {
	const value = title?.trim() || id.trim();
	if (!/[-_]/.test(value)) return value;
	return value
		.split(/[-_]+/)
		.filter(Boolean)
		.map((part) => {
			if (part.toLowerCase() === "wholefoods") return "Whole Foods";
			return `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`;
		})
		.join(" ");
};

const tableCellView = (value: unknown, columnLabel: string) => {
	if (typeof value === "string" && value.trim()) {
		const text = value.trim();
		try {
			const url = new URL(text);
			if (url.protocol === "https:" || url.protocol === "http:") {
				const hostname = url.hostname.replace(/^www\./, "");
				return {
					text: hostname,
					link: {
						href: url.href,
						ariaLabel: `Source: ${hostname}`,
					},
				};
			}
		} catch {
			// Ordinary text cells are not links.
		}
		if (text.toLowerCase() === "unverified") {
			return { text: "Unverified", tone: "warning" as const };
		}
		if (text.toLowerCase() === "sourced") {
			return { text: "Verified", tone: "success" as const };
		}
		return { text };
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return { text: String(value) };
	}
	const column = columnLabel.trim().toLowerCase();
	const text =
		column === "price"
			? "Price unavailable"
			: column === "source"
				? "No source"
				: column === "product"
					? "No product matched"
					: "—";
	return { text, tone: "muted" as const };
};

type WorkbenchResultQuality = {
	tone: "success" | "warning" | "needs-input";
	statusLabel: string;
	heading: string;
	summary: string;
	metrics: readonly {
		key: "requested" | "matched" | "verified";
		label: string;
		value: number;
	}[];
	issueRows: readonly { key: string; subject: string; label: string }[];
	nextActions: readonly string[];
};

const productPricingResultQuality = (
	policy: DomainPolicyDecision | null,
	outcomes: readonly WorkbenchCapabilityOutcome[],
): WorkbenchResultQuality | null => {
	if (policy?.domainId !== "product-pricing") return null;
	if (policy.outcome === "needs-input") {
		return {
			tone: "needs-input",
			statusLabel: "Needs input",
			heading: "Pricing needs clarification",
			summary: policy.summary,
			metrics: [],
			issueRows: [],
			nextActions: ["Answer the clarification questions to continue pricing."],
		};
	}
	if (policy.outcome === "rejected") {
		return {
			tone: "warning",
			statusLabel: "Request rejected",
			heading: "Pricing request needs revision",
			summary: policy.summary,
			metrics: [],
			issueRows: [],
			nextActions: ["Revise the request before continuing pricing."],
		};
	}
	const outcome = [...outcomes]
		.reverse()
		.find(
			(candidate) =>
				candidate.ownerId === "product-pricing-price" &&
				candidate.toolName === "priceProducts",
		);
	if (!outcome) return null;
	const rows = outcome.pricingRows ?? [];
	if (rows.length === 0) {
		return {
			tone: "warning",
			statusLabel: "Partial result",
			heading: "Pricing results unavailable",
			summary: "No item-level pricing results were returned.",
			metrics: [],
			issueRows: [],
			nextActions: ["Retry pricing when the provider is available."],
		};
	}
	const requested = rows.length;
	const matched = rows.filter((row) => row.product && row.size).length;
	const verified = rows.filter((row) => row.priceStatus === "sourced").length;
	const issueRows = rows.flatMap((row, index) =>
		row.priceStatus === "unverified"
			? [
					{
						key: `${row.subject}-${index}`,
						subject: row.subject,
						label: PRODUCT_PRICE_REASON_LABELS[row.reasonCode],
					},
				]
			: [],
	);
	const clarificationSubjects = rows
		.filter(
			(row) =>
				row.priceStatus === "unverified" &&
				(row.reasonCode === "candidate-ambiguous" ||
					row.reasonCode === "candidate-low-confidence" ||
					row.reasonCode === "product-not-found"),
		)
		.map((row) => row.subject);
	const hasUnavailableOffer = rows.some(
		(row) =>
			row.priceStatus === "unverified" &&
			row.reasonCode === "offer-unavailable",
	);
	const hasProviderIssue = rows.some(
		(row) =>
			row.priceStatus === "unverified" &&
			(row.reasonCode === "provider-response-invalid" ||
				row.reasonCode === "provider-unavailable"),
	);
	const complete = verified === requested;
	const nextActions = complete
		? ["Review verified prices before shopping."]
		: [
				clarificationSubjects.length > 0
					? `Clarify brand, size, or variety for ${clarificationSubjects.join(", ")}.`
					: null,
				hasUnavailableOffer
					? "Open matched product pages to confirm current availability and price."
					: null,
				hasProviderIssue
					? "Retry pricing when the provider is available."
					: null,
			].filter((action): action is string => action !== null);
	return {
		tone: complete ? "success" : "warning",
		statusLabel: complete ? "Complete result" : "Partial result",
		heading: complete
			? "Shopping list prices verified"
			: verified === 0
				? "Shopping list created; prices unavailable"
				: "Shopping list created with partial pricing",
		summary: `${requested} requested · ${matched} products matched · ${verified} prices verified`,
		metrics: [
			{ key: "requested", label: "requested", value: requested },
			{ key: "matched", label: "matched", value: matched },
			{ key: "verified", label: "verified", value: verified },
		],
		issueRows,
		nextActions:
			nextActions.length > 0
				? nextActions
				: ["Review unverified items before shopping."],
	};
};

export const projectVoiceWorkbenchView = ({
	snapshot,
}: {
	snapshot: VoiceWorkbenchSessionSnapshot;
}) => {
	const modelPreparing = snapshot.matches("preparing");
	const modelFailed = snapshot.matches("unavailable");
	const modelAvailable = snapshot.matches("available");
	const responding = snapshot.matches({ available: "responding" });
	const turnReady = snapshot.matches({ available: "idle" });
	const status = modelPreparing
		? "preparing"
		: modelFailed
			? "failed"
			: responding
				? "responding"
				: "ready";
	const artifacts = snapshot.context.documents.map((document) => ({
		...document,
		displayTitle: readableArtifactTitle(document.title, document.id),
		nodes: document.nodes.map((node) => {
			const payload = node.kind === "action" ? node.payload : null;
			const speech =
				typeof payload === "object" &&
				payload !== null &&
				!Array.isArray(payload) &&
				typeof payload.speech === "string" &&
				payload.speech.trim().length > 0
					? payload.speech.trim()
					: undefined;
			const input =
				node.kind === "action" &&
				node.commandName === "completeResponse" &&
				typeof payload === "object" &&
				payload !== null &&
				!Array.isArray(payload) &&
				typeof payload.text === "string" &&
				payload.text.trim().length > 0 &&
				(payload.speech === undefined || speech !== undefined)
					? {
							text: payload.text.trim(),
							...(speech ? { speech } : {}),
						}
					: null;
			return {
				...node,
				action: input ? { enabled: responding, input } : null,
				displayRows:
					node.kind === "table"
						? node.rows.map((row) => ({
								id: row.id,
								cells: row.cells.map((cell, index) =>
									tableCellView(cell, node.columns[index]?.label ?? ""),
								),
							}))
						: [],
			};
		}),
	}));
	const activeArtifact =
		artifacts.find(
			(artifact) => artifact.id === snapshot.context.activeArtifactId,
		) ??
		artifacts[artifacts.length - 1] ??
		null;
	const artifactSummaries = artifacts.map((artifact) => ({
		id: artifact.id,
		title: artifact.displayTitle,
		revision: artifact.revision,
		nodeCount: artifact.nodes.length,
		active: artifact.id === activeArtifact?.id,
	}));
	const activeArtifactRevisions = activeArtifact
		? snapshot.context.artifactRevisions
				.filter((document) => document.id === activeArtifact.id)
				.map((document) => ({
					revision: document.revision,
					title: readableArtifactTitle(document.title, document.id),
					nodeCount: document.nodes.length,
					current: document.revision === activeArtifact.revision,
				}))
		: [];
	const canSetChecklistItem =
		turnReady &&
		artifacts.some((artifact) =>
			artifact.nodes.some((node) => node.kind === "checklist"),
		);
	const turnCount = snapshot.context.messages.filter(
		(message) => message.role === "user",
	).length;
	const presentation = snapshot.context.presentation;
	const respondingProgress = describeRespondingProgress(
		snapshot.context.lastFact,
	);
	const voice = presentation.voice;
	const transcript = voice.type === "voice-transcript" ? voice.text : null;
	const transcriptReady = voice.type === "voice-transcript" && voice.final;
	const voiceFailure =
		voice.type === "voice-permission-denied" || voice.type === "voice-error"
			? voice
			: null;
	const documentSchema = JSON.stringify(
		activeArtifact
			? {
					id: activeArtifact.id,
					title: activeArtifact.title,
					revision: activeArtifact.revision,
					nodes: activeArtifact.nodes.map((node) => {
						const { action: _action, ...schemaNode } = node;
						if ("displayRows" in schemaNode) {
							const { displayRows: _displayRows, ...actorNode } = schemaNode;
							return actorNode;
						}
						return schemaNode;
					}),
				}
			: { artifacts: [] },
		null,
		2,
	);
	const providerState = modelPreparing
		? "preparing"
		: modelFailed
			? "failed"
			: "available";
	const turnState = modelPreparing
		? "preparing"
		: modelFailed
			? "unavailable"
			: responding
				? "responding"
				: "idle";
	const actorMatchText = modelPreparing
		? 'matches("preparing")'
		: modelFailed
			? 'matches("unavailable")'
			: `matches({\n  available: "${responding ? "responding" : "idle"}",\n})`;
	const artifactLine = activeArtifact
		? `${activeArtifact.displayTitle} · revision ${activeArtifact.revision}`
		: "No accepted artifact yet";
	let previewText: string;
	switch (presentation.runtimePreview) {
		case "browser":
			previewText = `Browser JSX preview\n${artifactLine}\n${describeFact(snapshot.context.lastFact)}`;
			break;
		case "terminal":
			previewText = `Terminal projection\nPreview only · no remote terminal sync\nstate: ${turnState}\n${artifactLine}`;
			break;
		case "speech":
			previewText = `Speech projection\n${snapshot.context.response?.speech ?? snapshot.context.response?.text ?? "No response available for speech"}\nstatus: ${snapshot.context.speech?.status ?? "idle"}`;
			break;
		case "headless":
			previewText = `Headless projection\n${JSON.stringify(
				{
					state: snapshot.value,
					actorRevision: snapshot.context.revision,
					activeArtifactId: snapshot.context.activeArtifactId,
				},
				null,
				2,
			)}`;
			break;
	}
	const capabilityRows =
		presentation.capabilityOutcomes.length === 0
			? [
					{
						key: "empty-capability-row",
						className: "capability-outcome capability-outcome-empty",
						heading: "No external capability facts yet",
						statusLabel: "waiting",
						message: "Capability adapter outcomes appear after execution.",
					},
				]
			: presentation.capabilityOutcomes.flatMap((outcome, index) => {
					const key = `${outcome.ownerId}-${outcome.toolName}-${index}`;
					const capabilityRow = {
						key,
						className: "capability-outcome",
						heading: `${outcome.ownerId} · ${outcome.toolName}`,
						statusLabel: `${outcome.type}${outcome.status ? ` · HTTP ${outcome.status}` : ""}${outcome.cacheStatus ? ` · cache ${outcome.cacheStatus}` : ""}`,
						message: [
							outcome.message,
							outcome.retry
								? `${outcome.retry.attempts}/${outcome.retry.maxAttempts} attempts${outcome.retry.exhausted ? " · exhausted" : ""}`
								: null,
							outcome.fallback
								? fallbackAttemptSummary(outcome.fallback)
								: null,
						]
							.filter((value): value is string => value !== null)
							.join(" · "),
					};
					const pricingRows = (outcome.pricingRows ?? []).map(
						(pricing, pricingIndex) => ({
							key: `${key}-pricing-${pricingIndex}`,
							className: "capability-outcome",
							heading: `${pricing.subject} · product pricing`,
							statusLabel: `${pricing.priceStatus} · cache ${pricing.cacheStatus}`,
							message: [
								pricing.product && pricing.size
									? `${pricing.product} · ${pricing.size}`
									: "No selected product",
								pricing.priceStatus === "unverified"
									? PRODUCT_PRICE_REASON_LABELS[pricing.reasonCode]
									: null,
								`native ${pricing.nativeStatus}`,
								`Brave ${pricing.braveStatus}`,
							]
								.filter((value): value is string => value !== null)
								.join(" · "),
							...pricing,
						}),
					);
					return [capabilityRow, ...pricingRows];
				});
	const domainPolicySections = presentation.domainPolicy
		? [
				{
					key: "assumptions",
					heading: "Assumptions",
					rows: presentation.domainPolicy.assumptions.map((assumption) => ({
						key: assumption.id,
						text: assumption.label,
					})),
				},
				{
					key: "questions",
					heading: "Clarification questions",
					rows: presentation.domainPolicy.questions.map((question) => ({
						key: question.id,
						text: question.prompt,
					})),
				},
				{
					key: "evidence",
					heading: "Evidence requirements",
					rows: presentation.domainPolicy.evidenceRequirements.map(
						(requirement) => ({
							key: requirement.id,
							text: requirement.label,
						}),
					),
				},
			].filter((section) => section.rows.length > 0)
		: [];
	const domainPolicy = presentation.domainPolicy
		? {
				heading: "Domain policy proof",
				statusLabel: presentation.domainPolicy.outcome.replace("-", " "),
				summary: presentation.domainPolicy.summary,
				identityRows: [
					{
						key: "domain",
						label: "Domain",
						value: presentation.domainPolicy.domainLabel,
					},
					{
						key: "policy",
						label: "Policy",
						value: presentation.domainPolicy.policyLabel,
					},
				],
				sections: domainPolicySections,
			}
		: null;
	const manifestRows =
		presentation.runtimeManifest.length === 0
			? [
					{
						key: "empty-manifest-row",
						name: "Awaiting the next model request",
						dataCommandName: "pending-model-request",
						summaryLabel: "no live commands captured",
						descriptions: [
							"The exact availability-scoped manifest appears at the next model boundary.",
						],
						schemaText: "input · unavailable until request",
					},
				]
			: presentation.runtimeManifest.map((tool) => ({
					key: tool.name,
					name: tool.name,
					dataCommandName: tool.name,
					summaryLabel: `${tool.ownerId} · live · ${tool.gated ? "gated" : "available"}`,
					descriptions: tool.description ? [tool.description] : [],
					schemaText: formatSchema(tool.inputSchema),
				}));
	const blueprintRows = Object.entries(componentBlueprintCommands).map(
		([name, commandSchema]) => ({
			key: name,
			className: "command",
			name,
			descriptions:
				typeof commandSchema.description === "string"
					? [commandSchema.description]
					: [],
			schemaText: formatSchema(commandSchema.input),
		}),
	);
	const traceRows = [
		{
			key: "transcript",
			className: "trace-step",
			heading: "Text or speech transcript",
			detail: "outer adapter → text + modality",
		},
		{
			key: "actor-fact",
			className: "trace-step",
			heading: describeFact(snapshot.context.lastFact),
			detail: "current public actor fact",
		},
		{
			key: "artifact",
			className: "trace-step",
			heading: activeArtifact
				? `Artifact revision ${activeArtifact.revision} stored`
				: "Awaiting accepted artifact",
			detail: "semantic nodes, never generated DOM",
		},
		...(presentation.turn?.capability
			? [
					{
						key: "capability",
						className: "trace-step capability-proof",
						heading: `${presentation.turn.capability.provider} · ${presentation.turn.capability.tool}`,
						detail: capabilityProofSummary(presentation.turn.capability),
					},
				]
			: []),
		...(presentation.turn?.collision
			? [
					{
						key: "collision",
						className: "trace-step collision-proof",
						heading: "Capability manifest collision",
						detail: `${presentation.turn.collision.toolNames.join(", ")} · ${presentation.turn.collision.owners.join(" + ")}`,
					},
				]
			: []),
	];
	const resultQuality = productPricingResultQuality(
		presentation.domainPolicy,
		presentation.capabilityOutcomes,
	);
	return {
		sessionId: snapshot.context.sessionId,
		lifecycle: {
			state: snapshot.value,
			activeTurnId: snapshot.context.activeTurnId,
			lastTurnTerminal: snapshot.context.lastTurnTerminal,
			children: snapshot.context.childLifecycles,
		},
		portRequests: {
			modelPreparation: modelPreparing
				? { type: "prepare-model" as const }
				: null,
			voiceCapture: presentation.voiceCaptureRequest,
			speechDelivery: presentation.speechReplayRequest,
		},
		modelContext: {
			status,
			activeArtifactId: snapshot.context.activeArtifactId,
			artifacts: snapshot.context.documents,
		},
		status,
		statusLabel: modelPreparing
			? "Preparing local model"
			: modelFailed
				? "Model unavailable"
				: responding
					? "Responding"
					: "Ready",
		canSubmitPrompt: modelAvailable && turnReady,
		canSetChecklistItem,
		canRestoreArtifactRevision:
			turnReady &&
			activeArtifactRevisions.some((revision) => !revision.current),
		canRetryModel: modelFailed,
		activeArtifact,
		resultQuality,
		artifactSummaries,
		activeArtifactRevisions,
		turnCount,
		turnLabel: `${turnCount} ${turnCount === 1 ? "turn" : "turns"}`,
		speechStatus: snapshot.context.speech?.status ?? "idle",
		documentSchema,
		voiceState: voiceState(voice),
		transcript,
		transcriptReady,
		microphoneUnavailable: voice.type === "voice-unsupported",
		voiceFailure,
		turnMessage: describeTurn(presentation.turn),
		lastFactLabel: describeFact(snapshot.context.lastFact),
		respondingProgress,
		modelPreparing,
		modelFailed,
		promptPlaceholder: modelPreparing
			? "Waiting for the local model to finish preparing…"
			: modelFailed
				? "Retry the local model before sending a prompt…"
				: "Ask the agent to create or revise an artifact…",
		turnState,
		model: {
			status: modelPreparing
				? "preparing"
				: modelFailed
					? "failed"
					: "available",
			failure: snapshot.context.modelFailure,
		},
		revision: snapshot.context.revision,
		messageCount: snapshot.context.messages.length,
		messages: snapshot.context.messages,
		lastFact: snapshot.context.lastFact,
		artifacts,
		speech: snapshot.context.speech,
		activeArtifactId: snapshot.context.activeArtifactId,
		response: snapshot.context.response,
		canRevise: responding && snapshot.context.documents.length > 0,
		presentation: snapshot.context.presentation,
		runtimeInspector: {
			activeStates: snapshot.value,
			mlx: {
				status: providerState,
				ready: modelAvailable,
				heading: "MLX model readiness",
				statusLabel: providerState,
				detail: modelAvailable
					? "Inference admitted for prompts"
					: "Prompts remain gated",
			},
			actor: {
				lastFact: snapshot.context.lastFact,
				revision: snapshot.context.revision,
				heading: "Compound actor state",
				matchText: actorMatchText,
				factLabel: `Current actor fact · ${describeFact(snapshot.context.lastFact)}`,
			},
			selectedPreview: presentation.runtimePreview,
			preview: {
				text: previewText,
				selectors: runtimePreviewDefinitions.map((preview) => ({
					...preview,
					selected: preview.id === presentation.runtimePreview,
				})),
			},
			capabilityRows,
			domainPolicy,
			domainPolicyCards: domainPolicy ? [domainPolicy] : [],
			trace: {
				acceptedArtifactLabel: activeArtifact
					? `Artifact revision ${activeArtifact.revision} stored`
					: "Awaiting accepted artifact",
				rows: traceRows,
			},
			receipts: [
				{
					id: "browser" as const,
					className: "commit commit-browser",
					icon: "▤",
					title: "Browser · native JSX",
					detail: presentation.documentCommit
						? `${presentation.documentCommit.id} · revision ${presentation.documentCommit.revision}`
						: "awaiting artifact",
					statusLabel: presentation.documentCommit ? "current" : "idle",
				},
				{
					id: "terminal" as const,
					className: "commit commit-terminal",
					icon: ">_",
					title: "Terminal · Node",
					detail: "preview only · no remote terminal sync",
					statusLabel: "headless",
				},
				{
					id: "speech" as const,
					className: "commit commit-speech",
					icon: "◖",
					title: "Speech · audio",
					detail:
						presentation.speechCommit?.text ??
						"browser adapter · actor acknowledged",
					statusLabel: presentation.speechCommit?.status ?? "idle",
				},
			],
			schemaExplorer: {
				manifest: {
					heading: "Availability-scoped model manifest",
					countLabel: `${presentation.runtimeManifest.length} live ${presentation.runtimeManifest.length === 1 ? "command" : "commands"}`,
					rows: manifestRows,
				},
				blueprint: {
					heading: "All-component blueprint",
					countLabel: `${blueprintRows.length} commands from getSchema()`,
					rows: blueprintRows,
				},
				policy: {
					heading: "renderJavascript rejected",
					result: blueprintRows.some((row) => row.name === "renderJavascript")
						? "unexpectedly admitted"
						: "command-not-allowed · absent from schema",
				},
			},
		},
	};
};

export const component = igniteCore({
	source,
	cleanup: true,
	events: (event) => ({
		"prompt-submitted": event<{
			turnId: string;
			modality: "text" | "speech";
			text: string;
		}>(),
		"artifact-created": event<{ artifactId: string; revision: string }>(),
		"artifact-revised": event<{ artifactId: string; revision: string }>(),
		"artifact-restored": event<{
			artifactId: string;
			fromRevision: string;
			revision: string;
		}>(),
		"artifact-selected": event<{ artifactId: string }>(),
		"artifact-rejected": event<{
			reason: "validation" | "conflict";
			issues?: readonly string[];
		}>(),
		"response-completed": event(),
		"speech-acknowledged": event<{ id: string }>(),
	}),
	view: projectVoiceWorkbenchView,
	commands: ({ actor, command }) => {
		const responsePayloadInput = command.object(
			{
				text: command.string({ minLength: 1 }),
				speech: command.string({ minLength: 1 }),
			},
			{ required: ["text"] },
		);
		const actionNodeInput = command.object(
			{
				kind: command.enum(["action"]),
				id: command.string({ minLength: 1 }),
				label: command.string({ minLength: 1 }),
				commandName: command.enum(["completeResponse"]),
				payload: responsePayloadInput,
				description: command.string({ minLength: 1 }),
			},
			{
				required: ["kind", "id", "label", "commandName", "payload"],
			},
		);
		const semanticNodeInput = command.object(
			{
				id: command.string({ minLength: 1 }),
				kind: command.enum([
					"text",
					"checklist",
					"action",
					"form",
					"table",
					"timeline",
					"chart",
					"code-diff",
					"decision-log",
				]),
				text: command.string({ minLength: 1 }),
				items: command.array(
					command.object(
						{
							id: command.string({ minLength: 1 }),
							label: command.string({ minLength: 1 }),
							checked: command.boolean(),
						},
						{ required: ["id", "label", "checked"] },
					),
					{ minItems: 1 },
				),
				label: command.string({ minLength: 1 }),
				commandName: command.enum(["completeResponse"]),
				payload: responsePayloadInput,
				description: command.string({ minLength: 1 }),
				title: command.string({ minLength: 1 }),
				fields: command.array(
					command.object(
						{
							id: command.string({ minLength: 1 }),
							label: command.string({ minLength: 1 }),
							input: command.object(
								{
									type: command.enum(["string", "number", "boolean"]),
									title: command.string({ minLength: 1 }),
									description: command.string({ minLength: 1 }),
									minimum: command.number(),
									maximum: command.number(),
									minLength: command.number({ minimum: 0 }),
									maxLength: command.number({ minimum: 0 }),
								},
								{ required: ["type"] },
							),
							value: command.string(),
							description: command.string({ minLength: 1 }),
						},
						{ required: ["id", "label", "input"] },
					),
				),
				submit: actionNodeInput,
				columns: command.array(
					command.object(
						{
							id: command.string({ minLength: 1 }),
							label: command.string({ minLength: 1 }),
						},
						{ required: ["id", "label"] },
					),
				),
				rows: command.array(
					command.object(
						{
							id: command.string({ minLength: 1 }),
							cells: command.array(),
						},
						{ required: ["id", "cells"] },
					),
				),
				events: command.array(
					command.object(
						{
							id: command.string({ minLength: 1 }),
							label: command.string({ minLength: 1 }),
							timestamp: command.string({ minLength: 1 }),
							detail: command.string({ minLength: 1 }),
						},
						{ required: ["id", "label", "timestamp"] },
					),
				),
				chartType: command.enum(["bar", "line", "pie"]),
				series: command.array(
					command.object(
						{
							id: command.string({ minLength: 1 }),
							label: command.string({ minLength: 1 }),
							value: command.number(),
						},
						{ required: ["id", "label", "value"] },
					),
				),
				language: command.string({ minLength: 1 }),
				before: command.string({ minLength: 1 }),
				after: command.string({ minLength: 1 }),
				entries: command.array(
					command.object(
						{
							id: command.string({ minLength: 1 }),
							title: command.string({ minLength: 1 }),
							decision: command.string({ minLength: 1 }),
							rationale: command.string({ minLength: 1 }),
						},
						{ required: ["id", "title", "decision"] },
					),
				),
			},
			{ required: ["id", "kind"] },
		);
		const sendPresentationUpdate = (envelope: WorkbenchPresentationEnvelope) =>
			actor.send({ type: "PRESENTATION_UPDATED", envelope });

		return {
			acknowledgeSpeech: command(
				(input: AcknowledgeSpeechInput) =>
					actor.send({ type: "ACKNOWLEDGE_SPEECH", input }),
				{
					channel: "user-intent",
					description: "Acknowledge the currently pending speech request.",
					canExecute: ({ snapshot }) =>
						snapshot.context.speech?.status === "pending",
					input: command.object(
						{ id: command.string({ minLength: 1 }) },
						{ required: ["id"] },
					),
				},
			),
			beginModelPreparation: command(
				() => actor.send({ type: "MODEL_PREPARATION_STARTED" }),
				{ channel: "user-intent" },
			),
			cancelVoiceCapture: command(
				() => {
					const sequence =
						(actor.getSnapshot().context.presentation.voiceCaptureRequest
							?.sequence ?? 0) + 1;
					sendPresentationUpdate({
						channel: "user-intent",
						update: {
							type: "voice-capture-requested",
							action: "cancel",
							sequence,
						},
					});
				},
				{ channel: "user-intent" },
			),
			changeArtifactView: command(
				(view: WorkbenchArtifactView) =>
					sendPresentationUpdate({
						channel: "user-intent",
						update: { type: "artifact-view-changed", view },
					}),
				{ channel: "user-intent" },
			),
			changeDraft: command(
				(draft: string) =>
					sendPresentationUpdate({
						channel: "user-intent",
						update: { type: "draft-changed", draft },
					}),
				{ channel: "user-intent" },
			),
			changeMobilePanel: command(
				(panel: WorkbenchPanel) =>
					sendPresentationUpdate({
						channel: "user-intent",
						update: { type: "mobile-panel-changed", panel },
					}),
				{ channel: "user-intent" },
			),
			changeSpeechPreference: command(
				(enabled: boolean) =>
					sendPresentationUpdate({
						channel: "user-intent",
						update: { type: "speech-preference-changed", enabled },
					}),
				{ channel: "user-intent" },
			),
			completeResponse: command(
				(input: CompleteResponseInput) =>
					actor.send({ type: "COMPLETE_RESPONSE", input }),
				{
					channel: "model-intent",
					description: "Complete the active response turn.",
					canExecute: ({ snapshot }) =>
						snapshot.matches({ available: "responding" }) &&
						snapshot.context.documents.length > 0,
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
					actor.send({ type: "CREATE_ARTIFACT", input }),
				{
					channel: "model-intent",
					description:
						"Create a validated semantic artifact for the active turn.",
					canExecute: ({ snapshot }) =>
						snapshot.matches({ available: "responding" }),
					input: command.object(
						{
							id: command.string({ minLength: 1 }),
							title: command.string({ minLength: 1 }),
							nodes: command.array(semanticNodeInput, { minItems: 1 }),
						},
						{ required: ["id", "nodes"] },
					),
				},
			),
			playSpeech: command(
				() => {
					const context = actor.getSnapshot().context;
					const text = context.response?.speech;
					if (!text) return;
					sendPresentationUpdate({
						channel: "user-intent",
						update: {
							type: "speech-replay-requested",
							request: {
								id: context.speech?.id ?? `manual-${context.revision}`,
								text,
								sequence:
									(context.presentation.speechReplayRequest?.sequence ?? 0) + 1,
							},
						},
					});
				},
				{ channel: "user-intent" },
			),
			replay: command(
				() =>
					sendPresentationUpdate({
						channel: "user-intent",
						update: { type: "replayed" },
					}),
				{ channel: "user-intent" },
			),
			selectRuntimePreview: command(
				(preview: WorkbenchRuntimePreview) =>
					sendPresentationUpdate({
						channel: "user-intent",
						update: { type: "runtime-preview-selected", preview },
					}),
				{ channel: "user-intent" },
			),
			reviseArtifact: command(
				(input: ReviseArtifactInput) =>
					actor.send({ type: "REVISE_ARTIFACT", input }),
				{
					channel: "model-intent",
					description:
						"Revise an artifact when its expected revision still matches.",
					canExecute: ({ snapshot }) =>
						snapshot.matches({ available: "responding" }) &&
						snapshot.context.documents.length > 0,
					input: command.object(
						{
							artifactId: command.string({ minLength: 1 }),
							expectedRevision: command.string({ minLength: 1 }),
							nodes: command.array(semanticNodeInput, { minItems: 1 }),
						},
						{ required: ["artifactId", "expectedRevision", "nodes"] },
					),
				},
			),
			restoreArtifactRevision: command(
				(input: RestoreArtifactRevisionInput) =>
					actor.send({ type: "RESTORE_ARTIFACT_REVISION", input }),
				{
					channel: "user-intent",
					description:
						"Restore a historical snapshot as a new forward artifact revision.",
					canExecute: ({ snapshot }) => {
						if (!snapshot.matches({ available: "idle" })) return false;
						const activeId = snapshot.context.activeArtifactId;
						const current = snapshot.context.documents.find(
							(document) => document.id === activeId,
						);
						return Boolean(
							current &&
								snapshot.context.artifactRevisions.some(
									(document) =>
										document.id === current.id &&
										document.revision !== current.revision,
								),
						);
					},
					input: command.object(
						{
							artifactId: command.string({ minLength: 1 }),
							expectedRevision: command.string({ minLength: 1 }),
							revision: command.string({ minLength: 1 }),
						},
						{
							required: ["artifactId", "expectedRevision", "revision"],
						},
					),
				},
			),
			selectArtifact: command(
				(input: SelectArtifactInput) =>
					actor.send({ type: "SELECT_ARTIFACT", input }),
				{
					channel: "user-intent",
					description: "Select the active artifact in this session.",
					canExecute: ({ snapshot }) =>
						snapshot.matches({ available: "idle" }) &&
						snapshot.context.documents.length > 0,
					input: command.object(
						{ artifactId: command.string({ minLength: 1 }) },
						{ required: ["artifactId"] },
					),
				},
			),
			setChecklistItem: command(
				(input: SetChecklistItemInput) =>
					actor.send({ type: "SET_CHECKLIST_ITEM", input }),
				{
					channel: "model-intent",
					description:
						"Set one checklist item when its artifact revision still matches.",
					canExecute: ({ snapshot }) =>
						(snapshot.matches({ available: "idle" }) ||
							snapshot.matches({ available: "responding" })) &&
						snapshot.context.documents.some((document) =>
							document.nodes.some((node) => node.kind === "checklist"),
						),
					input: command.object(
						{
							artifactId: command.string({ minLength: 1 }),
							expectedRevision: command.string({ minLength: 1 }),
							nodeId: command.string({ minLength: 1 }),
							itemId: command.string({ minLength: 1 }),
							checked: command.boolean(),
						},
						{
							required: [
								"artifactId",
								"expectedRevision",
								"nodeId",
								"itemId",
								"checked",
							],
						},
					),
				},
			),
			submitPrompt: command(
				(input: SubmitPromptInput) =>
					actor.send({ type: "SUBMIT_PROMPT", input }),
				{
					channel: "user-intent",
					description: "Open the next text or speech conversation turn.",
					canExecute: ({ snapshot }) => snapshot.matches({ available: "idle" }),
					input: command.object(
						{
							modality: command.enum(["text", "speech"]),
							text: command.string({ minLength: 1 }),
						},
						{ required: ["modality", "text"] },
					),
				},
			),
			startVoiceCapture: command(
				() => {
					const sequence =
						(actor.getSnapshot().context.presentation.voiceCaptureRequest
							?.sequence ?? 0) + 1;
					sendPresentationUpdate({
						channel: "user-intent",
						update: {
							type: "voice-capture-requested",
							action: "start",
							sequence,
						},
					});
				},
				{ channel: "user-intent" },
			),
			submitVoiceTranscript: command(
				() => {
					const voice = actor.getSnapshot().context.presentation.voice;
					if (
						voice.type !== "voice-transcript" ||
						!voice.final ||
						voice.text.trim().length === 0
					) {
						return;
					}
					sendPresentationUpdate({
						channel: "user-intent",
						update: {
							type: "voice-capture-requested",
							action: "cancel",
							sequence:
								(actor.getSnapshot().context.presentation.voiceCaptureRequest
									?.sequence ?? 0) + 1,
						},
					});
					actor.send({
						type: "SUBMIT_PROMPT",
						input: { modality: "speech", text: voice.text.trim() },
					});
				},
				{ channel: "user-intent" },
			),
		};
	},
	effects: ({ emit, select }) => {
		const fact = select((snapshot) => snapshot.context.lastFact);
		const sequence = select((snapshot) => snapshot.context.factSequence);
		if (!sequence.changed || !fact.current) return;
		emit(fact.current as ConversationFact);
	},
});

type WorkbenchRenderer = Extract<
	Parameters<typeof component>[1],
	(...args: never[]) => unknown
>;
export type WorkbenchProjection = Parameters<WorkbenchRenderer>[0];

export const workbenchSchema = component.getSchema();
componentBlueprintCommands = workbenchSchema.commands;
export const workbenchCommandNames = Object.freeze(
	Object.keys(workbenchSchema.commands),
);

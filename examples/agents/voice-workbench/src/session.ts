import type { NeutralTool } from "ignite-element/tools";
import { assign, createActor, type SnapshotFrom, sendTo, setup } from "xstate";
import type { ModelFailureFact, ModelTurnResult } from "./agent-loop";
import type { CapabilityFallbackAttempt } from "./capability-federation";
import {
	type CompleteResponseInput,
	type ConversationAction,
	type ConversationFact,
	type ConversationSession,
	createInitialSession,
	reduceConversationSession,
} from "./domain";
import type { DomainPolicyDecision } from "./domains/contracts";
import type { ProductPriceReasonCode } from "./domains/product-pricing/price-capability";
import {
	type ModelTurnLifecycleProjection,
	type ModelTurnTerminalEvent,
	modelTurnStateFromTerminal,
	modelTurnMachine,
	projectModelTurnLifecycle,
	projectModelTurnPortRequest,
} from "./model-turn";
import type { ModelPreparationPortRequest, ParentPortEvent } from "./ports";
import {
	projectSpeechDeliveryLifecycle,
	projectSpeechDeliveryPortRequest,
	speechDeliveryStateFromTerminal,
	type SpeechDeliveryFact,
	type SpeechDeliveryLifecycleProjection,
	speechDeliveryMachine,
} from "./speech";
import {
	canStartVoiceCapture,
	projectVoiceCaptureLifecycle,
	projectVoiceCapturePortRequest,
	type VoiceCaptureLifecycleProjection,
	voiceCaptureMachine,
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
	proof?: WorkbenchCapabilityProof;
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

export type ModelTurnCorrelation = {
	turnId: string;
	attemptId: string;
};

export type SpeechDeliveryControlRequest = {
	id: string;
	text: string;
	attemptId: string;
	sequence: number;
};

export type VoiceWorkbenchSessionInput = {
	voiceSupported?: boolean;
	speechSupported?: boolean;
};

export type VoiceWorkbenchPortRequests = {
	modelPreparation: ModelPreparationPortRequest | null;
	modelTurn: ReturnType<typeof projectModelTurnPortRequest>;
	voiceCapture: ReturnType<typeof projectVoiceCapturePortRequest>;
	speechDelivery: ReturnType<typeof projectSpeechDeliveryPortRequest>;
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
	turn: WorkbenchTurnFact | null;
};

export type WorkbenchPresentationIntent =
	| { type: "draft-changed"; draft: string }
	| {
			type: "artifact-view-changed";
			view: WorkbenchArtifactView;
	  }
	| { type: "mobile-panel-changed"; panel: WorkbenchPanel }
	| { type: "speech-preference-changed"; enabled: boolean }
	| { type: "replayed" }
	| {
			type: "runtime-preview-selected";
			preview: WorkbenchRuntimePreview;
	  }
	| { type: "turn-started" };

export type WorkbenchAdapterFact = {
	type: "document-committed";
	document: NonNullable<WorkbenchPresentation["documentCommit"]>;
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
	hostCapabilities: {
		voiceSupported: boolean;
		speechSupported: boolean;
	};
	modelPreparationSequence: number;
	portRequests: VoiceWorkbenchPortRequests;
	activeTurnId: string | null;
	lastModelTurnResult: ModelTurnResult | null;
	voiceTranscriptSubmission: VoiceTranscriptCandidate | null;
	speechDeliveryControlSequence: number;
	speechDeliveryControlRequest: SpeechDeliveryControlRequest | null;
	pendingCompletion: CompleteResponseInput | null;
	lastTurnTerminal: ModelTurnTerminalEvent | null;
	childLifecycles: {
		modelTurn: ModelTurnLifecycleProjection | null;
		voiceCapture: VoiceCaptureLifecycleProjection | null;
		speechDelivery: SpeechDeliveryLifecycleProjection | null;
	};
};
export type ModelReadinessEvent =
	{ type: "MODEL_PREPARATION_STARTED" };
export type VoiceCaptureIntentEvent =
	| { type: "VOICE_CAPTURE_START_REQUESTED" }
	| { type: "VOICE_CAPTURE_CANCEL_REQUESTED" }
	| { type: "VOICE_TRANSCRIPT_SUBMIT_REQUESTED" };
export type SpeechDeliveryIntentEvent = {
	type: "SPEECH_DELIVERY_REPLAY_REQUESTED";
};
export type VoiceWorkbenchPrivateEvent =
	| {
			type: "DOCUMENT_COMMITTED";
			document: NonNullable<WorkbenchPresentation["documentCommit"]>;
	  }
	| {
			type: "CAPABILITY_OUTCOME_RECORDED";
			outcome: WorkbenchCapabilityOutcome;
			turnId?: string;
			attemptId?: string;
	  }
	| {
			type: "DOMAIN_POLICY_RECORDED";
			decision: DomainPolicyDecision;
			turnId?: string;
			attemptId?: string;
	  }
	| {
			type: "RUNTIME_MANIFEST_RECORDED";
			manifest: readonly WorkbenchRuntimeManifestEntry[];
			turnId?: string;
			attemptId?: string;
	  }
	| {
			type: "TURN_RECORDED";
			fact: WorkbenchTurnFact;
			turnId?: string;
			attemptId?: string;
	  };
export type VoiceWorkbenchSessionEvent =
	| ConversationAction
	| ModelReadinessEvent
	| ParentPortEvent
	| VoiceCaptureIntentEvent
	| SpeechDeliveryIntentEvent
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
	| {
			available: {
				turn: "idle" | "responding";
				voice: "active";
				speech: "idle" | "delivering";
			};
	  };

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
	turn: null,
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
		case "replayed":
			return {
				...presentation,
				replaySequence: presentation.replaySequence + 1,
			};
		case "runtime-preview-selected":
			return { ...presentation, runtimePreview: update.preview };
		case "turn-started":
			return {
				...presentation,
				capabilityOutcomes: [],
				domainPolicy: null,
				runtimeManifest: [],
				turn: null,
			};
		case "document-committed":
			return { ...presentation, documentCommit: update.document };
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
		default:
			return presentation;
	}
};


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

const isVoiceCaptureIntentEvent = (
	event: VoiceWorkbenchSessionEvent,
): event is VoiceCaptureIntentEvent =>
	event.type === "VOICE_CAPTURE_START_REQUESTED" ||
	event.type === "VOICE_CAPTURE_CANCEL_REQUESTED" ||
	event.type === "VOICE_TRANSCRIPT_SUBMIT_REQUESTED";


const isTurnReadModelEvent = (
	event: VoiceWorkbenchPrivateEvent,
): event is Extract<
	VoiceWorkbenchPrivateEvent,
	{
		type:
			| "CAPABILITY_OUTCOME_RECORDED"
			| "DOMAIN_POLICY_RECORDED"
			| "RUNTIME_MANIFEST_RECORDED"
			| "TURN_RECORDED";
	}
> =>
	event.type === "CAPABILITY_OUTCOME_RECORDED" ||
	event.type === "DOMAIN_POLICY_RECORDED" ||
	event.type === "RUNTIME_MANIFEST_RECORDED" ||
	event.type === "TURN_RECORDED";

const acceptsTurnReadModelEvent = (
	context: VoiceWorkbenchSession,
	event: VoiceWorkbenchPrivateEvent,
): boolean => {
	if (!isTurnReadModelEvent(event)) return true;
	if (!event.turnId || !event.attemptId) {
		return context.childLifecycles.modelTurn === null;
	}
	if (event.turnId !== context.activeTurnId) return false;
	const current = context.childLifecycles.modelTurn;
	if (
		current === null ||
		current.turnId !== event.turnId ||
		current.attemptId !== event.attemptId
	) {
		return false;
	}
	if (current.terminal === null) return true;
	return (
		event.type === "TURN_RECORDED" &&
		current.terminal.type !== "CANCELLED" &&
		current.terminal.type !== "TIMEOUT"
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
	}
};

const applyConversationTransition = (
	context: VoiceWorkbenchSession,
	event: ConversationAction,
): VoiceWorkbenchSession => {
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
			hostCapabilities: context.hostCapabilities,
			modelPreparationSequence: context.modelPreparationSequence,
			portRequests: context.portRequests,
			activeTurnId,
			lastModelTurnResult:
				event.type === "SUBMIT_PROMPT" ? null : context.lastModelTurnResult,
			voiceTranscriptSubmission: context.voiceTranscriptSubmission,
			speechDeliveryControlSequence: context.speechDeliveryControlSequence,
			speechDeliveryControlRequest: context.speechDeliveryControlRequest,
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
};

export type VoiceTranscriptCandidate = {
	attemptId: string;
	text: string;
};

export const selectVoiceTranscriptCandidate = (
	context: Pick<VoiceWorkbenchSession, "childLifecycles">,
): VoiceTranscriptCandidate | null => {
	const lifecycle = context.childLifecycles.voiceCapture;
	if (
		lifecycle?.state !== "transcript" ||
		lifecycle.attemptId === null ||
		lifecycle.fact.type !== "voice-transcript" ||
		!lifecycle.fact.final
	) {
		return null;
	}
	const text = lifecycle.fact.text.trim();
	return text.length > 0 ? { attemptId: lifecycle.attemptId, text } : null;
};



const createSpeechDeliveryControlRequest = (
	speech: { id: string; text: string },
	sequence: number,
): SpeechDeliveryControlRequest => ({
	id: speech.id,
	text: speech.text,
	attemptId: `${speech.id}:${sequence}`,
	sequence,
});

const selectActiveModelTurnInput = (context: VoiceWorkbenchSession) => {
	const fact = context.lastFact;
	if (
		fact?.type !== "prompt-submitted" ||
		fact.turnId !== context.activeTurnId
	) {
		throw new Error("A responding session requires an active prompt fact.");
	}
	return {
		turnId: fact.turnId,
		prompt: { channel: fact.modality, text: fact.text },
	};
};

const sameModelTurnPortRequest = (
	left: VoiceWorkbenchPortRequests["modelTurn"],
	right: VoiceWorkbenchPortRequests["modelTurn"],
): boolean =>
	Boolean(
		left &&
			right &&
			left.type === right.type &&
			left.turnId === right.turnId &&
			left.attemptId === right.attemptId,
	);

const acceptsParentPortEvent = (
	context: VoiceWorkbenchSession,
	event: ParentPortEvent,
): boolean => {
	switch (event.type) {
		case "MODEL_PREPARATION_PORT_RECEIVED":
			return (
				context.portRequests.modelPreparation?.sequence ===
					event.request.sequence &&
				event.receipt.sequence === event.request.sequence
			);
		case "MODEL_TURN_PORT_RECEIVED":
			return (
				sameModelTurnPortRequest(
					context.portRequests.modelTurn,
					event.request,
				) &&
				event.receipt.turnId === event.request.turnId &&
				event.receipt.attemptId === event.request.attemptId
			);
		case "VOICE_CAPTURE_PORT_RECEIVED":
			if (
				event.request.type === "start" &&
				(event.receipt.type === "RESULT" ||
					event.receipt.type === "END" ||
					event.receipt.type === "PERMISSION_DENIED" ||
					event.receipt.type === "FAIL")
			) {
				return (
					event.request.attemptId !== null &&
					event.receipt.attemptId === event.request.attemptId &&
					context.childLifecycles.voiceCapture?.attemptId ===
						event.request.attemptId
				);
			}
			return (
				context.portRequests.voiceCapture?.sequence ===
					event.request.sequence &&
				context.portRequests.voiceCapture.type === event.request.type &&
				event.receipt.attemptId === event.request.attemptId
			);
		case "SPEECH_DELIVERY_PORT_RECEIVED":
			return (
				context.childLifecycles.speechDelivery?.attemptId ===
					event.request.attemptId &&
				context.childLifecycles.speechDelivery.requestSequence ===
					event.request.requestSequence &&
				event.receipt.attemptId === event.request.attemptId
			);
		case "MODEL_TURN_TIMEOUT_REQUESTED":
		case "MODEL_TURN_CANCEL_REQUESTED":
			return (
				context.portRequests.modelTurn?.turnId === event.turnId &&
				context.portRequests.modelTurn.attemptId === event.attemptId
			);
	}
};

const toWorkbenchTurnFact = (result: ModelTurnResult): WorkbenchTurnFact => {
	if (result.accepted) return { type: "accepted", trace: result.trace };
	if (result.reason === "model-failed") {
		return {
			type: "model-failed",
			failureKind: result.failure.kind,
			message: result.failure.message,
			trace: result.trace,
		};
	}
	if (!("command" in result)) {
		return { type: result.reason, trace: result.trace };
	}
	return {
		type: result.reason,
		command: result.command,
		trace: result.trace,
	};
};

const applyModelTurnTerminal = (
	context: VoiceWorkbenchSession,
	terminal: ModelTurnTerminalEvent,
	result: ModelTurnResult | null,
): VoiceWorkbenchSession => {
	const modelTurnLifecycle = context.childLifecycles.modelTurn;
	const childLifecycles = {
		...context.childLifecycles,
		modelTurn: modelTurnLifecycle
			? {
					...modelTurnLifecycle,
					state: modelTurnStateFromTerminal(terminal),
					terminal,
				}
			: null,
	};
	const latestCapability =
		context.presentation.capabilityOutcomes[
			context.presentation.capabilityOutcomes.length - 1
		]?.proof;
	const existingCollision = context.presentation.turn?.collision;
	const turnFact = result
		? {
				...toWorkbenchTurnFact(result),
				...(latestCapability ? { capability: latestCapability } : {}),
				...(existingCollision ? { collision: existingCollision } : {}),
			}
		: null;
	const presentation = result
		? reduceWorkbenchPresentation(context.presentation, {
				channel: "read-model",
				update: { type: "turn-recorded", fact: turnFact as WorkbenchTurnFact },
			})
		: context.presentation;
	if (terminal.type !== "TURN_COMPLETED" || !context.pendingCompletion) {
		return {
			...context,
			childLifecycles,
			presentation,
			lastModelTurnResult: result,
			pendingCompletion: null,
			lastTurnTerminal: terminal,
		};
	}
	const completion = reduceConversationSession(context, {
		type: "COMPLETE_RESPONSE",
		input: context.pendingCompletion,
	});
	if (!completion.accepted) {
		return {
			...context,
			childLifecycles,
			presentation,
			lastModelTurnResult: result,
			pendingCompletion: null,
			lastTurnTerminal: terminal,
		};
	}
	const speech = completion.session.speech;
	const speechDeliveryControlSequence = speech
		? context.speechDeliveryControlSequence + 1
		: context.speechDeliveryControlSequence;
	return {
		...completion.session,
		modelFailure: context.modelFailure,
		presentation,
		hostCapabilities: context.hostCapabilities,
		modelPreparationSequence: context.modelPreparationSequence,
		portRequests: context.portRequests,
		activeTurnId: context.activeTurnId,
		lastModelTurnResult: result,
		voiceTranscriptSubmission: context.voiceTranscriptSubmission,
		speechDeliveryControlSequence,
		speechDeliveryControlRequest: speech
			? createSpeechDeliveryControlRequest(
					speech,
					speechDeliveryControlSequence,
				)
			: context.speechDeliveryControlRequest,
		pendingCompletion: null,
		lastTurnTerminal: terminal,
		childLifecycles: speech
			? { ...childLifecycles, speechDelivery: null }
			: childLifecycles,
	};
};

export const voiceWorkbenchSessionMachine = setup({
	types: {
		context: {} as VoiceWorkbenchSession,
		events: {} as VoiceWorkbenchSessionEvent,
		input: {} as VoiceWorkbenchSessionInput | undefined,
	},
	actors: {
		modelTurn: modelTurnMachine,
		voiceCapture: voiceCaptureMachine,
		speechDelivery: speechDeliveryMachine,
	},
	actions: {
		requestModelPreparation: assign(({ context }) => {
			const sequence = context.modelPreparationSequence + 1;
			return {
				...context,
				modelPreparationSequence: sequence,
				portRequests: {
					...context.portRequests,
					modelPreparation: { type: "prepare-model", sequence },
				},
			};
		}),
		clearModelPreparationRequest: assign(({ context }) => ({
			...context,
			portRequests: { ...context.portRequests, modelPreparation: null },
		})),
		recordModelPreparationFailure: assign(({ context, event }) =>
			event.type === "MODEL_PREPARATION_PORT_RECEIVED" &&
			event.receipt.type === "failed"
				? { ...context, modelFailure: event.receipt.failure }
				: context,
		),
		clearModelTurnPortRequest: assign(({ context }) => ({
			...context,
			portRequests: { ...context.portRequests, modelTurn: null },
		})),
		forwardModelTurnReceipt: sendTo("model-turn", ({ event }) => {
			if (event.type !== "MODEL_TURN_PORT_RECEIVED") {
				throw new Error("Expected a model-turn port receipt.");
			}
			return event.receipt;
		}),
		forwardModelTurnTimeout: sendTo("model-turn", ({ event }) => {
			if (event.type !== "MODEL_TURN_TIMEOUT_REQUESTED") {
				throw new Error("Expected a model-turn timeout request.");
			}
			return { type: "TIMEOUT", turnId: event.turnId };
		}),
		forwardModelTurnCancellation: sendTo("model-turn", ({ event }) => {
			if (event.type !== "MODEL_TURN_CANCEL_REQUESTED") {
				throw new Error("Expected a model-turn cancellation request.");
			}
			return { type: "CANCEL", turnId: event.turnId };
		}),
		forwardVoiceCaptureReceipt: sendTo("voice-capture", ({ event }) => {
			if (event.type !== "VOICE_CAPTURE_PORT_RECEIVED") {
				throw new Error("Expected a voice-capture port receipt.");
			}
			return event.receipt;
		}),
		forwardSpeechDeliveryReceipt: sendTo("speech-delivery", ({ event }) => {
			if (event.type !== "SPEECH_DELIVERY_PORT_RECEIVED") {
				throw new Error("Expected a speech-delivery port receipt.");
			}
			return event.receipt;
		}),
		startVoiceCapture: sendTo("voice-capture", { type: "START" }),
		cancelVoiceCapture: sendTo("voice-capture", { type: "CANCEL" }),
		consumeVoiceTranscript: sendTo("voice-capture", ({ context }) => ({
			type: "CONSUME",
			attemptId:
				selectVoiceTranscriptCandidate(context)?.attemptId ?? "missing-attempt",
		})),
		applyTransition: assign(({ context, event }) => {
			if (!isConversationAction(event)) return context;
			return applyConversationTransition(context, event);
		}),
		stageVoiceTranscriptSubmission: assign(({ context, event }) => ({
			...context,
			voiceTranscriptSubmission:
				event.type === "VOICE_TRANSCRIPT_SUBMIT_REQUESTED"
					? selectVoiceTranscriptCandidate(context)
					: context.voiceTranscriptSubmission,
		})),
		clearVoiceTranscriptSubmission: assign({
			voiceTranscriptSubmission: () => null,
		}),
		requestSpeechDeliveryReplay: assign(({ context, event }) => {
			if (event.type !== "SPEECH_DELIVERY_REPLAY_REQUESTED") return context;
			const speech = context.speech;
			if (!speech) return context;
			const sequence = context.speechDeliveryControlSequence + 1;
			return {
				...context,
				speechDeliveryControlSequence: sequence,
				speechDeliveryControlRequest: createSpeechDeliveryControlRequest(
					speech,
					sequence,
				),
				childLifecycles: {
					...context.childLifecycles,
					speechDelivery: null,
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
				isVoiceCaptureIntentEvent(event) ||
				event.type === "SPEECH_DELIVERY_REPLAY_REQUESTED" ||
				event.type === "MODEL_PREPARATION_STARTED" ||
				event.type === "MODEL_PREPARATION_PORT_RECEIVED" ||
				event.type === "MODEL_TURN_PORT_RECEIVED" ||
				event.type === "VOICE_CAPTURE_PORT_RECEIVED" ||
				event.type === "SPEECH_DELIVERY_PORT_RECEIVED" ||
				event.type === "MODEL_TURN_TIMEOUT_REQUESTED" ||
				event.type === "MODEL_TURN_CANCEL_REQUESTED" ||
				event.type === "PRESENTATION_UPDATED"
			) {
				return context;
			}
			if (!acceptsTurnReadModelEvent(context, event)) return context;
			switch (event.type) {
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
		clearModelFailure: assign({ modelFailure: () => null }),
	},
	guards: {
		parentPortEventAccepted: ({ context, event }) =>
			(event.type === "MODEL_PREPARATION_PORT_RECEIVED" ||
				event.type === "MODEL_TURN_PORT_RECEIVED" ||
				event.type === "VOICE_CAPTURE_PORT_RECEIVED" ||
				event.type === "SPEECH_DELIVERY_PORT_RECEIVED" ||
				event.type === "MODEL_TURN_TIMEOUT_REQUESTED" ||
				event.type === "MODEL_TURN_CANCEL_REQUESTED") &&
			acceptsParentPortEvent(context, event),
		voicePromptReady: ({ context }) =>
			context.activeTurnId !== null &&
			context.lastFact?.type === "prompt-submitted" &&
			context.lastFact.turnId === context.activeTurnId,
		hasPendingSpeechDelivery: ({ context }) =>
			context.speechDeliveryControlRequest !== null,
		transitionAccepted: ({ context, event }) =>
			isConversationAction(event) &&
			reduceConversationSession(context, event).accepted,
		voiceCaptureStartAccepted: ({ context, event }) =>
			event.type === "VOICE_CAPTURE_START_REQUESTED" &&
			canStartVoiceCapture(context.childLifecycles.voiceCapture),
		voiceTranscriptCandidateAccepted: ({ context, event }) => {
			if (event.type !== "VOICE_TRANSCRIPT_SUBMIT_REQUESTED") return false;
			const candidate = selectVoiceTranscriptCandidate(context);
			return Boolean(
				candidate &&
					reduceConversationSession(context, {
						type: "SUBMIT_PROMPT",
						input: { modality: "speech", text: candidate.text },
					}).accepted,
			);
		},
		completionCanStage: ({ context, event }) =>
			event.type === "COMPLETE_RESPONSE" &&
			context.pendingCompletion === null &&
			reduceConversationSession(context, event).accepted,
	},
}).createMachine({
	id: "conversation-session",
	initial: "preparing",
	context: ({ input }) => ({
		...createInitialSession("voice-workbench"),
		modelFailure: null,
		presentation: createInitialPresentation(),
		hostCapabilities: {
			voiceSupported: input?.voiceSupported ?? true,
			speechSupported: input?.speechSupported ?? true,
		},
		modelPreparationSequence: 1,
		portRequests: {
			modelPreparation: { type: "prepare-model", sequence: 1 },
			modelTurn: null,
			voiceCapture: null,
			speechDelivery: null,
		},
		activeTurnId: null,
		lastModelTurnResult: null,
		voiceTranscriptSubmission: null,
		speechDeliveryControlSequence: 0,
		speechDeliveryControlRequest: null,
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
		CAPABILITY_OUTCOME_RECORDED: { actions: "applyPrivateEvent" },
		DOMAIN_POLICY_RECORDED: { actions: "applyPrivateEvent" },
		RUNTIME_MANIFEST_RECORDED: { actions: "applyPrivateEvent" },
		TURN_RECORDED: { actions: "applyPrivateEvent" },
		MODEL_TURN_PORT_RECEIVED: {
			guard: "parentPortEventAccepted",
			actions: "forwardModelTurnReceipt",
		},
		VOICE_CAPTURE_PORT_RECEIVED: {
			guard: "parentPortEventAccepted",
			actions: "forwardVoiceCaptureReceipt",
		},
		SPEECH_DELIVERY_PORT_RECEIVED: {
			guard: "parentPortEventAccepted",
			actions: "forwardSpeechDeliveryReceipt",
		},
		MODEL_TURN_TIMEOUT_REQUESTED: {
			guard: "parentPortEventAccepted",
			actions: "forwardModelTurnTimeout",
		},
		MODEL_TURN_CANCEL_REQUESTED: {
			guard: "parentPortEventAccepted",
			actions: "forwardModelTurnCancellation",
		},
	},
	states: {
		preparing: {
			on: {
				MODEL_PREPARATION_PORT_RECEIVED: [
					{
						guard: ({ context, event }) =>
							event.receipt.type === "available" &&
							acceptsParentPortEvent(context, event),
						target: "available",
						actions: [
							"clearModelFailure",
							"clearModelPreparationRequest",
						],
					},
					{
						guard: ({ context, event }) =>
							event.receipt.type === "failed" &&
							acceptsParentPortEvent(context, event),
						target: "unavailable",
						actions: [
							"recordModelPreparationFailure",
							"clearModelPreparationRequest",
						],
					},
				],
			},
		},
		unavailable: {
				on: {
				MODEL_PREPARATION_STARTED: {
					target: "preparing",
					actions: ["clearModelFailure", "requestModelPreparation"],
				},
			},
		},
		available: {
			type: "parallel",
			on: {
				SET_CHECKLIST_ITEM: { actions: "applyTransition" },
				MODEL_PREPARATION_STARTED: {
					target: "#conversation-session.preparing",
					actions: [
						"clearModelFailure",
						"requestModelPreparation",
						"discardPendingCompletion",
						"clearVoiceTranscriptSubmission",
					],
				},
			},
			states: {
				turn: {
					initial: "idle",
					states: {
						idle: {
							always: {
								guard: "voicePromptReady",
								target: "responding",
							},
							on: {
								RESTORE_ARTIFACT_REVISION: { actions: "applyTransition" },
								SELECT_ARTIFACT: { actions: "applyTransition" },
								VOICE_CAPTURE_START_REQUESTED: {
									guard: "voiceCaptureStartAccepted",
									actions: "startVoiceCapture",
								},
								VOICE_CAPTURE_CANCEL_REQUESTED: {
									actions: "cancelVoiceCapture",
								},
								VOICE_TRANSCRIPT_SUBMIT_REQUESTED: {
									guard: "voiceTranscriptCandidateAccepted",
									actions: [
										"stageVoiceTranscriptSubmission",
										"consumeVoiceTranscript",
									],
								},
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
							exit: ["clearModelTurnPortRequest", "clearActiveTurn"],
							invoke: {
								id: "model-turn",
								src: "modelTurn",
								input: ({ context }) => selectActiveModelTurnInput(context),
								onSnapshot: {
									actions: assign(({ context, event }) => ({
										...context,
										portRequests: {
											...context.portRequests,
											modelTurn: projectModelTurnPortRequest(event.snapshot),
										},
										childLifecycles: {
											...context.childLifecycles,
											modelTurn: projectModelTurnLifecycle(event.snapshot),
										},
									})),
								},
								onDone: {
									target: "idle",
									actions: assign(({ context, event }) =>
										applyModelTurnTerminal(
											context,
											event.output.terminal,
											event.output.result,
										),
									),
								},
							},
							on: {
								CREATE_ARTIFACT: { actions: "applyTransition" },
								REVISE_ARTIFACT: { actions: "applyTransition" },
								COMPLETE_RESPONSE: [
									{
										guard: "completionCanStage",
										actions: "stageCompletion",
									},
									{ actions: "rejectCompletion" },
								],
							},
						},
					},
				},
				voice: {
					initial: "active",
					states: {
						active: {
							invoke: {
								id: "voice-capture",
								src: "voiceCapture",
								input: ({ context }) => ({
									supported: context.hostCapabilities.voiceSupported,
								}),
								onSnapshot: {
									actions: assign(({ context, event }) => {
										const lifecycle = projectVoiceCaptureLifecycle(
											event.snapshot,
										);
										const submission = context.voiceTranscriptSubmission;
										let next: VoiceWorkbenchSession = {
											...context,
											portRequests: {
												...context.portRequests,
												voiceCapture: projectVoiceCapturePortRequest(
													event.snapshot,
												),
											},
											childLifecycles: {
												...context.childLifecycles,
												voiceCapture: lifecycle,
											},
										};
										if (
											event.snapshot.value === "consumed" &&
											submission !== null &&
											submission.attemptId === event.snapshot.context.attemptId &&
											submission.text === event.snapshot.context.transcript.trim()
										) {
											next = applyConversationTransition(next, {
												type: "SUBMIT_PROMPT",
												input: {
													modality: "speech",
													text: submission.text,
												},
											});
											next = { ...next, voiceTranscriptSubmission: null };
										}
										return next;
									}),
								},
							},
						},
					},
				},
				speech: {
					initial: "idle",
					states: {
						idle: {
							always: {
								guard: "hasPendingSpeechDelivery",
								target: "delivering",
							},
							on: {
								SPEECH_DELIVERY_REPLAY_REQUESTED: {
									target: "delivering",
									actions: "requestSpeechDeliveryReplay",
								},
							},
						},
						delivering: {
							invoke: {
								id: "speech-delivery",
								src: "speechDelivery",
								input: ({ context }) => {
									const request = context.speechDeliveryControlRequest;
									if (!request) {
										throw new Error(
											"Speech delivery requires an actor-owned request.",
										);
									}
									return {
										id: request.id,
										text: request.text,
										attemptId: request.attemptId,
										requestSequence: request.sequence,
										supported: context.hostCapabilities.speechSupported,
										muted: !context.presentation.speakResponses,
									};
								},
								onSnapshot: {
									actions: assign(({ context, event }) => ({
										...context,
										portRequests: {
											...context.portRequests,
											speechDelivery:
												projectSpeechDeliveryPortRequest(event.snapshot),
										},
										childLifecycles: {
											...context.childLifecycles,
											speechDelivery:
												projectSpeechDeliveryLifecycle(event.snapshot),
										},
									})),
								},
								onDone: {
									target: "idle",
									actions: assign(({ context, event }) => {
										const speech = context.speech;
										const terminal = event.output.terminal;
										const lifecycle = context.childLifecycles.speechDelivery;
										const acknowledged =
											speech?.status === "pending"
												? reduceConversationSession(context, {
														type: "ACKNOWLEDGE_SPEECH",
														input: { id: speech.id },
													}).session
												: context;
										return {
											...context,
											...acknowledged,
											hostCapabilities: context.hostCapabilities,
											modelFailure: context.modelFailure,
											presentation: context.presentation,
											modelPreparationSequence:
												context.modelPreparationSequence,
											portRequests: {
												...context.portRequests,
												speechDelivery: null,
											},
											childLifecycles: {
												...context.childLifecycles,
												speechDelivery: lifecycle
													? {
															...lifecycle,
															state: speechDeliveryStateFromTerminal(terminal),
															fact: terminal,
															terminal,
														}
													: null,
											},
											speechDeliveryControlRequest: null,
										};
									}),
								},
							},
							on: {
								SPEECH_DELIVERY_REPLAY_REQUESTED: {
									target: "delivering",
									reenter: true,
									actions: "requestSpeechDeliveryReplay",
								},
							},
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
		!snapshot.matches({ available: { turn: "responding" } }) ||
		snapshot.matches("available"),
	hasNoKnownForbiddenState: (snapshot: VoiceWorkbenchSessionSnapshot) =>
		!isVoiceWorkbenchKnownForbiddenStateValue(snapshot.value),
} as const;

export const createVoiceWorkbenchSessionActor = (
	input: VoiceWorkbenchSessionInput = {},
) => createActor(voiceWorkbenchSessionMachine, { input });

export type VoiceWorkbenchSessionActor = ReturnType<
	typeof createVoiceWorkbenchSessionActor
>;

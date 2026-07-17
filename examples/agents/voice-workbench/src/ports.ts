import type { ModelFailureFact } from "./agent-loop";
import type {
	ModelTurnLifecycleEvent,
	ModelTurnPortRequest,
} from "./model-turn";
import type { VoiceWorkbenchPrivateEvent } from "./session";
import type { SpeechDeliveryEvent, SpeechDeliveryPortRequest } from "./speech";
import type { VoiceCaptureEvent, VoiceCapturePortRequest } from "./voice";

export type WorkbenchDisposable = { dispose(): void };

export type ModelPreparationPortRequest = {
	type: "prepare-model";
	sequence: number;
};

export type ModelPreparationPortReceipt =
	| { type: "available"; sequence: number }
	| { type: "failed"; sequence: number; failure: ModelFailureFact };

export type ModelTurnPortReceipt = Extract<
	ModelTurnLifecycleEvent,
	{
		type:
			| "MODEL_RESOLVED"
			| "AUTHORIZATION_RESOLVED"
			| "CAPABILITY_RESOLVED"
			| "PORT_FAILED";
	}
>;

export type ModelTurnPortFact = Extract<
	VoiceWorkbenchPrivateEvent,
	{
		type:
			| "CAPABILITY_OUTCOME_RECORDED"
			| "DOMAIN_POLICY_RECORDED"
			| "RUNTIME_MANIFEST_RECORDED"
			| "TURN_RECORDED";
	}
>;

export type ModelTurnPortResult = {
	receipt: ModelTurnPortReceipt;
	facts?: readonly ModelTurnPortFact[];
};

export type VoiceCapturePortReceipt = Extract<
	VoiceCaptureEvent,
	{
		type: "RESULT" | "END" | "PERMISSION_DENIED" | "FAIL";
	}
>;

export type SpeechDeliveryPortReceipt = Extract<
	SpeechDeliveryEvent,
	{
		type: "QUEUED" | "DELIVERED" | "MUTED" | "UNAVAILABLE" | "FAIL" | "CANCEL";
	}
>;

export type ParentPortEvent =
	| {
			type: "MODEL_PREPARATION_PORT_RECEIVED";
			request: ModelPreparationPortRequest;
			receipt: ModelPreparationPortReceipt;
	  }
	| {
			type: "MODEL_TURN_PORT_RECEIVED";
			request: ModelTurnPortRequest;
			receipt: ModelTurnPortReceipt;
	  }
	| {
			type: "VOICE_CAPTURE_PORT_RECEIVED";
			request: VoiceCapturePortRequest;
			receipt: VoiceCapturePortReceipt;
	  }
	| {
			type: "SPEECH_DELIVERY_PORT_RECEIVED";
			request: SpeechDeliveryPortRequest;
			receipt: SpeechDeliveryPortReceipt;
	  }
	| {
			type: "MODEL_TURN_TIMEOUT_REQUESTED";
			turnId: string;
			attemptId: string;
	  }
	| {
			type: "MODEL_TURN_CANCEL_REQUESTED";
			turnId: string;
			attemptId: string;
	  };

export type ModelPreparationPort = (
	request: ModelPreparationPortRequest,
	options: { signal: AbortSignal },
) => Promise<ModelPreparationPortReceipt>;

export type ModelTurnPortHandler = (
	request: ModelTurnPortRequest,
	options: { signal: AbortSignal },
) => Promise<ModelTurnPortResult>;

/** A parent-owned turn lifetime spans every request-scoped port call. */
export type ModelTurnPortLifecycle = WorkbenchDisposable & {
	startTurn(turnId: string): WorkbenchDisposable;
};

export type ModelTurnPort = ModelTurnPortHandler &
	Partial<ModelTurnPortLifecycle>;

export type VoiceCapturePort = (
	request: VoiceCapturePortRequest,
	emit: (receipt: VoiceCapturePortReceipt) => void,
) => WorkbenchDisposable | void;

export type SpeechDeliveryPort = (
	request: SpeechDeliveryPortRequest,
	emit: (receipt: SpeechDeliveryPortReceipt) => void,
) => WorkbenchDisposable | void;

export type WorkbenchClockPort = {
	setTimeout(callback: () => void, delayMs: number): WorkbenchDisposable;
};

export type VoiceWorkbenchPorts = {
	modelPreparation: ModelPreparationPort;
	modelTurn: ModelTurnPort;
	voiceCapture: VoiceCapturePort;
	speechDelivery: SpeechDeliveryPort;
	clock?: WorkbenchClockPort;
};

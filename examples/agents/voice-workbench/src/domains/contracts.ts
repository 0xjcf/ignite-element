import type { NeutralToolCall } from "ignite-element/tools";
import type { ModelExchange } from "../agent-loop";
import type {
	CapabilityExecutionFact,
	CapabilityOwner,
} from "../capability-federation";

export type DomainPolicyOutcome = "admitted" | "needs-input" | "rejected";

export type DomainPolicyAssumption = {
	id: string;
	label: string;
};

export type DomainPolicyQuestion = {
	id: string;
	prompt: string;
};

export type DomainEvidenceRequirement = {
	id: string;
	label: string;
};

export type DomainPolicyDecision = {
	type: "domain-policy-decision";
	domainId: string;
	domainLabel: string;
	policyId: string;
	policyLabel: string;
	outcome: DomainPolicyOutcome;
	summary: string;
	assumptions: readonly DomainPolicyAssumption[];
	questions: readonly DomainPolicyQuestion[];
	evidenceRequirements: readonly DomainEvidenceRequirement[];
};

export type DomainCompletionAudit =
	| { ok: true }
	| { ok: false; issues: readonly string[] };

export type DomainCompletionAuditInput = {
	prompt: { channel: "text" | "speech"; text: string };
	history: readonly ModelExchange[];
	view: unknown;
};

export type DomainExecutionAuthorization =
	| { authorized: true }
	| {
			authorized: false;
			message: string;
			issues: readonly string[];
	  };

export type DomainExecutionAuthorizationInput = {
	prompt: DomainCompletionAuditInput["prompt"];
	history: readonly ModelExchange[];
	call: NeutralToolCall;
};

export type DomainToolAvailabilityInput = {
	prompt: DomainCompletionAuditInput["prompt"];
	history: readonly ModelExchange[];
	toolName: string;
};

export type DomainArtifactMaterializationInput = {
	prompt: DomainCompletionAuditInput["prompt"];
	history: readonly ModelExchange[];
	view?: unknown;
	call: NeutralToolCall;
};

export type DomainPack = {
	id: string;
	label: string;
	capabilities: readonly CapabilityOwner[];
	modelInstructions: string;
	appliesTo(prompt: string): boolean;
	projectExecution(
		execution: CapabilityExecutionFact,
	): DomainPolicyDecision | null;
	authorizeExecution?(
		input: DomainExecutionAuthorizationInput,
	): DomainExecutionAuthorization | null;
	isToolAvailable?(input: DomainToolAvailabilityInput): boolean | null;
	materializeArtifact?(
		input: DomainArtifactMaterializationInput,
	): NeutralToolCall | null;
	auditCompletion(input: DomainCompletionAuditInput): DomainCompletionAudit;
};

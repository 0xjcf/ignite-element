import type { NeutralManifest } from "ignite-element/tools";
import { normalizeModelIssues } from "../agent-loop";
import type { CapabilityExecutionFact } from "../capability-federation";
import type {
	DomainCompletionAudit,
	DomainCompletionAuditInput,
	DomainExecutionAuthorizationInput,
	DomainPack,
	DomainPolicyDecision,
	DomainToolAvailabilityInput,
} from "./contracts";

export type DomainRegistry = {
	packs: readonly DomainPack[];
	capabilities: DomainPack["capabilities"];
	modelInstructions: string;
	projectExecution(
		execution: CapabilityExecutionFact,
	): DomainPolicyDecision | null;
	authorizeExecution(
		input: DomainExecutionAuthorizationInput,
	): CapabilityExecutionFact | null;
	manifestForExecution(
		input: Omit<DomainToolAvailabilityInput, "toolName"> & {
			manifest: NeutralManifest;
		},
	): NeutralManifest;
	auditCompletion(input: DomainCompletionAuditInput): DomainCompletionAudit;
};

const boundedMessage = (message: string): string =>
	message.trim().slice(0, 300) ||
	"The configured domain policy denied execution.";

export const createDomainRegistry = (
	packs: readonly DomainPack[],
): DomainRegistry => ({
	packs,
	capabilities: packs.flatMap((pack) => pack.capabilities),
	modelInstructions: packs
		.map((pack) => pack.modelInstructions.trim())
		.filter(Boolean)
		.join("\n"),
	projectExecution: (execution) => {
		for (const pack of packs) {
			const decision = pack.projectExecution(execution);
			if (decision) return decision;
		}
		return null;
	},
	authorizeExecution: (input) => {
		for (const pack of packs) {
			if (!pack.appliesTo(input.prompt.text)) continue;
			const authorization = pack.authorizeExecution?.(input);
			if (!authorization || authorization.authorized) continue;
			return {
				type: "validation",
				ownerId: pack.id,
				toolName: input.call.name,
				message: boundedMessage(authorization.message),
				issues: normalizeModelIssues(authorization.issues),
				reason: "domain-policy-denied",
				actorRejected: true,
			};
		}
		return null;
	},
	manifestForExecution: ({ prompt, history, manifest }) =>
		manifest.filter((tool) =>
			packs.every((pack) => {
				if (!pack.appliesTo(prompt.text)) return true;
				return (
					pack.isToolAvailable?.({
						prompt,
						history,
						toolName: tool.name,
					}) !== false
				);
			}),
		),
	auditCompletion: (input) => {
		const issues = packs.flatMap((pack) => {
			if (!pack.appliesTo(input.prompt.text)) return [];
			const audit = pack.auditCompletion(input);
			return audit.ok ? [] : audit.issues;
		});
		const bounded = normalizeModelIssues(issues);
		return bounded.length === 0 ? { ok: true } : { ok: false, issues: bounded };
	},
});

export const emptyDomainRegistry = createDomainRegistry([]);

import { normalizeModelIssues } from "../agent-loop";
import type { CapabilityExecutionFact } from "../capability-federation";
import type {
	DomainCompletionAudit,
	DomainCompletionAuditInput,
	DomainPack,
	DomainPolicyDecision,
} from "./contracts";

export type DomainRegistry = {
	packs: readonly DomainPack[];
	capabilities: DomainPack["capabilities"];
	modelInstructions: string;
	projectExecution(
		execution: CapabilityExecutionFact,
	): DomainPolicyDecision | null;
	auditCompletion(input: DomainCompletionAuditInput): DomainCompletionAudit;
};

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

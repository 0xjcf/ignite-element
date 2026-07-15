import { type ModelExchange, normalizeModelIssues } from "../../agent-loop";
import type {
	DomainCompletionAudit,
	DomainCompletionAuditInput,
} from "../contracts";
import type { ProductPricingDecision } from "./policy";
import { projectProductPricingDecision } from "./projection";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const key = (value: unknown): string =>
	typeof value === "string"
		? value
				.trim()
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "")
		: "";

const decisionFromHistory = (
	history: readonly ModelExchange[],
): { decision: ProductPricingDecision; exchangeIndex: number } | null => {
	for (
		let exchangeIndex = history.length - 1;
		exchangeIndex >= 0;
		exchangeIndex -= 1
	) {
		const exchange = history[exchangeIndex];
		if (!exchange) continue;
		for (
			let resultIndex = exchange.results.length - 1;
			resultIndex >= 0;
			resultIndex -= 1
		) {
			const result = exchange.results[resultIndex];
			if (!result) continue;
			if (
				result.command !== "prepareProductPricing" ||
				result.ownerId !== "product-pricing" ||
				result.status !== "capability-success" ||
				!isRecord(result.fact)
			) {
				continue;
			}
			const decision = projectProductPricingDecision(result.fact.decision);
			if (decision) return { decision, exchangeIndex };
		}
	}
	return null;
};

const activeNodes = (view: unknown): Record<string, unknown>[] => {
	if (!isRecord(view) || !Array.isArray(view.artifacts)) return [];
	const artifacts = view.artifacts.filter(isRecord);
	const artifact =
		(typeof view.activeArtifactId === "string"
			? artifacts.find((entry) => entry.id === view.activeArtifactId)
			: undefined) ?? artifacts[artifacts.length - 1];
	return artifact && Array.isArray(artifact.nodes)
		? artifact.nodes.filter(isRecord)
		: [];
};

const visibleArtifactText = (
	nodes: readonly Record<string, unknown>[],
): string => JSON.stringify(nodes).toLowerCase();

const checklistSubjects = (
	nodes: readonly Record<string, unknown>[],
): string[] =>
	nodes.flatMap((node) =>
		node.kind === "checklist" && Array.isArray(node.items)
			? node.items
					.filter(isRecord)
					.flatMap((item) =>
						typeof item.label === "string" ? [key(item.label)] : [],
					)
			: [],
	);

type ProductPriceEvidence = {
	subject: string;
	product: string | null;
	size: string | null;
};

const priceEvidenceAfter = (
	history: readonly ModelExchange[],
	exchangeIndex: number,
): ProductPriceEvidence[] =>
	history.slice(exchangeIndex + 1).flatMap((exchange) =>
		exchange.results.flatMap((result) => {
			if (
				result.command !== "priceProducts" ||
				result.status !== "capability-success" ||
				!isRecord(result.fact) ||
				!Array.isArray(result.fact.searches)
			) {
				return [];
			}
			return result.fact.searches.filter(isRecord).flatMap((search) => {
				if (typeof search.subject !== "string") return [];
				const selection = isRecord(search.selection) ? search.selection : null;
				return [
					{
						subject: key(search.subject),
						product:
							selection && typeof selection.product === "string"
								? selection.product.trim()
								: null,
						size:
							selection && typeof selection.size === "string"
								? selection.size.trim()
								: null,
					},
				];
			});
		}),
	);

export const auditProductPricingCompletion = (
	input: DomainCompletionAuditInput,
): DomainCompletionAudit => {
	const observed = decisionFromHistory(input.history);
	if (!observed) {
		return {
			ok: false,
			issues: [
				"Call prepareProductPricing and observe its policy decision before completing this pricing request.",
			],
		};
	}

	const { decision, exchangeIndex } = observed;
	const nodes = activeNodes(input.view);
	const visible = visibleArtifactText(nodes);
	const issues: string[] = [];
	const laterPriceLookup = input.history
		.slice(exchangeIndex + 1)
		.some((exchange) =>
			exchange.results.some(
				(result) =>
					(result.command === "searchWeb" ||
						result.command === "priceProducts") &&
					result.status === "capability-success",
			),
		);

	if (decision.outcome !== "admitted") {
		if (laterPriceLookup) {
			issues.push(
				"Do not resolve prices after a needs-input or rejected policy decision.",
			);
		}
		for (const question of decision.questions) {
			if (!visible.includes(question.prompt.toLowerCase())) {
				issues.push(`Show the policy question: ${question.prompt}`);
			}
		}
		for (const issue of decision.issues) {
			if (!visible.includes(issue.toLowerCase())) {
				issues.push(`Show the policy issue: ${issue}`);
			}
		}
		for (const assumption of decision.assumptions) {
			if (!visible.includes(assumption.label.toLowerCase())) {
				issues.push(`Disclose this policy assumption: ${assumption.label}`);
			}
		}
		return issues.length === 0
			? { ok: true }
			: { ok: false, issues: normalizeModelIssues(issues) };
	}

	for (const assumption of decision.assumptions) {
		if (!visible.includes(assumption.label.toLowerCase())) {
			issues.push(`Disclose this policy assumption: ${assumption.label}`);
		}
	}
	const requestedKeys = decision.request.items.map((item) => key(item.subject));
	const priceEvidence = priceEvidenceAfter(input.history, exchangeIndex);
	const searchedKeys = priceEvidence.map((evidence) => evidence.subject);
	if (
		requestedKeys.length !== searchedKeys.length ||
		requestedKeys.some((subject) => !searchedKeys.includes(subject))
	) {
		issues.push(
			"Resolve matching provider evidence for every admitted product-pricing subject.",
		);
	}
	for (const evidence of priceEvidence) {
		if (
			!evidence.product ||
			!evidence.size ||
			!visible.includes(evidence.product.toLowerCase()) ||
			!visible.includes(evidence.size.toLowerCase())
		) {
			issues.push(
				`${evidence.subject}: disclose the provider-selected product and size evidence.`,
			);
		}
	}
	const listedKeys = checklistSubjects(nodes);
	for (const item of decision.request.items) {
		const itemKey = key(item.subject);
		if (listedKeys.filter((candidate) => candidate === itemKey).length !== 1) {
			issues.push(
				`${item.subject}: include the requested subject exactly once in the shopping checklist.`,
			);
		}
	}

	return issues.length === 0
		? { ok: true }
		: { ok: false, issues: normalizeModelIssues(issues) };
};

import type { CapabilityExecutionFact } from "../../capability-federation";
import type {
	ProductPricingDecision,
	ProductPricingRequestItem,
} from "./policy";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const boundedText = (value: unknown, maximum = 160): string | null =>
	typeof value === "string" && value.trim()
		? value.trim().slice(0, maximum)
		: null;

const boundedEntries = <T>(
	value: unknown,
	project: (entry: Record<string, unknown>) => T | null,
): T[] =>
	Array.isArray(value)
		? value
				.filter(isRecord)
				.slice(0, 8)
				.flatMap((entry) => {
					const projected = project(entry);
					return projected ? [projected] : [];
				})
		: [];

export const projectProductPricingDecision = (
	value: unknown,
): ProductPricingDecision | null => {
	if (!isRecord(value)) return null;
	if (
		value.type !== "domain-policy-decision" ||
		value.domainId !== "product-pricing" ||
		value.policyId !== "representative-product-selection" ||
		(value.outcome !== "admitted" &&
			value.outcome !== "needs-input" &&
			value.outcome !== "rejected") ||
		!isRecord(value.request)
	) {
		return null;
	}
	const domainLabel = boundedText(value.domainLabel);
	const policyLabel = boundedText(value.policyLabel);
	const summary = boundedText(value.summary);
	if (!domainLabel || !policyLabel || !summary) return null;
	const items = boundedEntries<ProductPricingRequestItem>(
		value.request.items,
		(entry) => {
			const subject = boundedText(entry.subject);
			if (!subject) return null;
			return {
				subject,
				product: boundedText(entry.product),
				size: boundedText(entry.size),
			};
		},
	);
	return {
		type: "domain-policy-decision",
		domainId: "product-pricing",
		domainLabel,
		policyId: "representative-product-selection",
		policyLabel,
		outcome: value.outcome,
		summary,
		assumptions: boundedEntries(value.assumptions, (entry) => {
			const id = boundedText(entry.id, 80);
			const label = boundedText(entry.label);
			return id && label ? { id, label } : null;
		}),
		questions: boundedEntries(value.questions, (entry) => {
			const id = boundedText(entry.id, 80);
			const prompt = boundedText(entry.prompt);
			return id && prompt ? { id, prompt } : null;
		}),
		evidenceRequirements: boundedEntries(
			value.evidenceRequirements,
			(entry) => {
				const id = boundedText(entry.id, 80);
				const label = boundedText(entry.label);
				return id && label ? { id, label } : null;
			},
		),
		request: {
			retailer: boundedText(value.request.retailer),
			location: boundedText(value.request.location),
			items,
		},
		issues: Array.isArray(value.issues)
			? value.issues
					.map((issue) => boundedText(issue))
					.filter((issue): issue is string => issue !== null)
					.slice(0, 8)
			: [],
		searchQueries: boundedEntries(value.searchQueries, (entry) => {
			const subject = boundedText(entry.subject);
			const query = boundedText(entry.query);
			return subject && query ? { subject, query } : null;
		}),
	};
};

export const projectProductPricingExecution = (
	execution: CapabilityExecutionFact,
): ProductPricingDecision | null => {
	if (
		execution.type !== "success" ||
		execution.ownerId !== "product-pricing" ||
		execution.toolName !== "prepareProductPricing" ||
		!isRecord(execution.data)
	) {
		return null;
	}
	return projectProductPricingDecision(execution.data.decision);
};

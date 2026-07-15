import type { ModelExchange } from "../../agent-loop";
import type {
	DomainExecutionAuthorization,
	DomainExecutionAuthorizationInput,
	DomainToolAvailabilityInput,
} from "../contracts";
import type { ProductPricingDecision } from "./policy";
import { projectProductPricingDecision } from "./projection";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const stableTextIdentity = (value: unknown): string | null =>
	typeof value === "string" && value.trim()
		? value.trim().replace(/\s+/g, " ")
		: null;

const decisionFromHistory = (
	history: readonly ModelExchange[],
): ProductPricingDecision | null => {
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
			if (
				!result ||
				result.command !== "prepareProductPricing" ||
				result.ownerId !== "product-pricing" ||
				result.status !== "capability-success" ||
				!isRecord(result.fact)
			) {
				continue;
			}
			const decision = projectProductPricingDecision(result.fact.decision);
			if (decision) return decision;
		}
	}
	return null;
};

const searchPairs = (
	input: unknown,
): readonly { subject: string; query: string }[] | null => {
	if (!isRecord(input) || !Array.isArray(input.queries)) return null;
	const pairs: { subject: string; query: string }[] = [];
	for (const query of input.queries) {
		if (!isRecord(query)) return null;
		const subject = stableTextIdentity(query.subject);
		const queryText = stableTextIdentity(query.query);
		if (!subject || !queryText) return null;
		pairs.push({ subject, query: queryText });
	}
	return pairs.length > 0 ? pairs : null;
};

const pairKey = (pair: { subject: string; query: string }): string =>
	JSON.stringify([
		stableTextIdentity(pair.subject),
		stableTextIdentity(pair.query),
	]);

export const authorizeProductPricingExecution = ({
	history,
	call,
}: DomainExecutionAuthorizationInput): DomainExecutionAuthorization | null => {
	if (call.name !== "searchWeb") return null;
	const decision = decisionFromHistory(history);
	if (!decision) {
		return {
			authorized: false,
			message: "The product-pricing policy must run before web research.",
			issues: [
				"Call prepareProductPricing and observe its decision before calling searchWeb.",
			],
		};
	}
	if (decision.outcome === "needs-input") {
		return {
			authorized: false,
			message:
				"The product-pricing policy requires clarification before web research.",
			issues: decision.questions.map((question) => question.prompt),
		};
	}
	if (decision.outcome === "rejected") {
		return {
			authorized: false,
			message: "The product-pricing policy rejected web research.",
			issues: decision.issues,
		};
	}

	const proposed = searchPairs(call.input);
	const admittedKeys = new Set(decision.searchQueries.map(pairKey));
	const proposedKeys = proposed?.map(pairKey) ?? [];
	if (
		!proposed ||
		new Set(proposedKeys).size !== proposedKeys.length ||
		proposedKeys.some((key) => !admittedKeys.has(key))
	) {
		return {
			authorized: false,
			message:
				"The proposed web research is outside the admitted product-pricing scope.",
			issues: [
				"Call searchWeb with only exact admitted subject and query pairs from prepareProductPricing.",
			],
		};
	}

	return { authorized: true };
};

export const isProductPricingToolAvailable = ({
	history,
	toolName,
}: DomainToolAvailabilityInput): boolean | null => {
	if (toolName !== "searchWeb") return null;
	const decision = decisionFromHistory(history);
	return !(
		decision?.outcome === "needs-input" || decision?.outcome === "rejected"
	);
};

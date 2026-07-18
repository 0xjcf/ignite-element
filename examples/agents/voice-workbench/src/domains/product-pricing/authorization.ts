import type { ModelExchange } from "../../agent-loop";
import type {
	DomainExecutionAuthorization,
	DomainExecutionAuthorizationInput,
	DomainToolAvailabilityInput,
} from "../contracts";
import type { ProductPricingDecision } from "./policy";
import {
	PRODUCT_PRICE_OWNER_ID,
	PRODUCT_PRICE_TOOL_NAME,
	readProductPriceInput,
} from "./price-capability";
import { projectProductPricingDecision } from "./projection";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const stableTextIdentity = (value: string): string =>
	value.trim().replace(/\s+/g, " ");

const decisionFromHistory = (
	history: readonly ModelExchange[],
): {
	decision: ProductPricingDecision;
	exchangeIndex: number;
	decisionCount: number;
} | null => {
	let latest: {
		decision: ProductPricingDecision;
		exchangeIndex: number;
	} | null = null;
	let decisionCount = 0;
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
			if (!decision) continue;
			decisionCount += 1;
			latest ??= { decision, exchangeIndex };
		}
	}
	return latest ? { ...latest, decisionCount } : null;
};

const hasAttemptedPricing = (
	history: readonly ModelExchange[],
	exchangeIndex: number,
): boolean =>
	history
		.slice(exchangeIndex + 1)
		.some((exchange) =>
			exchange.results.some(
				(result) =>
					result.command === PRODUCT_PRICE_TOOL_NAME &&
					result.ownerId === PRODUCT_PRICE_OWNER_ID,
			),
		);

const requestIdentity = (value: {
	retailer: string;
	location: string;
	items: readonly { subject: string }[];
}): string =>
	JSON.stringify({
		retailer: stableTextIdentity(value.retailer),
		location: stableTextIdentity(value.location),
		items: value.items.map((item) => ({
			subject: stableTextIdentity(item.subject),
		})),
	});

const admittedRequestIdentity = (
	decision: ProductPricingDecision,
): string | null => {
	if (!decision.request.retailer || !decision.request.location) return null;
	return requestIdentity({
		retailer: decision.request.retailer,
		location: decision.request.location,
		items: decision.request.items,
	});
};

export const authorizeProductPricingExecution = ({
	history,
	call,
}: DomainExecutionAuthorizationInput): DomainExecutionAuthorization | null => {
	if (call.name === "searchWeb") {
		return {
			authorized: false,
			message:
				"Product-pricing research must use the configured price provider.",
			issues: [
				"Call prepareProductPricing, then priceProducts with the complete admitted request. The provider derives discovery queries.",
			],
		};
	}
	if (call.name !== PRODUCT_PRICE_TOOL_NAME) return null;
	const observed = decisionFromHistory(history);
	if (!observed) {
		return {
			authorized: false,
			message: "The product-pricing policy must run before price lookup.",
			issues: [
				"Call prepareProductPricing and observe its decision before calling priceProducts.",
			],
		};
	}
	const { decision, exchangeIndex } = observed;
	if (decision.outcome === "needs-input") {
		return {
			authorized: false,
			message:
				"The product-pricing policy requires clarification before price lookup.",
			issues: decision.questions.map((question) => question.prompt),
		};
	}
	if (decision.outcome === "rejected") {
		return {
			authorized: false,
			message: "The product-pricing policy rejected price lookup.",
			issues: decision.issues,
		};
	}
	if (hasAttemptedPricing(history, exchangeIndex)) {
		return {
			authorized: false,
			message:
				"The admitted product-pricing request has already been attempted.",
			issues: [
				"Use the recorded priceProducts result instead of repeating lookup.",
			],
		};
	}

	const proposed = readProductPriceInput(call.input);
	const admitted = admittedRequestIdentity(decision);
	if (
		!proposed.ok ||
		!admitted ||
		requestIdentity(proposed.value) !== admitted
	) {
		return {
			authorized: false,
			message: "The proposed price lookup is outside the admitted scope.",
			issues: [
				"Call priceProducts once with the exact retailer, location, and ordered subjects from prepareProductPricing.",
			],
		};
	}

	return { authorized: true };
};

export const isProductPricingToolAvailable = ({
	history,
	toolName,
}: DomainToolAvailabilityInput): boolean | null => {
	const observed = decisionFromHistory(history);
	if (toolName === "prepareProductPricing") {
		return (
			observed === null ||
			(observed.decisionCount === 1 && observed.decision.outcome !== "admitted")
		);
	}
	if (toolName === "searchWeb") return false;
	if (toolName !== PRODUCT_PRICE_TOOL_NAME) return null;
	return (
		observed?.decision.outcome === "admitted" &&
		!hasAttemptedPricing(history, observed.exchangeIndex)
	);
};

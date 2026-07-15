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

const hasCompletedPricing = (history: readonly ModelExchange[]): boolean =>
	history.some((exchange) =>
		exchange.results.some(
			(result) =>
				result.command === PRODUCT_PRICE_TOOL_NAME &&
				result.ownerId === PRODUCT_PRICE_OWNER_ID &&
				result.status === "capability-success",
		),
	);

const requestIdentity = (value: {
	retailer: string;
	location: string;
	items: readonly { subject: string; product: string; size: string }[];
}): string =>
	JSON.stringify({
		retailer: stableTextIdentity(value.retailer),
		location: stableTextIdentity(value.location),
		items: value.items.map((item) => ({
			subject: stableTextIdentity(item.subject),
			product: stableTextIdentity(item.product),
			size: stableTextIdentity(item.size),
		})),
	});

const admittedRequestIdentity = (
	decision: ProductPricingDecision,
): string | null => {
	if (!decision.request.retailer || !decision.request.location) return null;
	const items = decision.request.items.flatMap((item) =>
		item.product && item.size
			? [{ subject: item.subject, product: item.product, size: item.size }]
			: [],
	);
	if (items.length !== decision.request.items.length) return null;
	return requestIdentity({
		retailer: decision.request.retailer,
		location: decision.request.location,
		items,
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
	const decision = decisionFromHistory(history);
	if (!decision) {
		return {
			authorized: false,
			message: "The product-pricing policy must run before price lookup.",
			issues: [
				"Call prepareProductPricing and observe its decision before calling priceProducts.",
			],
		};
	}
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
	if (hasCompletedPricing(history)) {
		return {
			authorized: false,
			message: "The admitted product-pricing request has already completed.",
			issues: [
				"Use the accepted priceProducts facts instead of repeating lookup.",
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
				"Call priceProducts once with the exact retailer, location, subject, product, and size values from prepareProductPricing.",
			],
		};
	}

	return { authorized: true };
};

export const isProductPricingToolAvailable = ({
	history,
	toolName,
}: DomainToolAvailabilityInput): boolean | null => {
	const decision = decisionFromHistory(history);
	if (toolName === "prepareProductPricing") return decision === null;
	if (toolName === "searchWeb") return false;
	if (toolName !== PRODUCT_PRICE_TOOL_NAME) return null;
	return decision?.outcome === "admitted" && !hasCompletedPricing(history);
};

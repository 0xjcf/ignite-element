import type { CapabilityOwner } from "../../capability-federation";
import type { DomainPack } from "../contracts";
import {
	authorizeProductPricingExecution,
	isProductPricingToolAvailable,
} from "./authorization";
import { createProductPricingCapability } from "./capability";
import { auditProductPricingCompletion } from "./completion-audit";
import { createProductPriceCapability } from "./price-capability";
import { projectProductPricingExecution } from "./projection";

const PRICE_SIGNAL = /\b(?:price|prices|pricing|cost|costs)\b/i;
const PRODUCT_SIGNAL =
	/\b(?:shopping|grocery|groceries|retailer|store|market|whole\s+foods|bread|breads|egg|eggs|milk|coffee)\b/i;

export const productPricingAppliesTo = (prompt: string): boolean =>
	PRICE_SIGNAL.test(prompt) && PRODUCT_SIGNAL.test(prompt);

export type ProductPricingDomainPackOptions = {
	priceCapability?: CapabilityOwner;
};

export const createProductPricingDomainPack = (
	options: ProductPricingDomainPackOptions = {},
): DomainPack => ({
	id: "product-pricing",
	label: "Product pricing",
	capabilities: [
		createProductPricingCapability(),
		options.priceCapability ?? createProductPriceCapability(),
	],
	modelInstructions:
		"For product-pricing requests, call prepareProductPricing first with retailer, location, and subject-only items. Treat admitted, needs-input, and rejected as configured policy facts. A policy success is not price evidence or execution authorization. After an admitted decision, call priceProducts exactly once with the complete retailer, location, and ordered subject-only items from the latest decision; the provider owns product and size selection. Never invent a web-search query or interpret snippets as prices. Disclose each provider-selected product and size with its sourced or explicitly unverified price evidence. For needs-input, materialize the questions and assumptions without price lookup; after one rejected or needs-input decision, repair prepareProductPricing at most once.",
	appliesTo: productPricingAppliesTo,
	projectExecution: projectProductPricingExecution,
	authorizeExecution: authorizeProductPricingExecution,
	isToolAvailable: isProductPricingToolAvailable,
	auditCompletion: auditProductPricingCompletion,
});

export {
	auditProductPricingCompletion,
	authorizeProductPricingExecution,
	createProductPriceCapability,
	createProductPricingCapability,
	isProductPricingToolAvailable,
	projectProductPricingExecution,
};
export type {
	ProductPricingDecision,
	ProductPricingInput,
	ProductPricingSelectedItem,
} from "./policy";

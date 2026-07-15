import type { DomainPack } from "../contracts";
import {
	authorizeProductPricingExecution,
	isProductPricingToolAvailable,
} from "./authorization";
import { createProductPricingCapability } from "./capability";
import { auditProductPricingCompletion } from "./completion-audit";
import { projectProductPricingExecution } from "./projection";

const PRICE_SIGNAL = /\b(?:price|prices|pricing|cost|costs)\b/i;
const PRODUCT_SIGNAL =
	/\b(?:shopping|grocery|groceries|retailer|store|market|whole\s+foods|bread|breads|egg|eggs|milk|coffee)\b/i;

export const productPricingAppliesTo = (prompt: string): boolean =>
	PRICE_SIGNAL.test(prompt) && PRODUCT_SIGNAL.test(prompt);

export const createProductPricingDomainPack = (): DomainPack => ({
	id: "product-pricing",
	label: "Product pricing",
	capabilities: [createProductPricingCapability()],
	modelInstructions:
		"For product-pricing requests, call prepareProductPricing before any web research. Treat admitted, needs-input, and rejected as configured policy facts. A policy success is not price evidence or execution authorization. Search only the exact admitted searchQueries; for needs-input, materialize the questions and assumptions without searching; for rejected, explain the bounded issues without searching.",
	appliesTo: productPricingAppliesTo,
	projectExecution: projectProductPricingExecution,
	authorizeExecution: authorizeProductPricingExecution,
	isToolAvailable: isProductPricingToolAvailable,
	auditCompletion: auditProductPricingCompletion,
});

export {
	auditProductPricingCompletion,
	authorizeProductPricingExecution,
	createProductPricingCapability,
	isProductPricingToolAvailable,
	projectProductPricingExecution,
};
export type {
	ProductPricingDecision,
	ProductPricingInput,
	ProductPricingSelectedItem,
} from "./policy";

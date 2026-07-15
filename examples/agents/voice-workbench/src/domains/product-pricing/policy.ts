import type {
	DomainEvidenceRequirement,
	DomainPolicyAssumption,
	DomainPolicyDecision,
	DomainPolicyQuestion,
} from "../contracts";

export type ProductPricingInput = {
	retailer?: string;
	location?: string;
	items: readonly {
		subject: string;
	}[];
};

export type ProductPricingSelectedItem = {
	subject: string;
	product: string;
	size: string;
};

export type ProductPricingRequestItem = {
	subject: string;
};

export type ProductPricingDecision = DomainPolicyDecision & {
	domainId: "product-pricing";
	policyId: "category-pricing-scope";
	request: {
		retailer: string | null;
		location: string | null;
		items: readonly ProductPricingRequestItem[];
	};
	issues: readonly string[];
};

const EVIDENCE_REQUIREMENTS: readonly DomainEvidenceRequirement[] = [
	{
		id: "subject-identity",
		label: "Preserve each requested subject identity.",
	},
	{
		id: "selection-disclosure",
		label:
			"Disclose the provider-selected product and size evidence for every subject.",
	},
	{
		id: "price-status-source",
		label: "Materialize exact Subject, Price, Status, and Source facts.",
	},
	{
		id: "verified-scope",
		label: "Distinguish requested retailer scope from verified evidence scope.",
	},
	{
		id: "sourced-numerics",
		label: "Use only sourced numeric prices in totals and charts.",
	},
];

const text = (value: string | undefined): string | null => {
	const trimmed = value?.trim() ?? "";
	return trimmed ? trimmed : null;
};

const subjectKey = (value: string): string => {
	const normalized = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "");
	return normalized.endsWith("s") ? normalized.slice(0, -1) : normalized;
};

export const evaluateProductPricingPolicy = (
	input: ProductPricingInput,
): ProductPricingDecision => {
	const retailer = text(input.retailer);
	const location = text(input.location);
	const issues: string[] = [];
	if (input.items.length === 0) {
		issues.push("Product pricing requires at least one item.");
	}
	if (input.items.length > 8) {
		issues.push("Product pricing accepts at most 8 items per decision.");
	}
	if (input.items.some((item) => !text(item.subject))) {
		issues.push("Every product-pricing item requires a non-empty subject.");
	}
	const keys = input.items.map((item) => subjectKey(item.subject));
	if (keys.some((key, index) => key && keys.indexOf(key) !== index)) {
		issues.push("Product-pricing subjects must be unique.");
	}

	const assumptions: DomainPolicyAssumption[] = [];
	const questions: DomainPolicyQuestion[] = [];
	if (!retailer) {
		questions.push({
			id: "retailer",
			prompt: "Which retailer should price this list?",
		});
	}
	if (!location) {
		questions.push({
			id: "location",
			prompt: "Which retailer location should be used for pricing?",
		});
	}

	const requestItems = input.items.map(
		(item): ProductPricingRequestItem => ({ subject: text(item.subject) ?? "" }),
	);

	const outcome =
		issues.length > 0
			? "rejected"
			: questions.length > 0
				? "needs-input"
				: "admitted";
	return {
		type: "domain-policy-decision",
		domainId: "product-pricing",
		domainLabel: "Product pricing",
		policyId: "category-pricing-scope",
		policyLabel: "Category pricing scope",
		outcome,
		summary:
			outcome === "admitted"
				? `Pricing scope admitted for ${requestItems.length} ${requestItems.length === 1 ? "item" : "items"}.`
				: outcome === "needs-input"
					? "Pricing research is paused until the missing scope is clarified."
					: issues.join(" "),
		assumptions,
		questions,
		evidenceRequirements: EVIDENCE_REQUIREMENTS,
		request: { retailer, location, items: requestItems },
		issues,
	};
};

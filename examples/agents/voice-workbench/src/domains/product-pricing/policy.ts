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
		product?: string;
		size?: string;
	}[];
};

export type ProductPricingSelectedItem = {
	subject: string;
	product: string;
	size: string;
};

export type ProductPricingRequestItem = {
	subject: string;
	product: string | null;
	size: string | null;
};

export type ProductPricingDecision = DomainPolicyDecision & {
	domainId: "product-pricing";
	policyId: "representative-product-selection";
	request: {
		retailer: string | null;
		location: string | null;
		items: readonly ProductPricingRequestItem[];
	};
	issues: readonly string[];
	searchQueries: readonly { subject: string; query: string }[];
};

const REPRESENTATIVE_DEFAULTS: Readonly<
	Record<string, Omit<ProductPricingSelectedItem, "subject">>
> = {
	bread: { product: "standard sandwich bread", size: "20 oz loaf" },
	egg: { product: "large Grade A eggs", size: "12 count" },
	milk: { product: "whole milk", size: "1 gallon" },
};

const EVIDENCE_REQUIREMENTS: readonly DomainEvidenceRequirement[] = [
	{
		id: "subject-identity",
		label: "Preserve each requested subject identity.",
	},
	{
		id: "selection-disclosure",
		label: "Disclose the selected product and size for every subject.",
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

const questionId = (subject: string, field: "product" | "size"): string =>
	`${subjectKey(subject) || "item"}-${field}`;

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

	const requestItems = input.items.map((item): ProductPricingRequestItem => {
		const subject = text(item.subject) ?? "";
		const defaults = REPRESENTATIVE_DEFAULTS[subjectKey(subject)];
		let product = text(item.product);
		let size = text(item.size);
		const defaulted: string[] = [];
		if (!product && defaults) {
			product = defaults.product;
			defaulted.push(defaults.product);
		}
		if (!size && defaults) {
			size = defaults.size;
			defaulted.push(defaults.size);
		}
		if (defaulted.length > 0 && subject) {
			assumptions.push({
				id: `${subjectKey(subject)}-representative-selection`,
				label: `${subject} uses representative default: ${defaulted.join(" · ")}.`,
			});
		}
		if (!product && subject) {
			questions.push({
				id: questionId(subject, "product"),
				prompt: `Which product should be used for ${subject}?`,
			});
		}
		if (!size && subject) {
			questions.push({
				id: questionId(subject, "size"),
				prompt: `Which size should be used for ${subject}?`,
			});
		}
		return { subject, product, size };
	});

	const outcome =
		issues.length > 0
			? "rejected"
			: questions.length > 0
				? "needs-input"
				: "admitted";
	const searchQueries =
		outcome === "admitted" && retailer && location
			? requestItems.map((item) => ({
					subject: item.subject,
					query: `${retailer} ${location} ${item.product} ${item.size} price`,
				}))
			: [];

	return {
		type: "domain-policy-decision",
		domainId: "product-pricing",
		domainLabel: "Product pricing",
		policyId: "representative-product-selection",
		policyLabel: "Representative product selection",
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
		searchQueries,
	};
};

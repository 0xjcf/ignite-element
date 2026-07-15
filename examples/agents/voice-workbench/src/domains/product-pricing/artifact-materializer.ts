import type { NeutralToolCall } from "ignite-element/tools";
import type { ModelExchange, ModelToolFeedback } from "../../agent-loop";
import type { DomainArtifactMaterializationInput } from "../contracts";
import type { ProductPricingDecision } from "./policy";
import { projectProductPricingDecision } from "./projection";

const POLICY_OWNER_ID = "product-pricing";
const POLICY_TOOL_NAME = "prepareProductPricing";
const PRICE_OWNER_ID = "product-pricing-price";
const PRICE_TOOL_NAME = "priceProducts";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const exactText = (value: unknown, maximum: number): string | null => {
	if (typeof value !== "string" || value !== value.trim()) return null;
	return value && value.length <= maximum ? value : null;
};

const subjectKey = (value: string): string =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "");

const safeSourceUrl = (value: unknown): string | null | undefined => {
	if (value === null) return null;
	const source = exactText(value, 2_048);
	if (!source) return undefined;
	try {
		const url = new URL(source);
		return url.protocol === "https:" || url.protocol === "http:"
			? source
			: undefined;
	} catch {
		return undefined;
	}
};

type ProductSelection = {
	product: string;
	size: string;
};

type ProductEvidence = {
	subject: string;
	selection: ProductSelection | null;
	price: number | null;
	status: "sourced" | "unverified";
	source: string | null;
};

export const productSelectionDisclosure = (
	subject: string,
	selection: ProductSelection | null,
): string =>
	selection
		? `${subject}: provider-selected product ${selection.product}; size ${selection.size}.`
		: `${subject}: no provider-selected product.`;

const validAdmittedDecision = (decision: ProductPricingDecision): boolean => {
	if (
		decision.outcome !== "admitted" ||
		!decision.request.retailer ||
		!decision.request.location ||
		decision.request.items.length < 1 ||
		decision.request.items.length > 8
	) {
		return false;
	}
	const subjects = decision.request.items.map((item) => item.subject);
	const keys = subjects.map(subjectKey);
	return (
		subjects.every((subject) => exactText(subject, 120) !== null) &&
		keys.every(Boolean) &&
		new Set(keys).size === keys.length
	);
};

const hasCompleteDecisionRequest = (value: unknown): boolean => {
	if (!isRecord(value) || !isRecord(value.request)) return false;
	if (
		exactText(value.request.retailer, 120) === null ||
		exactText(value.request.location, 120) === null ||
		!Array.isArray(value.request.items) ||
		value.request.items.length < 1 ||
		value.request.items.length > 8
	) {
		return false;
	}
	return value.request.items.every(
		(item) =>
			isRecord(item) &&
			exactText(item.subject, 120) !== null &&
			Object.keys(item).every((field) => field === "subject"),
	);
};

const latestPolicyDecision = (
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
			if (
				!result ||
				result.command !== POLICY_TOOL_NAME ||
				result.ownerId !== POLICY_OWNER_ID
			) {
				continue;
			}
			if (result.status !== "capability-success" || !isRecord(result.fact)) {
				return null;
			}
			if (!hasCompleteDecisionRequest(result.fact.decision)) return null;
			const decision = projectProductPricingDecision(result.fact.decision);
			return decision && validAdmittedDecision(decision)
				? { decision, exchangeIndex }
				: null;
		}
	}
	return null;
};

const readSelection = (value: unknown): ProductSelection | null | undefined => {
	if (value === undefined) return null;
	if (!isRecord(value)) return undefined;
	const product = exactText(value.product, 160);
	const size = exactText(value.size, 80);
	return product && size ? { product, size } : undefined;
};

const readEvidence = (value: unknown): ProductEvidence | null => {
	if (!isRecord(value) || !isRecord(value.price)) return null;
	const subject = exactText(value.subject, 120);
	const selection = readSelection(value.selection);
	const source = safeSourceUrl(value.price.sourceUrl);
	if (!subject || selection === undefined || source === undefined) return null;
	if (
		value.price.status === "sourced" &&
		typeof value.price.amount === "number" &&
		Number.isFinite(value.price.amount) &&
		value.price.amount > 0 &&
		source !== null
	) {
		return {
			subject,
			selection,
			price: value.price.amount,
			status: "sourced",
			source,
		};
	}
	if (value.price.status === "unverified" && value.price.amount === null) {
		return {
			subject,
			selection,
			price: null,
			status: "unverified",
			source,
		};
	}
	return null;
};

const providerPriceResultAfter = (
	history: readonly ModelExchange[],
	exchangeIndex: number,
): ModelToolFeedback | null => {
	const attempts = history
		.slice(exchangeIndex + 1)
		.flatMap((exchange) =>
			exchange.results.filter(
				(result) =>
					result.command === PRICE_TOOL_NAME &&
					result.ownerId === PRICE_OWNER_ID,
			),
		);
	return attempts.length === 1 ? (attempts[0] ?? null) : null;
};

const evidenceForDecision = (
	history: readonly ModelExchange[],
	decision: ProductPricingDecision,
	exchangeIndex: number,
): ProductEvidence[] | null => {
	const result = providerPriceResultAfter(history, exchangeIndex);
	if (
		!result ||
		result.status !== "capability-success" ||
		!isRecord(result.fact) ||
		!Array.isArray(result.fact.searches) ||
		result.fact.searches.length !== decision.request.items.length
	) {
		return null;
	}
	const evidence = result.fact.searches.map(readEvidence);
	if (evidence.some((entry) => entry === null)) return null;
	const observed = evidence as ProductEvidence[];
	const observedKeys = observed.map((entry) => subjectKey(entry.subject));
	const expectedKeys = decision.request.items.map((item) =>
		subjectKey(item.subject),
	);
	if (
		new Set(observedKeys).size !== observedKeys.length ||
		expectedKeys.some((expected, index) => expected !== observedKeys[index])
	) {
		return null;
	}
	return observed;
};

const isArtifactEnvelope = (call: NeutralToolCall): boolean => {
	if (
		(call.name !== "createArtifact" && call.name !== "reviseArtifact") ||
		!isRecord(call.input) ||
		!Array.isArray(call.input.nodes) ||
		call.input.nodes.length === 0
	) {
		return false;
	}
	if (call.name === "createArtifact") {
		return exactText(call.input.id, 160) !== null;
	}
	return (
		exactText(call.input.artifactId, 160) !== null &&
		exactText(call.input.expectedRevision, 80) !== null
	);
};

const canonicalNodes = (
	decision: ProductPricingDecision,
	evidence: readonly ProductEvidence[],
): Record<string, unknown>[] => [
	{
		kind: "checklist",
		items: decision.request.items.map((item) => ({
			label: item.subject,
			checked: false,
		})),
	},
	{
		kind: "text",
		text: evidence
			.map((entry, index) =>
				productSelectionDisclosure(
					decision.request.items[index]?.subject ?? entry.subject,
					entry.selection,
				),
			)
			.join("\n"),
	},
	{
		kind: "table",
		columns: [
			{ label: "Subject" },
			{ label: "Price" },
			{ label: "Status" },
			{ label: "Source" },
		],
		rows: evidence.map((entry, index) => ({
			cells: [
				decision.request.items[index]?.subject ?? entry.subject,
				entry.price,
				entry.status,
				entry.source,
			],
		})),
	},
];

export const materializeProductPricingArtifact = ({
	history,
	call,
}: DomainArtifactMaterializationInput): NeutralToolCall | null => {
	if (!isArtifactEnvelope(call) || !isRecord(call.input)) return null;
	const observed = latestPolicyDecision(history);
	if (!observed) return null;
	const evidence = evidenceForDecision(
		history,
		observed.decision,
		observed.exchangeIndex,
	);
	if (!evidence) return null;
	return {
		...call,
		input: {
			...call.input,
			nodes: canonicalNodes(observed.decision, evidence),
		},
	};
};

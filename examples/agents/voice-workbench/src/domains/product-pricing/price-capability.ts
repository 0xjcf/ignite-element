import type { NeutralManifest, NeutralToolCall } from "ignite-element/tools";
import type {
	CapabilityExecutionFact,
	CapabilityOwner,
} from "../../capability-federation";
import {
	readSourcedSearchCapabilityFact,
	type WebSearchFact,
} from "../../web-search-capability";
export type ProductPriceInput = {
	retailer: string;
	location: string;
	items: { subject: string }[];
};

type FetchLike = (
	input: RequestInfo | URL,
	init?: RequestInit,
) => Promise<Response>;

export type ProductPriceCapabilityOptions = {
	endpoint?: string;
	fetch?: FetchLike;
	timeoutMs?: number;
};

export const PRODUCT_PRICE_TOOL_NAME = "priceProducts";
export const PRODUCT_PRICE_OWNER_ID = "product-pricing-price";
export const PRODUCT_PRICE_REASON_CODES = [
	"candidate-ambiguous",
	"candidate-low-confidence",
	"product-not-found",
	"offer-unavailable",
	"provider-response-invalid",
	"provider-unavailable",
] as const;
export type ProductPriceReasonCode =
	(typeof PRODUCT_PRICE_REASON_CODES)[number];

export const isProductPriceReasonCode = (
	value: unknown,
): value is ProductPriceReasonCode =>
	typeof value === "string" &&
	(PRODUCT_PRICE_REASON_CODES as readonly string[]).includes(value);

const manifest: NeutralManifest = [
	{
		name: PRODUCT_PRICE_TOOL_NAME,
		description:
			"Resolve the complete product-pricing scope admitted by prepareProductPricing. Pass the exact retailer, location, and ordered subjects from that decision. The provider owns product selection and discovery and returns sourced or explicitly unverified prices.",
		inputSchema: {
			type: "object",
			properties: {
				retailer: { type: "string", minLength: 1, maxLength: 120 },
				location: { type: "string", minLength: 1, maxLength: 120 },
				items: {
					type: "array",
					minItems: 1,
					maxItems: 8,
					items: {
						type: "object",
						properties: {
							subject: { type: "string", minLength: 1, maxLength: 120 },
						},
						required: ["subject"],
						additionalProperties: false,
					},
				},
			},
			required: ["retailer", "location", "items"],
			additionalProperties: false,
		},
		gated: false,
	},
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const subjectKey = (value: string): string =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "");

const bounded = (value: unknown, maximum: number): string | null => {
	const text = typeof value === "string" ? value.trim() : "";
	return text && text.length <= maximum ? text : null;
};

const safeUrl = (value: unknown): string | null => {
	const text = bounded(value, 2_048);
	if (!text) return null;
	try {
		const url = new URL(text);
		return url.protocol === "https:" || url.protocol === "http:" ? text : null;
	} catch {
		return null;
	}
};

const readPrice = (value: unknown): Record<string, unknown> | null => {
	if (!isRecord(value)) return null;
	if (value.status === "sourced") {
		const display = bounded(value.display, 40);
		const sourceUrl = safeUrl(value.sourceUrl);
		return typeof value.amount === "number" &&
			Number.isFinite(value.amount) &&
			value.amount > 0 &&
			display &&
			sourceUrl
			? { status: "sourced", amount: value.amount, display, sourceUrl }
			: null;
	}
	if (value.status !== "unverified" || value.amount !== null) return null;
	const reason = bounded(value.reason, 240);
	const reasonCode = isProductPriceReasonCode(value.reasonCode)
		? value.reasonCode
		: null;
	const sourceUrl = value.sourceUrl === null ? null : safeUrl(value.sourceUrl);
	return reasonCode && reason && (value.sourceUrl === null || sourceUrl)
		? { status: "unverified", amount: null, sourceUrl, reasonCode, reason }
		: null;
};

const readSelection = (value: unknown): Record<string, string> | null => {
	if (!isRecord(value)) return null;
	const asin = bounded(value.asin, 10);
	const product = bounded(value.product, 160);
	const size = bounded(value.size, 80);
	const rankingPolicy = bounded(value.rankingPolicy, 80);
	return asin && /^B[A-Z0-9]{9}$/.test(asin) && product && size && rankingPolicy
		? { asin, product, size, rankingPolicy }
		: null;
};

const readDiscoveryReceipt = (
	value: unknown,
): Record<string, string> | null => {
	if (!isRecord(value)) return null;
	const cache = ["hit", "miss", "coalesced"].includes(String(value.cache))
		? String(value.cache)
		: null;
	const native = [
		"hit",
		"miss",
		"schema-drift",
		"transport-error",
		"coalesced",
		"not-needed",
	].includes(String(value.native))
		? String(value.native)
		: null;
	const brave = [
		"not-needed",
		"not-configured",
		"not-eligible",
		"attempted-success",
		"attempted-miss",
		"attempted-failure",
		"coalesced",
	].includes(String(value.brave))
		? String(value.brave)
		: null;
	return cache && native && brave ? { cache, native, brave } : null;
};

const readProductPricingCapabilityFact = (
	value: unknown,
	expectedSubjects: readonly string[],
): CapabilityExecutionFact | null => {
	const generic = readSourcedSearchCapabilityFact(value);
	if (!generic || generic.type !== "success") return generic;
	if (
		!isRecord(value) ||
		!isRecord(value.data) ||
		!Array.isArray(value.data.searches)
	) {
		return null;
	}
	if (!isRecord(generic.data) || !Array.isArray(generic.data.searches))
		return null;
	const sanitized = generic.data.searches as WebSearchFact["searches"];
	if (
		value.data.searches.length !== expectedSubjects.length ||
		sanitized.length !== expectedSubjects.length
	) {
		return null;
	}
	const searches = value.data.searches.flatMap((candidate, index) => {
		if (!isRecord(candidate)) return [];
		const price = readPrice(candidate.price);
		const receipt = readDiscoveryReceipt(candidate.receipt);
		const selection =
			candidate.selection === undefined
				? undefined
				: readSelection(candidate.selection);
		const base = sanitized[index];
		if (
			!price ||
			!receipt ||
			!base ||
			(candidate.selection !== undefined && !selection)
		) {
			return [];
		}
		return [{ ...base, price, ...(selection ? { selection } : {}), receipt }];
	});
	const subjects = searches.map((search) => subjectKey(search.subject));
	const expected = expectedSubjects.map(subjectKey);
	if (
		searches.length !== expected.length ||
		new Set(subjects).size !== subjects.length ||
		expected.some((subject, index) => subjects[index] !== subject)
	) {
		return null;
	}
	return { ...generic, data: { searches } };
};

const requiredText = (
	value: unknown,
	path: string,
	maximum: number,
	issues: string[],
): string => {
	const text = typeof value === "string" ? value.trim() : "";
	if (!text) issues.push(`${path}: expected a non-empty string`);
	else if (text.length > maximum) {
		issues.push(`${path}: expected at most ${maximum} characters`);
	}
	return text;
};

export const readProductPriceInput = (
	value: unknown,
): { ok: true; value: ProductPriceInput } | { ok: false; issues: string[] } => {
	if (!isRecord(value)) {
		return { ok: false, issues: ["input: expected an object"] };
	}
	const issues: string[] = [];
	const retailer = requiredText(value.retailer, "retailer", 120, issues);
	const location = requiredText(value.location, "location", 120, issues);
	const items = Array.isArray(value.items)
		? value.items.slice(0, 8).map((candidate, index) => {
				if (!isRecord(candidate)) {
					issues.push(`items.${index}: expected an object`);
					return { subject: "" };
				}
				for (const field of ["product", "size"] as const) {
					if (field in candidate) {
						issues.push(`items.${index}.${field}: field is not accepted`);
					}
				}
				return {
					subject: requiredText(
						candidate.subject,
						`items.${index}.subject`,
						120,
						issues,
					),
				};
			})
		: [];
	if (
		!Array.isArray(value.items) ||
		value.items.length < 1 ||
		value.items.length > 8
	) {
		issues.push("items: expected between 1 and 8 items");
	}
	const keys = items.map((item) =>
		item.subject.toLowerCase().replace(/[^a-z0-9]+/g, ""),
	);
	if (keys.some((key, index) => key && keys.indexOf(key) !== index)) {
		issues.push("items: subjects must be unique");
	}
	return issues.length > 0
		? { ok: false, issues }
		: { ok: true, value: { retailer, location, items } };
};

const failed = (
	type: "unavailable" | "validation" | "timeout" | "provider-failure",
	message: string,
	extra: { issues?: readonly string[]; status?: number } = {},
): CapabilityExecutionFact => ({
	type,
	ownerId: PRODUCT_PRICE_OWNER_ID,
	toolName: PRODUCT_PRICE_TOOL_NAME,
	message,
	...extra,
});

export const createProductPriceCapability = (
	options: ProductPriceCapabilityOptions = {},
): CapabilityOwner => ({
	id: PRODUCT_PRICE_OWNER_ID,
	manifest,
	run: async (call: NeutralToolCall): Promise<CapabilityExecutionFact> => {
		if (call.name !== PRODUCT_PRICE_TOOL_NAME) {
			return failed(
				"unavailable",
				"The product-price provider does not own this tool.",
			);
		}
		const input = readProductPriceInput(call.input);
		if (!input.ok) {
			return failed("validation", "The product-price input is invalid.", {
				issues: input.issues,
			});
		}
		const fetcher = options.fetch ?? globalThis.fetch;
		if (typeof fetcher !== "function") {
			return failed(
				"unavailable",
				"This environment cannot reach product pricing.",
			);
		}
		const controller = new AbortController();
		const timeout = setTimeout(
			() => controller.abort(),
			options.timeoutMs ?? 20_000,
		);
		try {
			const response = await fetcher(
				options.endpoint ?? "/api/capabilities/product-pricing",
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(input.value),
					signal: controller.signal,
				},
			);
			if (!response.ok) {
				return failed(
					"provider-failure",
					"Product pricing rejected the request.",
					{
						status: response.status,
					},
				);
			}
			const payload: unknown = await response.json().catch(() => null);
			const fact = readProductPricingCapabilityFact(
				payload,
				input.value.items.map((item) => item.subject),
			);
			if (
				!fact ||
				fact.ownerId !== PRODUCT_PRICE_OWNER_ID ||
				fact.toolName !== PRODUCT_PRICE_TOOL_NAME
			) {
				return failed(
					"provider-failure",
					"Product pricing returned an invalid response.",
				);
			}
			return fact;
		} catch {
			return controller.signal.aborted
				? failed("timeout", "Product pricing timed out.")
				: failed("provider-failure", "Product pricing could not be reached.");
		} finally {
			clearTimeout(timeout);
			controller.abort();
		}
	},
});

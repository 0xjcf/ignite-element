import type { NeutralManifest, NeutralToolCall } from "ignite-element/tools";
import type {
	CapabilityExecutionFact,
	CapabilityOwner,
} from "../../capability-federation";
import { readSourcedSearchCapabilityFact } from "../../web-search-capability";
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

const hasExplicitProductPrices = (
	value: unknown,
	expectedSubjects: readonly string[],
): boolean => {
	if (!isRecord(value)) return false;
	if (value.type !== "success") return true;
	if (!isRecord(value.data) || !Array.isArray(value.data.searches))
		return false;
	const subjects = value.data.searches.flatMap((search) =>
		isRecord(search) &&
		typeof search.subject === "string" &&
		isRecord(search.price)
			? [subjectKey(search.subject)]
			: [],
	);
	const expected = expectedSubjects.map(subjectKey);
	return (
		subjects.length === expected.length &&
		new Set(subjects).size === subjects.length &&
		expected.every((subject) => subjects.includes(subject))
	);
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
			const fact = readSourcedSearchCapabilityFact(payload);
			if (
				!hasExplicitProductPrices(
					payload,
					input.value.items.map((item) => item.subject),
				) ||
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

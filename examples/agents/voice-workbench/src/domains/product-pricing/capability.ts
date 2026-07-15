import type { CapabilityOwner } from "../../capability-federation";
import {
	evaluateProductPricingPolicy,
	type ProductPricingInput,
} from "./policy";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const parseInput = (
	value: unknown,
):
	| { ok: true; input: ProductPricingInput }
	| { ok: false; issues: string[] } => {
	if (!isRecord(value)) {
		return { ok: false, issues: ["Input must be an object."] };
	}
	const issues: string[] = [];
	for (const field of ["retailer", "location"] as const) {
		if (value[field] !== undefined && typeof value[field] !== "string") {
			issues.push(`${field} must be a string when provided.`);
		}
	}
	if (!Array.isArray(value.items)) {
		issues.push("items must be an array.");
		return { ok: false, issues };
	}
	const items: ProductPricingInput["items"] = value.items.flatMap(
		(item, index) => {
			if (!isRecord(item)) {
				issues.push(`items[${index}] must be an object.`);
				return [];
			}
			if (typeof item.subject !== "string") {
				issues.push(`items[${index}].subject must be a string.`);
				return [];
			}
			for (const field of ["product", "size"] as const) {
				if (item[field] !== undefined && typeof item[field] !== "string") {
					issues.push(`items[${index}].${field} must be a string.`);
				}
			}
			return [
				{
					subject: item.subject,
					...(typeof item.product === "string"
						? { product: item.product }
						: {}),
					...(typeof item.size === "string" ? { size: item.size } : {}),
				},
			];
		},
	);
	return issues.length > 0
		? { ok: false, issues }
		: {
				ok: true,
				input: {
					...(typeof value.retailer === "string"
						? { retailer: value.retailer }
						: {}),
					...(typeof value.location === "string"
						? { location: value.location }
						: {}),
					items,
				},
			};
};

export const createProductPricingCapability = (): CapabilityOwner => ({
	id: "product-pricing",
	manifest: [
		{
			name: "prepareProductPricing",
			description:
				"Apply the configured product-selection and evidence policy before researching retailer prices.",
			inputSchema: {
				type: "object",
				properties: {
					retailer: { type: "string" },
					location: { type: "string" },
					items: {
						type: "array",
						items: {
							type: "object",
							properties: {
								subject: { type: "string" },
								product: { type: "string" },
								size: { type: "string" },
							},
							required: ["subject"],
						},
					},
				},
				required: ["items"],
				additionalProperties: false,
			},
			gated: false,
		},
	],
	run: async (call) => {
		if (call.name !== "prepareProductPricing") {
			return {
				type: "unavailable",
				ownerId: "product-pricing",
				toolName: call.name,
				message: "The product-pricing capability does not own this tool.",
			};
		}
		const parsed = parseInput(call.input);
		if (!parsed.ok) {
			return {
				type: "validation",
				ownerId: "product-pricing",
				toolName: call.name,
				message: "The product-pricing policy input is invalid.",
				issues: parsed.issues,
			};
		}
		return {
			type: "success",
			ownerId: "product-pricing",
			toolName: call.name,
			data: { decision: evaluateProductPricingPolicy(parsed.input) },
			receipt: { provider: "local-domain-policy" },
		};
	},
});

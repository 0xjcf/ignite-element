import { describe, expect, it } from "vitest";
import type { CapabilityExecutionFact } from "../../capability-federation";
import { createProductPricingCapability } from "./capability";
import { projectProductPricingExecution } from "./projection";

describe("product-pricing capability", () => {
	it("returns local policy decisions as success facts for every valid outcome", async () => {
		const capability = createProductPricingCapability();
		const fact = await capability.run({
			name: "prepareProductPricing",
			input: {
				retailer: "Whole Foods",
				location: "Sarasota",
				items: [{ subject: "Bread" }],
			},
		});

		expect(fact).toMatchObject({
			type: "success",
			ownerId: "product-pricing",
			toolName: "prepareProductPricing",
			data: { decision: { outcome: "admitted" } },
			receipt: { provider: "local-domain-policy" },
		});
		expect(projectProductPricingExecution(fact)).toMatchObject({
			domainId: "product-pricing",
			outcome: "admitted",
		});
	});

	it("returns validation facts for malformed tool input", async () => {
		const capability = createProductPricingCapability();
		await expect(
			capability.run({
				name: "prepareProductPricing",
				input: { retailer: 42, items: "bread" },
			}),
		).resolves.toMatchObject({
			type: "validation",
			issues: expect.arrayContaining([
				expect.stringContaining("retailer"),
				expect.stringContaining("items"),
			]),
		});
	});

	it("rejects model-authored product and size selections", async () => {
		const capability = createProductPricingCapability();
		await expect(
			capability.run({
				name: "prepareProductPricing",
				input: {
					retailer: "Whole Foods",
					location: "Sarasota",
					items: [
						{
							subject: "Bread",
							product: "A model-selected loaf",
							size: "24 oz",
						},
					],
				},
			}),
		).resolves.toMatchObject({
			type: "validation",
			issues: expect.arrayContaining([
				expect.stringContaining("items[0].product is not accepted"),
				expect.stringContaining("items[0].size is not accepted"),
			]),
		});
	});

	it("projects only the bounded fact from the matching owner and tool", () => {
		const wrongOwner: CapabilityExecutionFact = {
			type: "success",
			ownerId: "another-domain",
			toolName: "prepareProductPricing",
			data: { decision: { type: "domain-policy-decision" } },
			receipt: { provider: "local-domain-policy" },
		};

		expect(projectProductPricingExecution(wrongOwner)).toBeNull();
	});
});

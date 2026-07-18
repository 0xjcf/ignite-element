import { describe, expect, it } from "vitest";
import { evaluateProductPricingPolicy } from "./policy";

describe("product-pricing policy", () => {
	it("admits ordered subject-only grocery categories without representative defaults", () => {
		const decision = evaluateProductPricingPolicy({
			retailer: "Whole Foods",
			location: "Sarasota",
			items: [{ subject: "Bread" }, { subject: "Eggs" }, { subject: "Milk" }],
		});

		expect(decision).toMatchObject({
			type: "domain-policy-decision",
			domainId: "product-pricing",
			policyId: "category-pricing-scope",
			outcome: "admitted",
			request: {
				retailer: "Whole Foods",
				location: "Sarasota",
				items: [{ subject: "Bread" }, { subject: "Eggs" }, { subject: "Milk" }],
			},
		});
		expect(decision.assumptions).toEqual([]);
	});

	it("asks deterministic questions only when retailer scope is underspecified", () => {
		const decision = evaluateProductPricingPolicy({
			items: [{ subject: "Coffee" }],
		});

		expect(decision.outcome).toBe("needs-input");
		expect(decision.questions).toEqual([
			{
				id: "retailer",
				prompt: "Which retailer should price this list?",
			},
			{
				id: "location",
				prompt: "Which retailer location should be used for pricing?",
			},
		]);
	});

	it.each([
		{
			name: "empty items",
			input: { retailer: "Market", location: "Sarasota", items: [] },
			issue: "at least one item",
		},
		{
			name: "blank subject",
			input: {
				retailer: "Market",
				location: "Sarasota",
				items: [{ subject: " " }],
			},
			issue: "non-empty subject",
		},
		{
			name: "duplicate subjects",
			input: {
				retailer: "Market",
				location: "Sarasota",
				items: [{ subject: "Egg" }, { subject: "eggs" }],
			},
			issue: "unique",
		},
		{
			name: "too many items",
			input: {
				retailer: "Market",
				location: "Sarasota",
				items: Array.from({ length: 9 }, (_, index) => ({
					subject: `Item ${index}`,
				})),
			},
			issue: "at most 8",
		},
	])("rejects $name", ({ input, issue }) => {
		const decision = evaluateProductPricingPolicy(input);

		expect(decision.outcome).toBe("rejected");
		expect(decision.issues.join(" ")).toContain(issue);
	});
});

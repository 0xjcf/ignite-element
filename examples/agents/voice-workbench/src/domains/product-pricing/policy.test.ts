import { describe, expect, it } from "vitest";
import { evaluateProductPricingPolicy } from "./policy";

describe("product-pricing policy", () => {
	it("admits known grocery subjects with explicit representative assumptions", () => {
		const decision = evaluateProductPricingPolicy({
			retailer: "Whole Foods",
			location: "Sarasota",
			items: [{ subject: "Bread" }, { subject: "Eggs" }, { subject: "Milk" }],
		});

		expect(decision).toMatchObject({
			type: "domain-policy-decision",
			domainId: "product-pricing",
			policyId: "representative-product-selection",
			outcome: "admitted",
			request: {
				retailer: "Whole Foods",
				location: "Sarasota",
				items: [
					{
						subject: "Bread",
						product: "standard sandwich bread",
						size: "20 oz loaf",
					},
					{
						subject: "Eggs",
						product: "large Grade A eggs",
						size: "12 count",
					},
					{
						subject: "Milk",
						product: "whole milk",
						size: "1 gallon",
					},
				],
			},
		});
		expect(decision.assumptions).toHaveLength(3);
		expect(decision.assumptions[0]?.label).toContain(
			"standard sandwich bread · 20 oz loaf",
		);
		expect(decision.searchQueries).toEqual([
			{
				subject: "Bread",
				query: "Whole Foods Sarasota standard sandwich bread 20 oz loaf price",
			},
			{
				subject: "Eggs",
				query: "Whole Foods Sarasota large Grade A eggs 12 count price",
			},
			{
				subject: "Milk",
				query: "Whole Foods Sarasota whole milk 1 gallon price",
			},
		]);
	});

	it("asks deterministic questions when scope or an unknown product is underspecified", () => {
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
			{
				id: "coffee-product",
				prompt: "Which product should be used for Coffee?",
			},
			{
				id: "coffee-size",
				prompt: "Which size should be used for Coffee?",
			},
		]);
		expect(decision.searchQueries).toEqual([]);
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
					product: `Product ${index}`,
					size: "1 each",
				})),
			},
			issue: "at most 8",
		},
	])("rejects $name", ({ input, issue }) => {
		const decision = evaluateProductPricingPolicy(input);

		expect(decision.outcome).toBe("rejected");
		expect(decision.issues.join(" ")).toContain(issue);
		expect(decision.searchQueries).toEqual([]);
	});
});

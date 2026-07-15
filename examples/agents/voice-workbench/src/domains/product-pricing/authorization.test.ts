import { describe, expect, it } from "vitest";
import type { ModelExchange } from "../../agent-loop";
import {
	authorizeProductPricingExecution,
	isProductPricingToolAvailable,
} from "./authorization";
import { evaluateProductPricingPolicy } from "./policy";

const decision = evaluateProductPricingPolicy({
	retailer: "Whole Foods",
	location: "Sarasota",
	items: [{ subject: "Bread" }, { subject: "Eggs" }, { subject: "Milk" }],
});

const history: ModelExchange[] = [
	{
		calls: [
			{
				id: "policy",
				command: "prepareProductPricing",
				input: decision.request,
			},
		],
		results: [
			{
				id: "policy",
				command: "prepareProductPricing",
				ownerId: "product-pricing",
				status: "capability-success",
				fact: { decision },
				view: { artifacts: [] },
				events: [],
			},
		],
	},
];

const admittedInput = {
	retailer: "Whole Foods",
	location: "Sarasota",
	items: decision.request.items.map((item) => ({
		subject: item.subject,
	})),
};

const authorize = (input: unknown, callName = "priceProducts") =>
	authorizeProductPricingExecution({
		prompt: {
			channel: "text",
			text: "create a shopping list with prices from wholefoods sarasota for breads, eggs, and milk",
		},
		history,
		call: { name: callName, input },
	});

describe("product-pricing execution authorization", () => {
	it("requires the complete exact admitted request", () => {
		expect(
			authorize({ ...admittedInput, items: admittedInput.items.slice(0, 1) }),
		).toMatchObject({
			authorized: false,
			issues: expect.arrayContaining([
				expect.stringContaining("exact retailer, location, and ordered subjects"),
			]),
		});
	});

	it("accepts the complete request with stable whitespace identity", () => {
		expect(
			authorize({
				retailer: "  Whole   Foods ",
				location: " Sarasota ",
				items: admittedInput.items.map((item) => ({
					subject: ` ${item.subject} `,
				})),
			}),
		).toEqual({ authorized: true });
	});

	it("denies generic search and hides provider tools at deterministic lifecycle boundaries", () => {
		expect(authorize({ queries: [] }, "searchWeb")).toMatchObject({
			authorized: false,
			issues: expect.arrayContaining([
				expect.stringContaining("provider derives discovery queries"),
			]),
		});
		expect(
			isProductPricingToolAvailable({
				prompt: { channel: "text", text: "prices for bread" },
				history,
				toolName: "searchWeb",
			}),
		).toBe(false);
		expect(
			isProductPricingToolAvailable({
				prompt: { channel: "text", text: "prices for bread" },
				history,
				toolName: "priceProducts",
			}),
		).toBe(true);
	});

	it.each(["needs-input", "rejected"] as const)(
		"offers exactly one repair after a %s decision and lets the repair supersede it",
		(firstOutcome) => {
			const first = evaluateProductPricingPolicy(
				firstOutcome === "needs-input"
					? { retailer: "Whole Foods", items: [{ subject: "Bread" }] }
					: { retailer: "Whole Foods", location: "Sarasota", items: [] },
			);
			const repaired = evaluateProductPricingPolicy({
				retailer: "Whole Foods",
				location: "Sarasota",
				items: [{ subject: "Bread" }],
			});
			const repairedHistory: ModelExchange[] = [
				{
					...history[0]!,
					results: [{ ...history[0]!.results[0]!, fact: { decision: first } }],
				},
			];
			expect(
				isProductPricingToolAvailable({
					prompt: { channel: "text", text: "prices for bread" },
					history: repairedHistory,
					toolName: "prepareProductPricing",
				}),
			).toBe(true);

			repairedHistory.push({
				...history[0]!,
				results: [
					{ ...history[0]!.results[0]!, fact: { decision: repaired } },
				],
			});
			expect(
				isProductPricingToolAvailable({
					prompt: { channel: "text", text: "prices for bread" },
					history: repairedHistory,
					toolName: "prepareProductPricing",
				}),
			).toBe(false);
			expect(
				authorizeProductPricingExecution({
					prompt: { channel: "text", text: "prices for bread" },
					history: repairedHistory,
					call: {
						name: "priceProducts",
						input: {
							retailer: "Whole Foods",
							location: "Sarasota",
							items: [{ subject: "Bread" }],
						},
					},
				}),
			).toEqual({ authorized: true });
		},
	);
});

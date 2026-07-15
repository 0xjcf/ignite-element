import { describe, expect, it } from "vitest";
import type { ModelExchange } from "../../agent-loop";
import { authorizeProductPricingExecution } from "./authorization";
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

const authorize = (queries: readonly { subject: string; query: string }[]) =>
	authorizeProductPricingExecution({
		prompt: {
			channel: "text",
			text: "create a shopping list with prices from wholefoods sarasota for breads, eggs, and milk",
		},
		history,
		call: { name: "searchWeb", input: { queries } },
	});

describe("product-pricing execution authorization", () => {
	it("requires the complete admitted subject and query set", () => {
		expect(authorize(decision.searchQueries.slice(0, 1))).toMatchObject({
			authorized: false,
			issues: expect.arrayContaining([
				expect.stringContaining("complete exact admitted"),
			]),
		});
	});

	it("accepts the complete set with stable whitespace identity", () => {
		expect(
			authorize(
				[...decision.searchQueries].reverse().map((entry) => ({
					subject: `  ${entry.subject}  `,
					query: `  ${entry.query.replace(/ /g, "  ")}  `,
				})),
			),
		).toEqual({ authorized: true });
	});
});

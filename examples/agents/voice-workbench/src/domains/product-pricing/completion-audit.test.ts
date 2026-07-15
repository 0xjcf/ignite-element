import { describe, expect, it } from "vitest";
import type { ModelExchange } from "../../agent-loop";
import { auditProductPricingCompletion } from "./completion-audit";
import { evaluateProductPricingPolicy } from "./policy";

const prompt = {
	channel: "text" as const,
	text: "Create a shopping list with prices from Whole Foods Sarasota for bread",
};

const decisionExchange = (
	decision: ReturnType<typeof evaluateProductPricingPolicy>,
): ModelExchange => ({
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
});

const searchExchange: ModelExchange = {
	calls: [
		{
			id: "search",
			command: "searchWeb",
			input: {
				queries: [
					{
						subject: "Bread",
						query:
							"Whole Foods Sarasota standard sandwich bread 20 oz loaf price",
					},
				],
			},
		},
	],
	results: [
		{
			id: "search",
			command: "searchWeb",
			ownerId: "web-search",
			status: "capability-success",
			fact: {
				searches: [
					{
						subject: "Bread",
						price: {
							status: "sourced",
							amount: 4.49,
							sourceUrl: "https://example.com/bread",
						},
					},
				],
			},
			view: { artifacts: [] },
			events: [],
		},
	],
};

const admitted = evaluateProductPricingPolicy({
	retailer: "Whole Foods",
	location: "Sarasota",
	items: [{ subject: "Bread" }],
});

const validView = {
	activeArtifactId: "shopping",
	artifacts: [
		{
			id: "shopping",
			nodes: [
				{
					id: "assumptions",
					kind: "text",
					text: admitted.assumptions[0]?.label,
				},
				{
					id: "items",
					kind: "checklist",
					items: [{ id: "bread", label: "Bread", checked: false }],
				},
				{
					id: "prices",
					kind: "table",
					columns: [
						{ id: "subject", label: "Subject" },
						{ id: "price", label: "Price" },
						{ id: "status", label: "Status" },
						{ id: "source", label: "Source" },
					],
					rows: [
						{
							id: "bread-price",
							cells: ["Bread", 4.49, "sourced", "https://example.com/bread"],
						},
					],
				},
			],
		},
	],
};

describe("product-pricing completion audit", () => {
	it("requires an applicable prompt to observe the policy capability", () => {
		expect(
			auditProductPricingCompletion({ prompt, history: [], view: validView }),
		).toMatchObject({
			ok: false,
			issues: expect.arrayContaining([
				expect.stringContaining("prepareProductPricing"),
			]),
		});
	});

	it("prevents research after a needs-input decision and requires visible questions", () => {
		const decision = evaluateProductPricingPolicy({
			items: [{ subject: "Coffee" }],
		});
		const audit = auditProductPricingCompletion({
			prompt,
			history: [decisionExchange(decision), searchExchange],
			view: { artifacts: [] },
		});

		expect(audit).toMatchObject({
			ok: false,
			issues: expect.arrayContaining([
				expect.stringContaining("Do not search"),
				expect.stringContaining("Which retailer"),
			]),
		});
	});

	it("allows clarification recovery after a denied search attempt", () => {
		const decision = evaluateProductPricingPolicy({
			retailer: "Whole Foods",
			items: [{ subject: "Bread" }],
		});
		const deniedSearch: ModelExchange = {
			...searchExchange,
			results: [
				{
					...searchExchange.results[0],
					ownerId: "product-pricing",
					status: "capability-validation",
					reason:
						"The product-pricing policy requires clarification before web research.",
				},
			],
		};
		const visiblePolicy = {
			activeArtifactId: "clarification",
			artifacts: [
				{
					id: "clarification",
					nodes: [
						{
							id: "policy",
							kind: "text",
							text: [
								...decision.questions.map((question) => question.prompt),
								...decision.assumptions.map((assumption) => assumption.label),
							].join(" "),
						},
					],
				},
			],
		};

		expect(
			auditProductPricingCompletion({
				prompt,
				history: [decisionExchange(decision), deniedSearch],
				view: visiblePolicy,
			}),
		).toEqual({ ok: true });
	});

	it("accepts an admitted decision, matching research, disclosed assumptions, and exact subjects", () => {
		expect(
			auditProductPricingCompletion({
				prompt,
				history: [decisionExchange(admitted), searchExchange],
				view: validView,
			}),
		).toEqual({ ok: true });
	});

	it("rejects mismatched research subjects and hidden assumptions", () => {
		const invalidSearch: ModelExchange = {
			...searchExchange,
			results: [
				{
					...searchExchange.results[0],
					fact: {
						searches: [
							{
								subject: "Bagels",
								price: {
									status: "unverified",
									amount: null,
									sourceUrl: null,
								},
							},
						],
					},
				},
			],
		};
		const audit = auditProductPricingCompletion({
			prompt,
			history: [decisionExchange(admitted), invalidSearch],
			view: {
				...validView,
				artifacts: [
					{
						...validView.artifacts[0],
						nodes: validView.artifacts[0]?.nodes.slice(1),
					},
				],
			},
		});

		expect(audit).toMatchObject({
			ok: false,
			issues: expect.arrayContaining([
				expect.stringContaining("matching search evidence"),
				expect.stringContaining("Disclose this policy assumption"),
			]),
		});
	});
});

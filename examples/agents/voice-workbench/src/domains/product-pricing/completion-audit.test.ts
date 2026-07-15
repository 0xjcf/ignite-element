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

const priceExchange: ModelExchange = {
	calls: [
		{
			id: "search",
			command: "priceProducts",
			input: {
				retailer: "Whole Foods",
				location: "Sarasota",
				items: [{ subject: "Bread" }],
			},
		},
	],
	results: [
		{
			id: "search",
			command: "priceProducts",
			ownerId: "product-pricing-price",
			status: "capability-success",
			fact: {
				searches: [
					{
						subject: "Bread",
						selection: {
							asin: "B0DPXKXV31",
							product: "365 Organic Sourdough Bread",
							size: "24 oz",
							rankingPolicy: "whole-foods-candidate-v1",
						},
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
						{ id: "product", label: "Product" },
						{ id: "size", label: "Size" },
						{ id: "price", label: "Price" },
						{ id: "status", label: "Status" },
						{ id: "source", label: "Source" },
					],
					rows: [
						{
							id: "bread-price",
							cells: [
								"Bread",
								"365 Organic Sourdough Bread",
								"24 oz",
								4.49,
								"sourced",
								"https://example.com/bread",
							],
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
			history: [decisionExchange(decision), priceExchange],
			view: { artifacts: [] },
		});

		expect(audit).toMatchObject({
			ok: false,
			issues: expect.arrayContaining([
				expect.stringContaining("Do not resolve"),
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
			...priceExchange,
			results: [
				{
					...priceExchange.results[0],
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
				history: [decisionExchange(admitted), priceExchange],
				view: validView,
			}),
		).toEqual({ ok: true });
	});

	it("uses the latest repaired policy decision and provider-selected identity evidence", () => {
		const rejected = evaluateProductPricingPolicy({
			retailer: "Whole Foods",
			location: "Sarasota",
			items: [{ subject: "Groceries" }, { subject: "Groceries" }],
		});
		expect(
			auditProductPricingCompletion({
				prompt,
				history: [
					decisionExchange(rejected),
					decisionExchange(admitted),
					priceExchange,
				],
				view: validView,
			}),
		).toEqual({ ok: true });
	});

	it("requires visible provider-selected product and size evidence", () => {
		const viewWithoutSelection = {
			...validView,
			artifacts: [
				{
					...validView.artifacts[0],
					nodes: validView.artifacts[0]?.nodes.map((node) =>
						node.id === "prices"
							? {
									...node,
									rows: [
										{
											id: "bread-price",
											cells: [
												"Bread",
												"Unknown product",
												"Unknown size",
												4.49,
												"sourced",
												"https://example.com/bread",
											],
										},
									],
								}
							: node,
					),
				},
			],
		};
		expect(
			auditProductPricingCompletion({
				prompt,
				history: [decisionExchange(admitted), priceExchange],
				view: viewWithoutSelection,
			}),
		).toMatchObject({
			ok: false,
			issues: expect.arrayContaining([
				expect.stringContaining("provider-selected product and size"),
			]),
		});
	});

	it("accepts explicit no-selection disclosure when the provider selected no product", () => {
		const priceWithoutSelection: ModelExchange = {
			...priceExchange,
			results: [
				{
					...priceExchange.results[0],
					fact: {
						searches: [
							{
								subject: "Bread",
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
		const view = {
			activeArtifactId: "shopping",
			artifacts: [
				{
					id: "shopping",
					nodes: [
						{
							id: "items",
							kind: "checklist",
							items: [{ id: "bread", label: "Bread", checked: false }],
						},
						{
							id: "selection",
							kind: "text",
							text: "Bread: no provider-selected product.",
						},
					],
				},
			],
		};

		expect(
			auditProductPricingCompletion({
				prompt,
				history: [decisionExchange(admitted), priceWithoutSelection],
				view,
			}),
		).toEqual({ ok: true });
	});

	it("rejects mismatched provider-evidence subjects", () => {
		const invalidSearch: ModelExchange = {
			...priceExchange,
			results: [
				{
					...priceExchange.results[0],
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
				expect.stringContaining("matching provider evidence"),
			]),
		});
	});
});

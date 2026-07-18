import type { NeutralToolCall } from "ignite-element/tools";
import { describe, expect, it } from "vitest";
import type { ModelExchange } from "../../agent-loop";
import {
	materializeProductPricingArtifact,
	productSelectionDisclosure,
} from "./artifact-materializer";
import { evaluateProductPricingPolicy } from "./policy";

const subjects = ["Breads", "Eggs", "Milk"] as const;
const decision = evaluateProductPricingPolicy({
	retailer: "Whole Foods",
	location: "Sarasota",
	items: subjects.map((subject) => ({ subject })),
});

const decisionExchange = (observed = decision): ModelExchange => ({
	calls: [
		{
			id: "policy",
			command: "prepareProductPricing",
			input: observed.request,
		},
	],
	results: [
		{
			id: "policy",
			command: "prepareProductPricing",
			ownerId: "product-pricing",
			status: "capability-success",
			fact: { decision: observed },
			view: { artifacts: [] },
			events: [],
		},
	],
});

const decisionFactExchange = (observed: unknown): ModelExchange => {
	const exchange = decisionExchange();
	return {
		...exchange,
		results: exchange.results.map((result) => ({
			...result,
			fact: { decision: observed },
		})),
	};
};

const searches = [
	{
		subject: "Breads",
		price: {
			status: "unverified",
			amount: null,
			sourceUrl: null,
			reason: "No provider-selected product was available.",
		},
	},
	{
		subject: "Eggs",
		selection: {
			product: "365 Large White Grade A Eggs",
			size: "12 count",
		},
		price: {
			status: "unverified",
			amount: null,
			sourceUrl:
				"https://www.wholefoodsmarket.com/product/365-large-white-grade-a-eggs",
			reason: "The official product page did not expose a current price.",
		},
	},
	{
		subject: "Milk",
		selection: {
			product: "365 Whole Milk",
			size: "1 gallon",
		},
		price: {
			status: "unverified",
			amount: null,
			sourceUrl: "https://www.wholefoodsmarket.com/product/365-whole-milk",
			reason: "The official product page did not expose a current price.",
		},
	},
] as const;

const priceExchange = (observed: unknown = searches): ModelExchange => ({
	calls: [
		{
			id: "prices",
			command: "priceProducts",
			input: decision.request,
		},
	],
	results: [
		{
			id: "prices",
			command: "priceProducts",
			ownerId: "product-pricing-price",
			status: "capability-success",
			fact: { searches: observed },
			view: { artifacts: [] },
			events: [],
		},
	],
});

const prompt = {
	channel: "text" as const,
	text: "Create a shopping list with Whole Foods Sarasota pricing",
};

const proposedCreate = {
	id: "create-call",
	name: "createArtifact",
	input: {
		id: "sarasota-prices",
		title: "Whole Foods Sarasota shopping list",
		nodes: [
			{
				kind: "table",
				columns: [{ label: "Item" }, { label: "Price" }],
				rows: subjects.map((subject) => ({ cells: [subject, "N/A"] })),
			},
		],
	},
};

const materialize = (
	history: readonly ModelExchange[],
	call: NeutralToolCall = proposedCreate,
) =>
	materializeProductPricingArtifact({
		prompt,
		history,
		view: { artifacts: [] },
		call,
	});

describe("product-pricing artifact materializer", () => {
	it.each([
		proposedCreate,
		{
			id: "revise-call",
			name: "reviseArtifact",
			input: {
				artifactId: "sarasota-prices",
				expectedRevision: "1",
				title: "Whole Foods Sarasota shopping list",
				nodes: proposedCreate.input.nodes,
			},
		},
	])(
		"preserves the $name envelope and replaces model nodes with canonical evidence",
		(call) => {
			const result = materialize([decisionExchange(), priceExchange()], call);

			expect(result).toEqual(
				materialize([decisionExchange(), priceExchange()], call),
			);
			expect(result).toMatchObject({
				id: call.id,
				name: call.name,
				input: {
					...(call.name === "createArtifact"
						? { id: "sarasota-prices" }
						: {
								artifactId: "sarasota-prices",
								expectedRevision: "1",
							}),
					title: "Whole Foods Sarasota shopping list",
					nodes: [
						{
							kind: "checklist",
							items: subjects.map((subject) => ({
								label: subject,
								checked: false,
							})),
						},
						{
							kind: "text",
							text: [
								productSelectionDisclosure("Breads", null),
								productSelectionDisclosure("Eggs", {
									product: "365 Large White Grade A Eggs",
									size: "12 count",
								}),
								productSelectionDisclosure("Milk", {
									product: "365 Whole Milk",
									size: "1 gallon",
								}),
							].join("\n"),
						},
						{
							kind: "table",
							columns: [
								{ label: "Subject" },
								{ label: "Price" },
								{ label: "Status" },
								{ label: "Source" },
							],
							rows: [
								{ cells: ["Breads", null, "unverified", null] },
								{
									cells: [
										"Eggs",
										null,
										"unverified",
										"https://www.wholefoodsmarket.com/product/365-large-white-grade-a-eggs",
									],
								},
								{
									cells: [
										"Milk",
										null,
										"unverified",
										"https://www.wholefoodsmarket.com/product/365-whole-milk",
									],
								},
							],
						},
					],
				},
			});
			expect(JSON.stringify(result)).not.toContain('"kind":"chart"');
			expect(JSON.stringify(result)).not.toContain("N/A");
		},
	);

	it("copies sourced numeric prices and exact source URLs", () => {
		const sourced = searches.map((entry, index) => ({
			...entry,
			price: {
				status: "sourced",
				amount: index + 2.49,
				sourceUrl: `https://www.wholefoodsmarket.com/product/${index + 1}`,
			},
		}));
		const result = materialize([decisionExchange(), priceExchange(sourced)]);

		expect(result).toMatchObject({
			input: {
				nodes: [
					{},
					{},
					{
						rows: [
							{
								cells: [
									"Breads",
									2.49,
									"sourced",
									"https://www.wholefoodsmarket.com/product/1",
								],
							},
							{
								cells: [
									"Eggs",
									3.49,
									"sourced",
									"https://www.wholefoodsmarket.com/product/2",
								],
							},
							{
								cells: [
									"Milk",
									4.49,
									"sourced",
									"https://www.wholefoodsmarket.com/product/3",
								],
							},
						],
					},
				],
			},
		});
	});

	it.each([
		{ name: "missing decision", history: [priceExchange()] },
		{
			name: "malformed decision request",
			history: [
				decisionFactExchange({
					...decision,
					request: {
						...decision.request,
						items: [...decision.request.items, null],
					},
				}),
				priceExchange(),
			],
		},
		{
			name: "non-admitted latest decision",
			history: [
				decisionExchange(),
				decisionExchange(
					evaluateProductPricingPolicy({ items: [{ subject: "Breads" }] }),
				),
				priceExchange(),
			],
		},
		{
			name: "out-of-order price facts",
			history: [priceExchange(), decisionExchange()],
		},
		{
			name: "mismatched subjects",
			history: [
				decisionExchange(),
				priceExchange([
					{ ...searches[0], subject: "Bagels" },
					...searches.slice(1),
				]),
			],
		},
		{
			name: "duplicated subjects",
			history: [
				decisionExchange(),
				priceExchange([searches[0], searches[0], searches[2]]),
			],
		},
		{
			name: "malformed price facts",
			history: [
				decisionExchange(),
				priceExchange([
					{ ...searches[0], price: { ...searches[0].price, amount: 4.99 } },
					...searches.slice(1),
				]),
			],
		},
		{
			name: "multiple provider attempts",
			history: [decisionExchange(), priceExchange(), priceExchange()],
		},
	])("fails closed for $name", ({ history }) => {
		expect(materialize(history)).toBeNull();
	});

	it("passes generic and malformed artifact proposals through", () => {
		expect(
			materialize([decisionExchange(), priceExchange()], {
				name: "completeResponse",
				input: { text: "Done" },
			}),
		).toBeNull();
		expect(
			materialize([decisionExchange(), priceExchange()], {
				name: "createArtifact",
				input: null,
			}),
		).toBeNull();
	});
});

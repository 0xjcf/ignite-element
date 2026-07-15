import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ModelExchange } from "./agent-loop";
import type { CapabilityOwner } from "./capability-federation";
import { createProductPricingDomainPack } from "./domains/product-pricing";
import { createDomainRegistry } from "./domains/registry";
import { requestMlxWorkbenchModel } from "./model";
import { component, source } from "./session";
import {
	auditCompletionEvidence,
	completeSubmittedPrompt,
} from "./workbench-agent";

vi.mock("./model", () => ({
	requestMlxWorkbenchModel: vi.fn(),
}));

const requestModel = vi.mocked(requestMlxWorkbenchModel);

const priceEvidenceHistory: ModelExchange[] = [
	{
		calls: [
			{
				id: "search-prices",
				command: "searchWeb",
				input: {
					queries: [
						{ subject: "Bread", query: "bread price" },
						{ subject: "Butter", query: "butter price" },
					],
				},
			},
		],
		results: [
			{
				id: "search-prices",
				command: "searchWeb",
				status: "capability-success",
				fact: {
					searches: [
						{
							subject: "Bread",
							query: "bread price",
							price: {
								status: "sourced",
								amount: 4.49,
								display: "$4.49",
								sourceUrl: "https://example.com/bread",
							},
							results: [],
						},
						{
							subject: "Butter",
							query: "butter price",
							price: {
								status: "unverified",
								amount: null,
								sourceUrl: "https://example.com/butter",
								reason:
									"No single explicit price was found in the returned sources.",
							},
							results: [],
						},
					],
				},
				view: { artifacts: [] },
				events: [],
			},
		],
	},
];

beforeAll(() => component.execute({ command: "reportModelAvailable" }));
afterAll(() => source.stop());

describe("shared voice workbench agent", () => {
	it("audits accepted semantic evidence without treating checklist labels as data", () => {
		const audit = auditCompletionEvidence(priceEvidenceHistory, {
			activeArtifactId: "shopping",
			artifacts: [
				{
					id: "shopping",
					nodes: [
						{
							id: "items",
							kind: "checklist",
							items: [
								{ id: "bread", label: "Bread · $4.49", checked: false },
								{ id: "butter", label: "Butter", checked: false },
							],
						},
						{
							id: "prices",
							kind: "table",
							columns: [
								{ id: "subject", label: "Subject" },
								{ id: "price", label: "Price" },
							],
							rows: [{ id: "bread", cells: ["Bread", 4.99] }],
						},
						{
							id: "fabricated-savings",
							kind: "chart",
							chartType: "bar",
							series: [{ id: "savings", label: "Projected savings", value: 5 }],
						},
					],
				},
			],
		});

		expect(audit).toMatchObject({
			ok: false,
			issues: expect.arrayContaining([
				expect.stringContaining("checklist labels"),
				expect.stringContaining("Subject, Price, Status, and Source"),
				expect.stringContaining("Projected savings"),
			]),
		});
	});

	it("accepts exact sourced table facts and excludes unverified chart values", () => {
		const validView = {
			activeArtifactId: "shopping",
			artifacts: [
				{
					id: "shopping",
					nodes: [
						{
							id: "items",
							kind: "checklist",
							items: [
								{ id: "bread", label: "Bread", checked: false },
								{ id: "butter", label: "Butter", checked: false },
							],
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
									id: "bread",
									cells: [
										"Bread",
										4.49,
										"sourced",
										"https://example.com/bread",
									],
								},
								{
									id: "butter",
									cells: [
										"Butter",
										null,
										"unverified",
										"https://example.com/butter",
									],
								},
							],
						},
						{
							id: "spending",
							kind: "chart",
							chartType: "bar",
							series: [{ id: "bread", label: "Bread", value: 4.49 }],
						},
					],
				},
			],
		};
		expect(auditCompletionEvidence(priceEvidenceHistory, validView)).toEqual({
			ok: true,
		});

		const artifact = validView.artifacts[0];
		expect(
			auditCompletionEvidence(priceEvidenceHistory, {
				...validView,
				artifacts: [
					{
						...artifact,
						nodes: [
							...artifact.nodes,
							{
								id: "empty-chart",
								kind: "chart",
								chartType: "bar",
								series: [],
							},
						],
					},
				],
			}),
		).toMatchObject({
			ok: false,
			issues: expect.arrayContaining([expect.stringContaining("empty chart")]),
		});
	});

	it("runs the real component contract without receiving an injected component", async () => {
		requestModel
			.mockResolvedValueOnce({
				ok: true,
				calls: [
					{
						command: "createArtifact",
						input: {
							id: "terminal-plan",
							title: "Terminal plan",
							nodes: [
								{
									id: "summary",
									kind: "text",
									text: "One component in Node.",
								},
							],
						},
					},
				],
			})
			.mockResolvedValueOnce({
				ok: true,
				calls: [
					{
						command: "completeResponse",
						input: { text: "Terminal plan ready." },
					},
				],
			});

		await component.execute({
			command: "submitPrompt",
			input: { modality: "text", text: "Create a terminal plan" },
		});
		const result = await completeSubmittedPrompt(
			{ baseUrl: "http://127.0.0.1:8080/v1", model: "local-model" },
			{ modality: "text", text: "Create a terminal plan" },
		);

		expect(result).toMatchObject({
			accepted: true,
			trace: [
				{ command: "createArtifact", accepted: true },
				{ command: "completeResponse", accepted: true },
			],
		});
		expect(component.getView()).toMatchObject({
			status: "ready",
			activeArtifact: { id: "terminal-plan", revision: "1" },
			response: { text: "Terminal plan ready." },
		});
		expect(requestModel).toHaveBeenCalledTimes(2);
		expect(requestModel.mock.calls[0]?.[1]).not.toHaveProperty("component");
		expect(component.getView().presentation.runtimeManifest).toEqual(
			requestModel.mock.calls[1]?.[1].tools.map((tool) => ({
				...tool,
				ownerId: "workbench-component",
			})),
		);
	});

	it("observes an external fact before authoring a generic sourced budget artifact", async () => {
		requestModel.mockReset();
		requestModel
			.mockResolvedValueOnce({
				ok: true,
				calls: [
					{
						id: "search-prices",
						command: "searchWeb",
						input: {
							queries: [
								{ subject: "Bread", query: "bread price Sarasota" },
								{ subject: "Eggs", query: "eggs price Sarasota" },
								{ subject: "Milk", query: "milk price Sarasota" },
								{ subject: "Coffee", query: "coffee price Sarasota" },
							],
							country: "us",
							countPerQuery: 1,
						},
					},
				],
			})
			.mockResolvedValueOnce({
				ok: true,
				calls: [
					{
						command: "createArtifact",
						input: {
							id: "sourced-budget",
							title: "Sourced grocery budget",
							nodes: [
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
											id: "bread",
											cells: [
												"Bread",
												4.49,
												"sourced",
												"https://example.com/bread",
											],
										},
										{
											id: "eggs",
											cells: [
												"Eggs",
												5.29,
												"sourced",
												"https://example.com/eggs",
											],
										},
										{
											id: "milk",
											cells: [
												"Milk",
												4.19,
												"sourced",
												"https://example.com/milk",
											],
										},
										{
											id: "coffee",
											cells: [
												"Coffee",
												8.99,
												"sourced",
												"https://example.com/coffee",
											],
										},
									],
								},
								{
									id: "budget",
									kind: "table",
									columns: [
										{ id: "measure", label: "Budget measure" },
										{ id: "amount", label: "Amount" },
									],
									rows: [
										{ id: "limit", cells: ["Budget", 100] },
										{ id: "spent", cells: ["Estimated spend", 22.96] },
										{ id: "remaining", cells: ["Remaining", 77.04] },
									],
								},
								{
									id: "spending",
									kind: "chart",
									chartType: "bar",
									series: [
										{ id: "bread", label: "Bread", value: 4.49 },
										{ id: "eggs", label: "Eggs", value: 5.29 },
										{ id: "milk", label: "Milk", value: 4.19 },
										{ id: "coffee", label: "Coffee", value: 8.99 },
									],
								},
							],
						},
					},
				],
			})
			.mockResolvedValueOnce({
				ok: true,
				calls: [
					{
						command: "completeResponse",
						input: { text: "The sourced budget is ready." },
					},
				],
			});
		const search: CapabilityOwner = {
			id: "web-search",
			manifest: [
				{
					name: "searchWeb",
					inputSchema: {
						type: "object",
						properties: {
							queries: {
								type: "array",
								items: {
									type: "object",
									properties: {
										subject: { type: "string" },
										query: { type: "string" },
									},
									required: ["subject", "query"],
								},
							},
						},
						required: ["queries"],
					},
					gated: false,
				},
			],
			run: async () => ({
				type: "success",
				ownerId: "web-search",
				toolName: "searchWeb",
				data: {
					searches: [
						{
							subject: "Bread",
							query: "bread price Sarasota",
							price: {
								status: "sourced",
								amount: 4.49,
								display: "$4.49",
								sourceUrl: "https://example.com/bread",
							},
							results: [
								{
									title: "Bread",
									url: "https://example.com/bread",
									description: "$4.49",
								},
							],
						},
						{
							subject: "Eggs",
							query: "eggs price Sarasota",
							price: {
								status: "sourced",
								amount: 5.29,
								display: "$5.29",
								sourceUrl: "https://example.com/eggs",
							},
							results: [
								{
									title: "Eggs",
									url: "https://example.com/eggs",
									description: "$5.29",
								},
							],
						},
						{
							subject: "Milk",
							query: "milk price Sarasota",
							price: {
								status: "sourced",
								amount: 4.19,
								display: "$4.19",
								sourceUrl: "https://example.com/milk",
							},
							results: [
								{
									title: "Milk",
									url: "https://example.com/milk",
									description: "$4.19",
								},
							],
						},
						{
							subject: "Coffee",
							query: "coffee price Sarasota",
							price: {
								status: "sourced",
								amount: 8.99,
								display: "$8.99",
								sourceUrl: "https://example.com/coffee",
							},
							results: [
								{
									title: "Coffee",
									url: "https://example.com/coffee",
									description: "$8.99",
								},
							],
						},
					],
				},
				receipt: {
					provider: "fake-search",
					queryCount: 4,
					sourceCount: 4,
					fallback: {
						from: "brave-web-search",
						provider: "fake-search",
						status: 503,
						outcome: "success",
					},
				},
			}),
		};

		await component.execute({
			command: "submitPrompt",
			input: {
				modality: "speech",
				text: "Research prices and make a grocery budget chart",
			},
		});
		await expect(
			completeSubmittedPrompt(
				{ baseUrl: "http://127.0.0.1:8080/v1", model: "local-model" },
				{
					modality: "speech",
					text: "Research prices and make a grocery budget chart",
				},
				[search],
			),
		).resolves.toMatchObject({
			accepted: true,
			trace: [
				{ command: "searchWeb", accepted: true },
				{ command: "createArtifact", accepted: true },
				{ command: "completeResponse", accepted: true },
			],
		});

		expect(requestModel.mock.calls[0]?.[1]).toMatchObject({
			capabilities: { internetAccess: "available" },
		});
		expect(
			requestModel.mock.calls[0]?.[1].tools.map((tool) => tool.name),
		).toContain("searchWeb");
		expect(
			requestModel.mock.calls[1]?.[1].history[0]?.results[0],
		).toMatchObject({
			command: "searchWeb",
			status: "capability-success",
			ownerId: "web-search",
			fact: {
				searches: [
					{
						subject: "Bread",
						price: { status: "sourced", amount: 4.49 },
						results: [{ url: "https://example.com/bread" }],
					},
					{
						subject: "Eggs",
						price: { status: "sourced", amount: 5.29 },
						results: [{ url: "https://example.com/eggs" }],
					},
					{
						subject: "Milk",
						price: { status: "sourced", amount: 4.19 },
						results: [{ url: "https://example.com/milk" }],
					},
					{
						subject: "Coffee",
						price: { status: "sourced", amount: 8.99 },
						results: [{ url: "https://example.com/coffee" }],
					},
				],
			},
			receipt: {
				provider: "fake-search",
				queryCount: 4,
				sourceCount: 4,
				fallback: {
					from: "brave-web-search",
					provider: "fake-search",
					status: 503,
					outcome: "success",
				},
			},
		});
		expect(component.getView().activeArtifact).toMatchObject({
			id: "sourced-budget",
			nodes: [
				{
					id: "prices",
					kind: "table",
					rows: [
						{
							id: "bread",
							cells: ["Bread", 4.49, "sourced", "https://example.com/bread"],
						},
						{
							id: "eggs",
							cells: ["Eggs", 5.29, "sourced", "https://example.com/eggs"],
						},
						{
							id: "milk",
							cells: ["Milk", 4.19, "sourced", "https://example.com/milk"],
						},
						{
							id: "coffee",
							cells: ["Coffee", 8.99, "sourced", "https://example.com/coffee"],
						},
					],
				},
				{
					id: "budget",
					kind: "table",
					rows: [
						{ id: "limit", cells: ["Budget", 100] },
						{ id: "spent", cells: ["Estimated spend", 22.96] },
						{ id: "remaining", cells: ["Remaining", 77.04] },
					],
				},
				{
					id: "spending",
					kind: "chart",
					series: [
						{ id: "bread", value: 4.49 },
						{ id: "eggs", value: 5.29 },
						{ id: "milk", value: 4.19 },
						{ id: "coffee", value: 8.99 },
					],
				},
			],
		});
		expect(component.getView().presentation.turn).toMatchObject({
			type: "accepted",
			capability: {
				provider: "fake-search",
				tool: "searchWeb",
				outcome: "success",
				queryCount: 4,
				sourceCount: 4,
				fallback: {
					from: "brave-web-search",
					provider: "fake-search",
					status: 503,
					outcome: "success",
				},
			},
		});
		expect(
			component.getView().runtimeInspector.capabilityRows.slice(-1)[0],
		).toMatchObject({
			message: expect.stringContaining(
				"fallback brave-web-search → fake-search · trigger HTTP 503 · success",
			),
		});
	});

	it("runs the configured product policy before research and records its bounded decision", async () => {
		requestModel.mockReset();
		requestModel
			.mockResolvedValueOnce({
				ok: true,
				calls: [
					{
						id: "policy",
						command: "prepareProductPricing",
						input: {
							retailer: "Whole Foods",
							location: "Sarasota",
							items: [{ subject: "Bread" }],
						},
					},
				],
			})
			.mockResolvedValueOnce({
				ok: true,
				calls: [
					{
						id: "prices",
						command: "priceProducts",
						input: {
							retailer: "Whole Foods",
							location: "Sarasota",
							items: [{ subject: "Bread" }],
						},
					},
				],
			})
			.mockResolvedValueOnce({
				ok: true,
				calls: [
					{
						command: "createArtifact",
						input: {
							id: "policy-shopping-list",
							title: "Whole Foods Sarasota shopping list",
							nodes: [
								{
									id: "assumption",
									kind: "text",
									text: "Provider selection: 365 Organic Sourdough Bread · 24 oz.",
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
					},
				],
			})
			.mockResolvedValueOnce({
				ok: true,
				calls: [
					{
						command: "completeResponse",
						input: { text: "The policy-backed shopping list is ready." },
					},
				],
			});
		const priceProducts: CapabilityOwner = {
			id: "product-pricing-price",
			manifest: [
				{
					name: "priceProducts",
					inputSchema: { type: "object", properties: {} },
					gated: false,
				},
			],
			run: async () => ({
				type: "success",
				ownerId: "product-pricing-price",
				toolName: "priceProducts",
				data: {
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
				receipt: {
					provider: "fixture-product-pricing",
					queryCount: 0,
					sourceCount: 1,
				},
			}),
		};
		const domains = createDomainRegistry([
			createProductPricingDomainPack({ priceCapability: priceProducts }),
		]);
		const event = {
			modality: "text" as const,
			text: "Create a shopping list with prices from Whole Foods Sarasota for bread",
		};
		await component.execute({ command: "submitPrompt", input: event });

		const result = await completeSubmittedPrompt(
			{ baseUrl: "http://127.0.0.1:8080/v1", model: "local-model" },
			event,
			[],
			domains,
		);
		expect(result).toMatchObject({
			accepted: true,
			trace: [
				{ command: "prepareProductPricing", accepted: true },
				{ command: "priceProducts", accepted: true },
				{ command: "createArtifact", accepted: true },
				{ command: "completeResponse", accepted: true },
			],
		});
		expect(requestModel.mock.calls[0]?.[1]).toMatchObject({
			domainPolicyInstructions: expect.stringContaining(
				"call prepareProductPricing",
			),
			capabilities: { internetAccess: "available" },
		});
		const initialToolNames = requestModel.mock.calls[0]?.[1].tools.map(
			(tool) => tool.name,
		);
		expect(initialToolNames).toContain("prepareProductPricing");
		expect(initialToolNames).not.toContain("priceProducts");
		expect(initialToolNames).not.toContain("searchWeb");
		expect(
			requestModel.mock.calls[1]?.[1].tools.map((tool) => tool.name),
		).toContain("priceProducts");
		expect(
			requestModel.mock.calls[1]?.[1].history[0]?.results[0],
		).toMatchObject({
			command: "prepareProductPricing",
			status: "capability-success",
			fact: { decision: { outcome: "admitted" } },
		});
		expect(component.getView().presentation.domainPolicy).toMatchObject({
			domainId: "product-pricing",
			outcome: "admitted",
			assumptions: [],
		});
	});

	const exerciseProductPricingAuthorization = async (
		policyInput: unknown,
		priceInput: unknown,
		eventText = "Create a shopping list with prices from Whole Foods Sarasota for bread",
		providerOutcome: "success" | "provider-failure" = "success",
	) => {
		requestModel.mockReset();
		requestModel.mockResolvedValueOnce({
			ok: true,
			calls: [
				{
					id: "policy",
					command: "prepareProductPricing",
					input: policyInput,
				},
			],
		});
		for (let round = 0; round < 4; round += 1) {
			requestModel.mockResolvedValueOnce({
				ok: true,
				calls: [
					{
						id: `prices-${round}`,
						command: "priceProducts",
						input: priceInput,
					},
				],
			});
		}

		const runPriceProducts = vi.fn(async () =>
			providerOutcome === "success"
				? {
						type: "success" as const,
						ownerId: "product-pricing-price",
						toolName: "priceProducts",
						data: { searches: [] },
						receipt: { provider: "fixture-product-pricing" },
					}
				: {
						type: "provider-failure" as const,
						ownerId: "product-pricing-price",
						toolName: "priceProducts",
						message: "The fixture provider failed.",
					},
		);
		const priceProducts: CapabilityOwner = {
			id: "product-pricing-price",
			manifest: [
				{
					name: "priceProducts",
					inputSchema: { type: "object", properties: {} },
					gated: false,
				},
			],
			run: runPriceProducts,
		};
		const domains = createDomainRegistry([
			createProductPricingDomainPack({ priceCapability: priceProducts }),
		]);
		const event = {
			modality: "text" as const,
			text: eventText,
		};
		await component.execute({ command: "submitPrompt", input: event });

		const result = await completeSubmittedPrompt(
			{ baseUrl: "http://127.0.0.1:8080/v1", model: "local-model" },
			event,
			[],
			domains,
		);

		return { result, runPriceProducts };
	};

	const breadPriceInput = {
		retailer: "Whole Foods",
		location: "Sarasota",
		items: [{ subject: "Bread" }],
	};

	it("denies price lookup before the provider after product pricing needs input", async () => {
		const { runPriceProducts } = await exerciseProductPricingAuthorization(
			{
				retailer: "Whole Foods",
				items: [{ subject: "Bread" }],
			},
			breadPriceInput,
		);

		expect(runPriceProducts).not.toHaveBeenCalled();
		expect(
			requestModel.mock.calls[2]?.[1].history[1]?.results[0],
		).toMatchObject({
			command: "priceProducts",
			ownerId: "product-pricing",
			status: "capability-validation",
			reason:
				"The product-pricing policy requires clarification before price lookup.",
			issues: expect.arrayContaining([
				expect.stringContaining("Which retailer location"),
			]),
		});
		expect(
			requestModel.mock.calls[2]?.[1].tools.map((tool) => tool.name),
		).not.toContain("priceProducts");
	});

	it("denies price lookup before the provider after product pricing rejects input", async () => {
		const { runPriceProducts } = await exerciseProductPricingAuthorization(
			{
				retailer: "Whole Foods",
				location: "Sarasota",
				items: [],
			},
			breadPriceInput,
		);

		expect(runPriceProducts).not.toHaveBeenCalled();
		expect(
			requestModel.mock.calls[2]?.[1].history[1]?.results[0],
		).toMatchObject({
			command: "priceProducts",
			ownerId: "product-pricing",
			status: "capability-validation",
			reason: "The product-pricing policy rejected price lookup.",
			issues: expect.arrayContaining([
				expect.stringContaining("at least one item"),
			]),
		});
		expect(
			requestModel.mock.calls[2]?.[1].tools.map((tool) => tool.name),
		).not.toContain("priceProducts");
	});

	it("executes the exact admitted product-pricing request", async () => {
		const { runPriceProducts } = await exerciseProductPricingAuthorization(
			{
				retailer: "Whole Foods",
				location: "Sarasota",
				items: [{ subject: "Bread" }],
			},
			breadPriceInput,
		);

		expect(runPriceProducts).toHaveBeenCalled();
		expect(runPriceProducts).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				name: "priceProducts",
				input: breadPriceInput,
			}),
		);
		expect(
			requestModel.mock.calls[2]?.[1].tools.map((tool) => tool.name),
		).not.toContain("priceProducts");
	});

	it("does not redispatch price lookup after a provider failure", async () => {
		const { runPriceProducts } = await exerciseProductPricingAuthorization(
			{
				retailer: "Whole Foods",
				location: "Sarasota",
				items: [{ subject: "Bread" }],
			},
			breadPriceInput,
			undefined,
			"provider-failure",
		);

		expect(runPriceProducts).toHaveBeenCalledTimes(1);
		expect(
			requestModel.mock.calls[2]?.[1].tools.map((tool) => tool.name),
		).not.toContain("priceProducts");
		expect(
			requestModel.mock.calls[2]?.[1].history[1]?.results[0],
		).toMatchObject({
			command: "priceProducts",
			ownerId: "product-pricing-price",
			status: "capability-failure",
		});
	});

	it("denies a strict subset of the admitted request before the provider", async () => {
		const { runPriceProducts } = await exerciseProductPricingAuthorization(
			{
				retailer: "Whole Foods",
				location: "Sarasota",
				items: [{ subject: "Bread" }, { subject: "Eggs" }, { subject: "Milk" }],
			},
			breadPriceInput,
			"create a shopping list with prices from wholefoods sarasota for breads, eggs, and milk",
		);

		expect(runPriceProducts).not.toHaveBeenCalled();
	});

	it("repairs the Sarasota category scope once, then makes one aggregated provider call", async () => {
		requestModel.mockReset();
		const subjectItems = [
			{ subject: "Bread" },
			{ subject: "Eggs" },
			{ subject: "Milk" },
		] as const;
		const selectedItems = [
			{
				subject: "Bread",
				product: "365 Organic Sourdough Bread",
				size: "24 oz",
			},
			{
				subject: "Eggs",
				product: "365 Large White Grade A Eggs",
				size: "12 count",
			},
			{
				subject: "Milk",
				product: "365 Whole Milk",
				size: "1 gallon",
			},
		] as const;
		const priceInput = {
			retailer: "Whole Foods",
			location: "Sarasota",
			items: subjectItems,
		};
		requestModel
			.mockResolvedValueOnce({
				ok: true,
				calls: [
					{
						id: "policy-rejected",
						command: "prepareProductPricing",
						input: {
							retailer: "Whole Foods",
							location: "Sarasota",
							items: [{ subject: "Groceries" }, { subject: "Grocery" }],
						},
					},
				],
			})
			.mockResolvedValueOnce({
				ok: true,
				calls: [
					{
						id: "policy-repaired",
						command: "prepareProductPricing",
						input: {
							retailer: "Whole Foods",
							location: "Sarasota",
							items: subjectItems,
						},
					},
				],
			})
			.mockResolvedValueOnce({
				ok: true,
				calls: [
					{
						id: "prices",
						command: "priceProducts",
						input: priceInput,
					},
				],
			})
			.mockResolvedValueOnce({
				ok: true,
				calls: [
					{
						command: "createArtifact",
						input: {
							id: "whole-foods-list",
							title: "Whole Foods Sarasota shopping list",
							nodes: [
								{
									id: "assumptions",
									kind: "text",
									text: "Provider selections: 365 Organic Sourdough Bread · 24 oz. 365 Large White Grade A Eggs · 12 count. 365 Whole Milk · 1 gallon.",
								},
								{
									id: "items",
									kind: "checklist",
									items: [
										{ id: "bread", label: "Bread", checked: false },
										{ id: "eggs", label: "Eggs", checked: false },
										{ id: "milk", label: "Milk", checked: false },
									],
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
											id: "bread",
											cells: [
												"Bread",
												"365 Organic Sourdough Bread",
												"24 oz",
												null,
												"unverified",
												null,
											],
										},
										{
											id: "eggs",
											cells: [
												"Eggs",
												"365 Large White Grade A Eggs",
												"12 count",
												null,
												"unverified",
												null,
											],
										},
										{
											id: "milk",
											cells: [
												"Milk",
												"365 Whole Milk",
												"1 gallon",
												null,
												"unverified",
												null,
											],
										},
									],
								},
							],
						},
					},
				],
			})
			.mockResolvedValueOnce({
				ok: true,
				calls: [
					{
						command: "completeResponse",
						input: { text: "The shopping list is ready." },
					},
				],
			});
		const runPriceProducts = vi.fn(async () => ({
			type: "success" as const,
			ownerId: "product-pricing-price",
			toolName: "priceProducts",
			data: {
				searches: selectedItems.map((item) => ({
					subject: item.subject,
					query: `provider-owned ${item.subject} query`,
					selection: {
						asin:
							item.subject === "Bread"
								? "B0DPXKXV31"
								: item.subject === "Eggs"
									? "B07FWB8QK4"
									: "B074H5SR5S",
						product: item.product,
						size: item.size,
						rankingPolicy: "whole-foods-candidate-v1",
					},
					price: {
						status: "unverified",
						amount: null,
						sourceUrl: null,
						reason: "No explicit current price was found.",
					},
				})),
			},
			receipt: {
				provider: "fixture-product-pricing",
				queryCount: 0,
				sourceCount: 0,
			},
		}));
		const priceProducts: CapabilityOwner = {
			id: "product-pricing-price",
			manifest: [
				{
					name: "priceProducts",
					inputSchema: { type: "object", properties: {} },
					gated: false,
				},
			],
			run: runPriceProducts,
		};
		const domains = createDomainRegistry([
			createProductPricingDomainPack({ priceCapability: priceProducts }),
		]);
		const event = {
			modality: "text" as const,
			text: "create a shopping list with prices from wholefoods sarasota for breads, eggs, and milk",
		};
		await component.execute({ command: "submitPrompt", input: event });

		const result = await completeSubmittedPrompt(
			{ baseUrl: "http://127.0.0.1:8080/v1", model: "local-model" },
			event,
			[],
			domains,
		);
		expect(result).toMatchObject({
			accepted: true,
			trace: [
				{ command: "prepareProductPricing", accepted: true },
				{ command: "prepareProductPricing", accepted: true },
				{ command: "priceProducts", accepted: true },
				{ command: "createArtifact", accepted: true },
				{ command: "completeResponse", accepted: true },
			],
		});
		if (!result)
			throw new Error("Expected a completed product-pricing result.");
		expect(runPriceProducts).toHaveBeenCalledTimes(1);
		expect(runPriceProducts).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "priceProducts",
				input: priceInput,
			}),
		);
		expect(
			result.trace.filter((entry) => entry.command === "prepareProductPricing"),
		).toHaveLength(2);
		expect(
			result.trace.filter((entry) => entry.command === "priceProducts"),
		).toHaveLength(1);
		expect(JSON.stringify(result)).not.toContain(
			"The local model returned an invalid response.",
		);
		expect(
			requestModel.mock.calls[2]?.[1].history[1]?.results[0],
		).toMatchObject({
			fact: {
				decision: { outcome: "admitted", request: { items: subjectItems } },
			},
		});
		expect(
			requestModel.mock.calls.flatMap(([, request]) =>
				request.tools.map((tool) => tool.name),
			),
		).not.toContain("searchWeb");
	});

	it("denies a mismatched admitted request before the provider", async () => {
		const { runPriceProducts } = await exerciseProductPricingAuthorization(
			{
				retailer: "Whole Foods",
				location: "Sarasota",
				items: [{ subject: "Bread" }],
			},
			{ ...breadPriceInput, location: "Tampa" },
		);

		expect(runPriceProducts).not.toHaveBeenCalled();
		expect(
			requestModel.mock.calls[2]?.[1].history[1]?.results[0],
		).toMatchObject({
			command: "priceProducts",
			ownerId: "product-pricing",
			status: "capability-validation",
			reason: "The proposed price lookup is outside the admitted scope.",
			issues: expect.arrayContaining([
				expect.stringContaining(
					"exact retailer, location, and ordered subjects",
				),
			]),
		});
	});

	it("returns incomplete evidence to the model before accepting completion", async () => {
		requestModel.mockReset();
		requestModel
			.mockResolvedValueOnce({
				ok: true,
				calls: [
					{
						id: "repair-search",
						command: "searchWeb",
						input: {
							queries: [
								{ subject: "Bread", query: "bread price" },
								{ subject: "Butter", query: "butter price" },
							],
						},
					},
				],
			})
			.mockResolvedValueOnce({
				ok: true,
				calls: [
					{
						command: "createArtifact",
						input: {
							id: "completion-evidence-repair",
							title: "Completion evidence repair",
							nodes: [
								{
									id: "items",
									kind: "checklist",
									items: [
										{ id: "bread", label: "Bread", checked: false },
										{ id: "butter", label: "Butter", checked: false },
									],
								},
							],
						},
					},
				],
			})
			.mockResolvedValueOnce({
				ok: true,
				calls: [
					{
						command: "completeResponse",
						input: { text: "The researched list is ready." },
					},
				],
			})
			.mockResolvedValueOnce({
				ok: true,
				calls: [
					{
						command: "reviseArtifact",
						input: {
							artifactId: "completion-evidence-repair",
							expectedRevision: "1",
							nodes: [
								{
									id: "items",
									kind: "checklist",
									items: [
										{ id: "bread", label: "Bread", checked: false },
										{ id: "butter", label: "Butter", checked: false },
									],
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
											id: "bread",
											cells: [
												"Bread",
												4.49,
												"sourced",
												"https://example.com/bread",
											],
										},
										{
											id: "butter",
											cells: [
												"Butter",
												null,
												"unverified",
												"https://example.com/butter",
											],
										},
									],
								},
								{
									id: "spending",
									kind: "chart",
									chartType: "bar",
									series: [{ id: "bread", label: "Bread", value: 4.49 }],
								},
							],
						},
					},
				],
			})
			.mockResolvedValueOnce({
				ok: true,
				calls: [
					{
						command: "completeResponse",
						input: { text: "The sourced evidence is ready." },
					},
				],
			});
		const search: CapabilityOwner = {
			id: "web-search",
			manifest: [
				{
					name: "searchWeb",
					inputSchema: { type: "object", properties: {} },
					gated: false,
				},
			],
			run: async () => ({
				type: "success",
				ownerId: "web-search",
				toolName: "searchWeb",
				data: {
					searches: [
						{
							subject: "Bread",
							query: "bread price",
							price: {
								status: "sourced",
								amount: 4.49,
								display: "$4.49",
								sourceUrl: "https://example.com/bread",
							},
							results: [],
						},
						{
							subject: "Butter",
							query: "butter price",
							price: {
								status: "unverified",
								amount: null,
								sourceUrl: "https://example.com/butter",
								reason:
									"No single explicit price was found in the returned sources.",
							},
							results: [],
						},
					],
				},
				receipt: {
					provider: "fake-search",
					queryCount: 2,
					sourceCount: 2,
				},
			}),
		};

		await component.execute({
			command: "submitPrompt",
			input: { modality: "text", text: "Research bread and butter prices" },
		});
		await expect(
			completeSubmittedPrompt(
				{ baseUrl: "http://127.0.0.1:8080/v1", model: "local-model" },
				{ modality: "text", text: "Research bread and butter prices" },
				[search],
			),
		).resolves.toMatchObject({
			accepted: true,
			trace: [
				{ command: "searchWeb", accepted: true },
				{ command: "createArtifact", accepted: true },
				{ command: "completeResponse", accepted: false },
				{ command: "reviseArtifact", accepted: true },
				{ command: "completeResponse", accepted: true },
			],
		});

		expect(
			requestModel.mock.calls[3]?.[1].history[2]?.results[0],
		).toMatchObject({
			command: "completeResponse",
			status: "actor-rejected",
			reason: "evidence-incomplete",
			issues: expect.arrayContaining([
				expect.stringContaining("Subject, Price, Status, and Source"),
			]),
		});
		expect(component.getView().activeArtifact).toMatchObject({
			id: "completion-evidence-repair",
			revision: "2",
			nodes: [
				{
					kind: "checklist",
					items: [
						{ label: "Bread", checked: false },
						{ label: "Butter", checked: false },
					],
				},
				{
					kind: "table",
					rows: [
						{
							cells: ["Bread", 4.49, "sourced", "https://example.com/bread"],
						},
						{
							cells: [
								"Butter",
								null,
								"unverified",
								"https://example.com/butter",
							],
						},
					],
				},
				{
					kind: "chart",
					series: [{ label: "Bread", value: 4.49 }],
				},
			],
		});
	});

	it("preserves a sanitized provider failure status after completion", async () => {
		requestModel.mockReset();
		requestModel
			.mockResolvedValueOnce({
				ok: true,
				calls: [
					{
						command: "createArtifact",
						input: {
							id: "provider-status-proof",
							nodes: [
								{
									id: "summary",
									kind: "text",
									text: "Provider status proof",
								},
							],
						},
					},
				],
			})
			.mockResolvedValueOnce({
				ok: true,
				calls: [
					{
						id: "failed-search",
						command: "searchWeb",
						input: { queries: ["current price"] },
					},
				],
			})
			.mockResolvedValueOnce({
				ok: true,
				calls: [
					{
						command: "completeResponse",
						input: { text: "The provider status was recorded." },
					},
				],
			});
		const failedSearch: CapabilityOwner = {
			id: "catalog-search",
			manifest: [
				{
					name: "searchWeb",
					inputSchema: { type: "object", properties: {} },
					gated: false,
				},
			],
			run: async () => ({
				type: "provider-failure",
				ownerId: "catalog-search",
				toolName: "searchWeb",
				message: "Sanitized provider rejection.",
				status: 429,
				retry: {
					attempts: 2,
					maxAttempts: 2,
					retryAfterMs: 1_000,
					exhausted: true,
				},
				fallback: {
					from: "brave-web-search",
					provider: "fixture-search",
					status: 503,
					outcome: "timeout",
				},
			}),
		};

		await component.execute({
			command: "submitPrompt",
			input: { modality: "text", text: "Record a provider status" },
		});
		await expect(
			completeSubmittedPrompt(
				{ baseUrl: "http://127.0.0.1:8080/v1", model: "local-model" },
				{ modality: "text", text: "Record a provider status" },
				[failedSearch],
			),
		).resolves.toMatchObject({ accepted: true });

		expect(
			requestModel.mock.calls[2]?.[1].history[1]?.results[0],
		).toMatchObject({
			status: "capability-failure",
			providerStatus: 429,
			fact: {
				type: "provider-failure",
				message: "Sanitized provider rejection.",
				status: 429,
				retry: {
					attempts: 2,
					maxAttempts: 2,
					retryAfterMs: 1_000,
					exhausted: true,
				},
				fallback: {
					from: "brave-web-search",
					provider: "fixture-search",
					status: 503,
					outcome: "timeout",
				},
			},
		});
		expect(component.getView().presentation.turn).toMatchObject({
			type: "accepted",
			capability: {
				provider: "catalog-search",
				tool: "searchWeb",
				outcome: "provider-failure",
				status: 429,
				retry: {
					attempts: 2,
					maxAttempts: 2,
					retryAfterMs: 1_000,
					exhausted: true,
				},
				fallback: {
					from: "brave-web-search",
					provider: "fixture-search",
					status: 503,
					outcome: "timeout",
				},
			},
		});
		expect(
			component.getView().runtimeInspector.capabilityRows.slice(-1)[0],
		).toMatchObject({
			message: expect.stringContaining(
				"fallback brave-web-search → fixture-search · trigger HTTP 503 · timeout",
			),
		});
		expect(JSON.stringify(component.getView().presentation.turn)).not.toContain(
			"secret",
		);
	});

	it("rejects a manifest collision before invoking the model", async () => {
		requestModel.mockReset();
		const collidingProvider: CapabilityOwner = {
			id: "bad-provider",
			manifest: [
				{
					name: "createArtifact",
					inputSchema: { type: "object", properties: {} },
					gated: false,
				},
			],
			run: vi.fn(async () => ({
				type: "unavailable" as const,
				ownerId: "bad-provider",
				toolName: "createArtifact",
				message: "not expected",
			})),
		};

		await component.execute({
			command: "submitPrompt",
			input: { modality: "text", text: "Create a plan" },
		});
		await expect(
			completeSubmittedPrompt(
				{ baseUrl: "http://127.0.0.1:8080/v1", model: "local-model" },
				{ modality: "text", text: "Create a plan" },
				[collidingProvider],
			),
		).resolves.toMatchObject({
			accepted: false,
			reason: "model-failed",
			failure: {
				kind: "configuration",
				message:
					"Capability configuration rejected duplicate tool names: createArtifact.",
			},
		});

		expect(requestModel).not.toHaveBeenCalled();
		expect(collidingProvider.run).not.toHaveBeenCalled();
		expect(component.getView().presentation.turn).toMatchObject({
			type: "model-failed",
			message:
				"Capability configuration rejected duplicate tool names: createArtifact.",
			collision: {
				outcome: "collision",
				toolNames: ["createArtifact"],
				owners: ["workbench-component", "bad-provider"],
			},
		});
	});
});

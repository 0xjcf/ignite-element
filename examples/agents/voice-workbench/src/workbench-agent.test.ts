import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ModelExchange, ModelResult } from "./agent-loop";
import type { CapabilityOwner } from "./capability-federation";
import { createProductPricingDomainPack } from "./domains/product-pricing";
import { createDomainRegistry } from "./domains/registry";
import { requestMlxWorkbenchModel } from "./model";
import { component, reportModelAvailable, source } from "./session";
import {
	auditCompletionEvidence,
	completeSubmittedPrompt,
	normalizeSemanticArtifactIdentity,
} from "./workbench-agent";

vi.mock("./model", () => ({
	requestMlxWorkbenchModel: vi.fn(),
}));

const requestModel = vi.mocked(requestMlxWorkbenchModel);

type ModelTurnHandle = {
	turnId: string;
	done: Promise<import("./agent-loop").ModelTurnResult | null>;
	cancel: () => void;
	timeout: () => void;
	dispose: () => void;
};

type StartSubmittedPrompt = (
	configuration: Parameters<typeof completeSubmittedPrompt>[0],
	event: Parameters<typeof completeSubmittedPrompt>[1],
	externalCapabilities?: Parameters<typeof completeSubmittedPrompt>[2],
	domains?: Parameters<typeof completeSubmittedPrompt>[3],
	options?: { timeoutMs?: number },
) => ModelTurnHandle;

const loadStartSubmittedPrompt = async (): Promise<StartSubmittedPrompt> => {
	const agent = (await import("./workbench-agent")) as unknown as {
		startSubmittedPrompt?: StartSubmittedPrompt;
	};
	expect(agent.startSubmittedPrompt).toBeTypeOf("function");
	if (!agent.startSubmittedPrompt) {
		throw new Error(
			"startSubmittedPrompt must expose the supervised turn handle",
		);
	}
	return agent.startSubmittedPrompt;
};

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

beforeAll(() => reportModelAvailable());
afterAll(() => source.stop());

describe("shared voice workbench agent", () => {
	it("synthesizes only missing semantic artifact identities deterministically", () => {
		const input = {
			id: "artifact",
			nodes: [
				{
					id: "kept-node",
					kind: "checklist",
					items: [
						{ label: "Missing checked" },
						{ id: "kept-item", label: "Ready", checked: false },
					],
				},
				{
					kind: "form",
					fields: [{ label: "Name", input: { type: "string" } }],
					submit: {
						kind: "action",
						label: "Submit",
						commandName: "completeResponse",
						payload: { text: "Done" },
					},
				},
				{
					kind: "table",
					columns: [{ label: "Subject" }],
					rows: [{ cells: ["Bread"] }],
				},
				{
					kind: "timeline",
					events: [{ label: "Start", timestamp: "now" }],
				},
				{
					kind: "chart",
					chartType: "bar",
					series: [{ label: "Bread", value: 4.49 }],
				},
				{
					kind: "decision-log",
					entries: [{ title: "Store", decision: "Whole Foods" }],
				},
			],
		};

		const normalized = normalizeSemanticArtifactIdentity(
			"createArtifact",
			input,
		);
		expect(normalized).toEqual(
			normalizeSemanticArtifactIdentity("createArtifact", input),
		);
		expect(normalized).toEqual({
			id: "artifact",
			nodes: [
				{
					id: "kept-node",
					kind: "checklist",
					items: [
						{
							id: "model-node-1-item-1",
							label: "Missing checked",
						},
						{ id: "kept-item", label: "Ready", checked: false },
					],
				},
				{
					id: "model-node-2",
					kind: "form",
					fields: [
						{
							id: "model-node-2-field-1",
							label: "Name",
							input: { type: "string" },
						},
					],
					submit: {
						id: "model-node-2-submit",
						kind: "action",
						label: "Submit",
						commandName: "completeResponse",
						payload: { text: "Done" },
					},
				},
				{
					id: "model-node-3",
					kind: "table",
					columns: [{ id: "model-node-3-column-1", label: "Subject" }],
					rows: [{ id: "model-node-3-row-1", cells: ["Bread"] }],
				},
				{
					id: "model-node-4",
					kind: "timeline",
					events: [
						{
							id: "model-node-4-event-1",
							label: "Start",
							timestamp: "now",
						},
					],
				},
				{
					id: "model-node-5",
					kind: "chart",
					chartType: "bar",
					series: [
						{
							id: "model-node-5-series-1",
							label: "Bread",
							value: 4.49,
						},
					],
				},
				{
					id: "model-node-6",
					kind: "decision-log",
					entries: [
						{
							id: "model-node-6-entry-1",
							title: "Store",
							decision: "Whole Foods",
						},
					],
				},
			],
		});
		expect(normalizeSemanticArtifactIdentity("completeResponse", input)).toBe(
			input,
		);
	});

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
			component.getView().presentation.turn?.capability,
		).not.toHaveProperty("pricingRows");
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
			domainPolicyInstructions: expect.stringMatching(
				/shopping checklist with each requested subject exactly once.*Subject, Price, Status, and Source.*null.*provider-selected product and size.*no numeric chart or total/is,
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
		providerData: unknown = { searches: [] },
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
		for (let round = 0; round < 5; round += 1) {
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
						data: providerData,
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
			expect.any(AbortSignal),
		);
		expect(
			requestModel.mock.calls[2]?.[1].tools.map((tool) => tool.name),
		).not.toContain("priceProducts");
		expect(requestModel).toHaveBeenCalledTimes(6);
		await Promise.resolve();
		expect(requestModel).toHaveBeenCalledTimes(6);
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

	it("bounds and sanitizes per-subject pricing proof rows", async () => {
		const oversizedSubject = "S".repeat(200);
		const oversizedProduct = "P".repeat(240);
		const oversizedSize = "Z".repeat(120);
		const validReceipt = {
			cache: "miss",
			native: "hit",
			brave: "not-needed",
		};
		const searches = Array.from({ length: 10 }, (_, index) => ({
			subject: index === 0 ? oversizedSubject : `Item ${index}`,
			query: `raw provider query ${index}`,
			selection: {
				product: index === 0 ? oversizedProduct : `Product ${index}`,
				size: index === 0 ? oversizedSize : `${index} oz`,
				rawProviderPayload: `secret selection ${index}`,
			},
			price: {
				status: "unverified",
				reasonCode: "offer-unavailable",
				reason: "R".repeat(300),
				rawAmount: `secret price ${index}`,
			},
			receipt: validReceipt,
			results: [{ raw: `secret result ${index}` }],
		}));
		searches[1] = { ...searches[1], subject: "   " };
		searches[2] = {
			...searches[2],
			price: {
				status: "estimated",
				reasonCode: "offer-unavailable",
				reason: "R".repeat(300),
				rawAmount: "secret price 2",
			},
		};
		searches[3] = {
			...searches[3],
			receipt: { ...validReceipt, native: "raw-native-state" },
		};

		await exerciseProductPricingAuthorization(
			{
				retailer: "Whole Foods",
				location: "Sarasota",
				items: [{ subject: "Bread" }],
			},
			breadPriceInput,
			undefined,
			"success",
			{ searches },
		);

		const recorded = component
			.getView()
			.presentation.capabilityOutcomes.filter(
				(outcome) => outcome.ownerId === "product-pricing-price",
			)
			.slice(-1)[0];
		expect(recorded?.pricingRows).toHaveLength(5);
		expect(recorded?.pricingRows?.[0]).toEqual({
			subject: "S".repeat(120),
			priceStatus: "unverified",
			reasonCode: "offer-unavailable",
			reason: "R".repeat(240),
			product: "P".repeat(160),
			size: "Z".repeat(80),
			cacheStatus: "miss",
			nativeStatus: "hit",
			braveStatus: "not-needed",
		});
		expect(recorded?.pricingRows?.map((row) => row.subject)).toEqual([
			"S".repeat(120),
			"Item 4",
			"Item 5",
			"Item 6",
			"Item 7",
		]);
		expect(JSON.stringify(recorded?.pricingRows)).not.toContain(
			"raw provider query",
		);
		expect(JSON.stringify(recorded?.pricingRows)).not.toContain("secret");
		expect(JSON.stringify(recorded?.pricingRows)).not.toContain("Item 8");
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
						reasonCode: "offer-unavailable",
						reason: "No explicit current price was found.",
					},
					receipt:
						item.subject === "Bread"
							? {
									cache: "miss" as const,
									native: "hit" as const,
									brave: "not-needed" as const,
								}
							: item.subject === "Eggs"
								? {
										cache: "miss" as const,
										native: "miss" as const,
										brave: "attempted-success" as const,
									}
								: {
										cache: "hit" as const,
										native: "not-needed" as const,
										brave: "not-needed" as const,
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
			expect.any(AbortSignal),
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
		expect(
			component.getView().presentation.capabilityOutcomes.slice(-1)[0],
		).toMatchObject({
			ownerId: "product-pricing-price",
			toolName: "priceProducts",
			pricingRows: [
				{
					subject: "Bread",
					priceStatus: "unverified",
					reasonCode: "offer-unavailable",
					reason: "No explicit current price was found.",
					product: "365 Organic Sourdough Bread",
					size: "24 oz",
					cacheStatus: "miss",
					nativeStatus: "hit",
					braveStatus: "not-needed",
				},
				{
					subject: "Eggs",
					priceStatus: "unverified",
					reasonCode: "offer-unavailable",
					reason: "No explicit current price was found.",
					cacheStatus: "miss",
					nativeStatus: "miss",
					braveStatus: "attempted-success",
				},
				{
					subject: "Milk",
					priceStatus: "unverified",
					reasonCode: "offer-unavailable",
					reason: "No explicit current price was found.",
					cacheStatus: "hit",
					nativeStatus: "not-needed",
					braveStatus: "not-needed",
				},
			],
		});
		expect(component.getView().presentation.turn?.capability).toMatchObject({
			pricingRows: [
				{ subject: "Bread" },
				{ subject: "Eggs" },
				{ subject: "Milk" },
			],
		});
	});

	it("deterministically materializes the exact Sarasota artifact before the repeated completion", async () => {
		requestModel.mockReset();
		const subjects = ["Breads", "Eggs", "Milk"] as const;
		const providerFacts = [
			{
				subject: "Breads",
				price: {
					status: "unverified" as const,
					amount: null,
					sourceUrl: null,
					reason: "No provider-selected product was available.",
				},
			},
			{
				subject: "Eggs",
				selection: {
					asin: "B07FWB8QK4",
					product: "365 Large White Grade A Eggs",
					size: "12 count",
					rankingPolicy: "whole-foods-candidate-v1",
				},
				price: {
					status: "unverified" as const,
					amount: null,
					sourceUrl:
						"https://www.wholefoodsmarket.com/product/365-large-white-grade-a-eggs",
					reason: "The official product page exposed no current price.",
				},
			},
			{
				subject: "Milk",
				selection: {
					asin: "B074H5SR5S",
					product: "365 Whole Milk",
					size: "1 gallon",
					rankingPolicy: "whole-foods-candidate-v1",
				},
				price: {
					status: "unverified" as const,
					amount: null,
					sourceUrl: "https://www.wholefoodsmarket.com/product/365-whole-milk",
					reason: "The official product page exposed no current price.",
				},
			},
		] as const;
		const priceInput = {
			retailer: "Whole Foods",
			location: "Sarasota",
			items: subjects.map((subject) => ({ subject })),
		};
		requestModel
			.mockResolvedValueOnce({
				ok: true,
				calls: [
					{
						command: "prepareProductPricing",
						input: priceInput,
					},
				],
			})
			.mockResolvedValueOnce({
				ok: true,
				calls: [
					{
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
							id: "live-sarasota-list",
							title: "Whole Foods Sarasota shopping list",
							nodes: [
								{
									kind: "text",
									text: "Eggs: 365 Large White Grade A Eggs. Milk: 365 Whole Milk.",
								},
								{
									kind: "table",
									columns: [
										{ label: "Item" },
										{ label: "Price" },
										{ label: "Source" },
									],
									rows: subjects.map((subject) => ({
										cells: [subject, "N/A", "N/A"],
									})),
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
			})
			// Mirrors the live model's repeated completion proposal. Deterministic
			// materialization makes the first completion succeed, so this stays unused.
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
				searches: providerFacts.map((fact) => ({
					...fact,
					query: `provider-owned ${fact.subject} query`,
					receipt: {
						cache: "miss" as const,
						native: "hit" as const,
						brave: "not-needed" as const,
					},
				})),
			},
			receipt: {
				provider: "fixture-product-pricing",
				queryCount: 0,
				sourceCount: 0,
			},
		}));
		const domains = createDomainRegistry([
			createProductPricingDomainPack({
				priceCapability: {
					id: "product-pricing-price",
					manifest: [
						{
							name: "priceProducts",
							inputSchema: { type: "object", properties: {} },
							gated: false,
						},
					],
					run: runPriceProducts,
				},
			}),
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
				{ command: "priceProducts", accepted: true },
				{ command: "createArtifact", accepted: true },
				{ command: "completeResponse", accepted: true },
			],
		});
		expect(requestModel).toHaveBeenCalledTimes(4);
		expect(runPriceProducts).toHaveBeenCalledTimes(1);
		expect(
			result?.trace.filter((entry) => entry.command === "priceProducts"),
		).toHaveLength(1);
		expect(
			requestModel.mock.calls.filter(([, request]) =>
				request.tools.some((tool) => tool.name === "priceProducts"),
			),
		).toHaveLength(1);
		expect(
			requestModel.mock.calls.flatMap(([, request]) =>
				request.tools.map((tool) => tool.name),
			),
		).not.toContain("searchWeb");
		expect(requestModel.mock.calls[0]?.[1].domainPolicyInstructions).toContain(
			"using null only for unverified Price; copy Source exactly, including an official URL when provided",
		);
		expect(
			result?.trace.some((entry) => entry.command === "reviseArtifact"),
		).toBe(false);
		expect(component.getView().activeArtifact).toMatchObject({
			id: "live-sarasota-list",
			revision: "1",
			nodes: [
				{
					id: "model-node-1",
					kind: "checklist",
					items: [
						{ id: "model-node-1-item-1", label: "Breads" },
						{ id: "model-node-1-item-2", label: "Eggs" },
						{ id: "model-node-1-item-3", label: "Milk" },
					],
				},
				{
					id: "model-node-2",
					kind: "text",
					text: "Breads: no provider-selected product.\nEggs: provider-selected product 365 Large White Grade A Eggs; size 12 count.\nMilk: provider-selected product 365 Whole Milk; size 1 gallon.",
				},
				{
					id: "model-node-3",
					kind: "table",
					rows: [
						{
							id: "model-node-3-row-1",
							cells: ["Breads", null, "unverified", null],
						},
						{
							id: "model-node-3-row-2",
							cells: [
								"Eggs",
								null,
								"unverified",
								"https://www.wholefoodsmarket.com/product/365-large-white-grade-a-eggs",
							],
						},
						{
							id: "model-node-3-row-3",
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
		});
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

	it.each(["preparation", "provider failure"] as const)(
		"prevents a deferred turn A response from mutating turn B after %s",
		async (interruption) => {
			const startSubmittedPrompt = await loadStartSubmittedPrompt();
			requestModel.mockReset();
			let resolveTurnA!: (result: ModelResult) => void;
			let resolveTurnB!: (result: ModelResult) => void;
			requestModel
				.mockImplementationOnce(
					() =>
						new Promise<ModelResult>((resolve) => {
							resolveTurnA = resolve;
						}),
				)
				.mockImplementationOnce(
					() =>
						new Promise<ModelResult>((resolve) => {
							resolveTurnB = resolve;
						}),
				)
				.mockResolvedValueOnce({
					ok: false,
					error: { kind: "provider", message: "Turn A stopped." },
				});
			const artifactId = `old-turn-artifact-${interruption.replace(" ", "-")}`;
			const configuration = {
				baseUrl: "http://127.0.0.1:8080/v1",
				model: "local-model",
			};

			await component.execute({
				command: "submitPrompt",
				input: { modality: "text", text: `Start turn A for ${interruption}.` },
			});
			const turnA = component.getView().lifecycle.activeTurnId;
			if (!turnA) throw new Error("turn A was not admitted");
			const handleA = startSubmittedPrompt(configuration, {
				turnId: turnA,
				modality: "text",
				text: `Start turn A for ${interruption}.`,
			});
			await vi.waitFor(() => expect(requestModel).toHaveBeenCalledTimes(1));

			if (interruption === "preparation") {
				await component.execute({ command: "beginModelPreparation" });
			} else {
				source.send({
					type: "MODEL_FAILED",
					failure: {
						kind: "provider",
						message: "Provider interrupted turn A.",
					},
				});
			}
			handleA.cancel();
			reportModelAvailable();
			await component.execute({
				command: "submitPrompt",
				input: {
					modality: "text",
					text: `Start turn B after ${interruption}.`,
				},
			});
			const turnB = component.getView().lifecycle.activeTurnId;
			if (!turnB) throw new Error("turn B was not admitted");
			const handleB = startSubmittedPrompt(configuration, {
				turnId: turnB,
				modality: "text",
				text: `Start turn B after ${interruption}.`,
			});
			await vi.waitFor(() => expect(requestModel).toHaveBeenCalledTimes(2));

			resolveTurnA({
				ok: true,
				calls: [
					{
						command: "createArtifact",
						input: {
							id: artifactId,
							nodes: [
								{
									id: "old-copy",
									kind: "text",
									text: "This stale artifact must never be committed.",
								},
							],
						},
					},
				],
			});
			await expect(handleA.done).resolves.toBeNull();
			await Promise.resolve();
			expect(
				component
					.getSnapshot()
					.context.documents.some((document) => document.id === artifactId),
			).toBe(false);
			expect(component.getView().lifecycle.activeTurnId).toBe(turnB);

			handleB.dispose();
			handleB.dispose();
			await expect(handleB.done).resolves.toBeNull();
			resolveTurnB({
				ok: false,
				error: { kind: "provider", message: "Late turn B settlement." },
			});
			await Promise.resolve();
			reportModelAvailable();
		},
	);

	it("times out the whole turn once and fences a provider that ignores abort", async () => {
		const startSubmittedPrompt = await loadStartSubmittedPrompt();
		vi.useFakeTimers();
		requestModel.mockReset();
		requestModel.mockResolvedValueOnce({
			ok: true,
			calls: [
				{
					id: "late-search",
					command: "searchWeb",
					input: { query: "late provider" },
				},
			],
		});
		let resolveProvider!: (
			result: Awaited<ReturnType<CapabilityOwner["run"]>>,
		) => void;
		let providerSignal: AbortSignal | undefined;
		const ignoredAbortProvider: CapabilityOwner = {
			id: "ignored-abort-provider",
			manifest: [
				{
					name: "searchWeb",
					inputSchema: { type: "object", properties: {} },
					gated: false,
				},
			],
			run: (_call, signal) => {
				providerSignal = signal;
				return new Promise((resolve) => {
					resolveProvider = resolve;
				});
			},
		};
		const terminalFacts: string[] = [];
		let previousTerminal = source.getSnapshot().context.lastTurnTerminal;
		const terminalSubscription = source.subscribe((snapshot) => {
			if (
				snapshot.context.lastTurnTerminal &&
				snapshot.context.lastTurnTerminal !== previousTerminal
			) {
				terminalFacts.push(snapshot.context.lastTurnTerminal.type);
				previousTerminal = snapshot.context.lastTurnTerminal;
			}
		});

		try {
			await component.execute({
				command: "submitPrompt",
				input: { modality: "text", text: "Wait for the slow capability." },
			});
			const turnId = component.getView().lifecycle.activeTurnId;
			if (!turnId) throw new Error("timeout turn was not admitted");
			const capabilityCount =
				component.getView().presentation.capabilityOutcomes.length;
			const handle = startSubmittedPrompt(
				{ baseUrl: "http://127.0.0.1:8080/v1", model: "local-model" },
				{
					turnId,
					modality: "text",
					text: "Wait for the slow capability.",
				},
				[ignoredAbortProvider],
				undefined,
				{ timeoutMs: 100 },
			);
			await vi.advanceTimersByTimeAsync(0);
			expect(providerSignal).toBeDefined();

			await vi.advanceTimersByTimeAsync(100);
			await expect(handle.done).resolves.toBeNull();
			expect(providerSignal?.aborted).toBe(true);
			expect(source.getSnapshot().context.lastTurnTerminal).toEqual({
				type: "TIMEOUT",
				turnId,
			});
			expect(terminalFacts.filter((type) => type === "TIMEOUT")).toHaveLength(
				1,
			);

			resolveProvider({
				type: "success",
				ownerId: "ignored-abort-provider",
				toolName: "searchWeb",
				data: { results: [{ title: "late" }] },
				receipt: { provider: "ignored-abort-provider" },
			});
			await vi.advanceTimersByTimeAsync(0);
			expect(requestModel).toHaveBeenCalledTimes(1);
			expect(component.getView().presentation.capabilityOutcomes).toHaveLength(
				capabilityCount,
			);
			expect(terminalFacts.filter((type) => type === "TIMEOUT")).toHaveLength(
				1,
			);
		} finally {
			terminalSubscription.unsubscribe();
			vi.useRealTimers();
			reportModelAvailable();
		}
	});

	it("turns an active authorization port rejection into TURN_FAILED before timeout", async () => {
		const startSubmittedPrompt = await loadStartSubmittedPrompt();
		requestModel.mockReset();
		requestModel.mockResolvedValueOnce({
			ok: true,
			calls: [
				{
					id: "throwing-authorization",
					command: "completeResponse",
					input: { text: "This command must not complete." },
				},
			],
		});
		const domains = {
			...createDomainRegistry([]),
			authorizeExecution: () => {
				throw new Error("Private authorization details must stay bounded.");
			},
		};

		await component.execute({
			command: "submitPrompt",
			input: {
				modality: "text",
				text: "Exercise the authorization port failure boundary.",
			},
		});
		const turnId = component.getView().lifecycle.activeTurnId;
		if (!turnId) throw new Error("port-failure turn was not admitted");
		const handle = startSubmittedPrompt(
			{ baseUrl: "http://127.0.0.1:8080/v1", model: "local-model" },
			{
				turnId,
				modality: "text",
				text: "Exercise the authorization port failure boundary.",
			},
			[],
			domains,
			{ timeoutMs: 1_000 },
		);

		try {
			await vi.waitFor(
				() =>
					expect(
						component.getSnapshot().context.childLifecycles.modelTurn,
					).toMatchObject({
						state: "failed",
						turnId,
						terminal: { type: "TURN_FAILED", turnId },
					}),
				{ timeout: 150 },
			);
			await expect(handle.done).resolves.toMatchObject({
				accepted: false,
				reason: "model-failed",
				failure: {
					kind: "provider",
					message: "A turn port failed unexpectedly.",
				},
			});
			expect(source.getSnapshot()).toMatchObject({
				value: { available: "idle" },
				context: {
					response: null,
					lastTurnTerminal: { type: "TURN_FAILED", turnId },
				},
			});
		} finally {
			handle.dispose();
			await handle.done.catch(() => null);
			reportModelAvailable();
		}
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

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CapabilityOwner } from "./capability-federation";
import { requestMlxWorkbenchModel } from "./model";
import { component, source } from "./session";
import { completeSubmittedPrompt } from "./workbench-agent";

vi.mock("./model", () => ({
	requestMlxWorkbenchModel: vi.fn(),
}));

const requestModel = vi.mocked(requestMlxWorkbenchModel);

beforeAll(() => component.execute({ command: "reportModelAvailable" }));
afterAll(() => source.stop());

describe("shared voice workbench agent", () => {
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
								"bread price Sarasota",
								"eggs price Sarasota",
								"milk price Sarasota",
								"coffee price Sarasota",
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
										{ id: "item", label: "Item" },
										{ id: "price", label: "Price" },
										{ id: "source", label: "Source" },
									],
									rows: [
										{
											id: "bread",
											cells: ["Bread", 4.49, "https://example.com/bread"],
										},
										{
											id: "eggs",
											cells: ["Eggs", 5.29, "https://example.com/eggs"],
										},
										{
											id: "milk",
											cells: ["Milk", 4.19, "https://example.com/milk"],
										},
										{
											id: "coffee",
											cells: ["Coffee", 8.99, "https://example.com/coffee"],
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
							queries: { type: "array", items: { type: "string" } },
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
							query: "bread price Sarasota",
							results: [
								{
									title: "Bread",
									url: "https://example.com/bread",
									description: "$4.49",
								},
							],
						},
						{
							query: "eggs price Sarasota",
							results: [
								{
									title: "Eggs",
									url: "https://example.com/eggs",
									description: "$5.29",
								},
							],
						},
						{
							query: "milk price Sarasota",
							results: [
								{
									title: "Milk",
									url: "https://example.com/milk",
									description: "$4.19",
								},
							],
						},
						{
							query: "coffee price Sarasota",
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
					{ results: [{ url: "https://example.com/bread" }] },
					{ results: [{ url: "https://example.com/eggs" }] },
					{ results: [{ url: "https://example.com/milk" }] },
					{ results: [{ url: "https://example.com/coffee" }] },
				],
			},
			receipt: { provider: "fake-search", queryCount: 4, sourceCount: 4 },
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
							cells: ["Bread", 4.49, "https://example.com/bread"],
						},
						{ id: "eggs", cells: ["Eggs", 5.29, "https://example.com/eggs"] },
						{ id: "milk", cells: ["Milk", 4.19, "https://example.com/milk"] },
						{
							id: "coffee",
							cells: ["Coffee", 8.99, "https://example.com/coffee"],
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
			},
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
			},
		});
		expect(component.getView().presentation.turn).toMatchObject({
			type: "accepted",
			capability: {
				provider: "catalog-search",
				tool: "searchWeb",
				outcome: "provider-failure",
				status: 429,
			},
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

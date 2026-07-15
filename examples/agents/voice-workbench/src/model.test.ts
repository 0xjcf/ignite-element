import { igniteTools } from "ignite-element/tools";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { type ModelRequest, modelTools } from "./agent-loop";
import { probeMlxWorkbenchReadiness, requestMlxWorkbenchModel } from "./model";
import { component, source } from "./session";

const prompt = {
	channel: "text" as const,
	text: "Create a release checklist",
};

const createRequest = (): ModelRequest => ({
	prompt,
	tools: modelTools(igniteTools(component).manifest),
	view: component.getView().modelContext,
	history: [],
	capabilities: { internetAccess: "unavailable" },
	domainPolicyInstructions: "",
});

beforeAll(() => component.execute({ command: "reportModelAvailable" }));
afterEach(() => vi.unstubAllGlobals());
afterAll(() => source.stop());

describe("consumer-configured MLX workbench model", () => {
	it("proves inference readiness with a minimal chat completion", async () => {
		const fetchMock = vi.fn(
			async (_input: RequestInfo | URL, _init?: RequestInit) =>
				new Response(
					JSON.stringify({
						choices: [
							{
								message: {
									role: "assistant",
									tool_calls: [
										{
											id: "ready",
											type: "function",
											function: {
												name: "workbenchReady",
												arguments: "{}",
											},
										},
									],
								},
							},
						],
					}),
					{ status: 200 },
				),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			probeMlxWorkbenchReadiness({
				baseUrl: "http://127.0.0.1:8080/v1/",
				model: "mlx-community/example-model",
			}),
		).resolves.toEqual({ type: "MODEL_AVAILABLE" });

		const [url, init] = fetchMock.mock.calls[0] ?? [];
		expect(url).toBe("http://127.0.0.1:8080/v1/chat/completions");
		const body = JSON.parse(String(init?.body));
		expect(body).toMatchObject({
			model: "mlx-community/example-model",
			max_tokens: 256,
			stream: false,
			temperature: 0,
		});
		expect(body.tools).toEqual([
			expect.objectContaining({
				function: expect.objectContaining({ name: "workbenchReady" }),
			}),
		]);
	});

	it("rejects inference-only models that cannot return compatible tool calls", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							choices: [{ message: { role: "assistant", content: "Ready" } }],
						}),
						{ status: 200 },
					),
			),
		);

		await expect(
			probeMlxWorkbenchReadiness({
				baseUrl: "http://127.0.0.1:8080/v1",
				model: "inference-only-model",
			}),
		).resolves.toEqual({
			type: "MODEL_FAILED",
			failure: {
				kind: "invalid-response",
				message:
					"The local model did not return an OpenAI-compatible tool call.",
			},
		});
	});

	it("returns readiness failures as sanitized actor facts", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new Error("secret connection details");
			}),
		);
		await expect(
			probeMlxWorkbenchReadiness({
				baseUrl: "http://127.0.0.1:8080/v1",
				model: "consumer-model",
			}),
		).resolves.toEqual({
			type: "MODEL_FAILED",
			failure: {
				kind: "network",
				message: "The local model could not be reached.",
			},
		});
	});

	it("uses Ignite's OpenAI dialect for the current command manifest", async () => {
		await component.execute({
			command: "submitPrompt",
			input: { modality: prompt.channel, text: prompt.text },
		});
		const fetchMock = vi.fn(
			async (_input: RequestInfo | URL, _init?: RequestInit) =>
				new Response(
					JSON.stringify({
						choices: [
							{
								message: {
									role: "assistant",
									tool_calls: [
										{
											id: "create",
											type: "function",
											function: {
												name: "createArtifact",
												arguments: JSON.stringify({
													id: "release-checklist",
													title: "Release checklist",
													nodes: [
														{
															kind: "checklist",
															id: "release-items",
															items: [],
														},
													],
												}),
											},
										},
									],
								},
							},
						],
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				),
		);
		vi.stubGlobal("fetch", fetchMock);

		const result = await requestMlxWorkbenchModel(
			{
				baseUrl: "http://127.0.0.1:8080/v1/",
				model: "mlx-community/example-model",
			},
			createRequest(),
		);

		expect(result).toEqual({
			ok: true,
			calls: [
				{
					id: "create",
					command: "createArtifact",
					input: {
						id: "release-checklist",
						title: "Release checklist",
						nodes: [
							{
								kind: "checklist",
								id: "release-items",
								items: [],
							},
						],
					},
				},
			],
		});
		expect(fetchMock).toHaveBeenCalledOnce();
		const [url, init] = fetchMock.mock.calls[0] ?? [];
		expect(url).toBe("http://127.0.0.1:8080/v1/chat/completions");
		const body = JSON.parse(String(init?.body));
		expect(body.model).toBe("mlx-community/example-model");
		expect(body.tool_choice).toBe("required");
		expect(
			body.tools.map(
				(tool: { function: { name: string } }) => tool.function.name,
			),
		).toEqual(["createArtifact"]);
		const createArtifact = body.tools.find(
			(tool: { function: { name: string } }) =>
				tool.function.name === "createArtifact",
		);
		expect(createArtifact.function.parameters).toMatchObject({
			required: ["id", "nodes"],
			properties: {
				nodes: {
					items: { required: ["id", "kind"] },
				},
			},
		});
		expect(body.messages.at(-1)).toMatchObject({
			role: "user",
		});
		expect(JSON.parse(body.messages[1].content)).toMatchObject({
			capabilities: { internetAccess: "unavailable" },
		});
		expect(body.messages[0].content).toContain(
			"never claim or promise future research",
		);
		expect(body.messages[0].content).toContain(
			"source URLs in semantic table cells",
		);
		expect(body.messages[0].content).toContain(
			"matching domain policy tool before external research",
		);
		expect(body.messages[0].content).not.toContain(
			"table cells or text so the browser can render citations",
		);
	});

	it("adds configured domain instructions without making policy success evidence", async () => {
		const fetchMock = vi.fn(
			async (_input: RequestInfo | URL, _init?: RequestInit) =>
				new Response(
					JSON.stringify({
						choices: [
							{
								message: {
									tool_calls: [
										{
											id: "policy",
											type: "function",
											function: {
												name: "prepareProductPricing",
												arguments: JSON.stringify({ items: [] }),
											},
										},
									],
								},
							},
						],
					}),
					{ status: 200 },
				),
		);
		vi.stubGlobal("fetch", fetchMock);
		await requestMlxWorkbenchModel(
			{ baseUrl: "http://127.0.0.1:8080/v1", model: "local" },
			{
				...createRequest(),
				tools: [
					{
						name: "prepareProductPricing",
						inputSchema: { type: "object", properties: {} },
						gated: false,
					},
				],
				domainPolicyInstructions:
					"Call prepareProductPricing first. Policy success is not price evidence.",
			},
		);

		const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
		expect(body.messages[0].content).toContain(
			"Call prepareProductPricing first. Policy success is not price evidence.",
		);
		expect(body.messages[0].content).toContain(
			"the provider owns store lookup, product and size selection, and deterministic discovery",
		);
		expect(body.messages[0].content).toContain(
			"Never call searchWeb for an applicable product-pricing request",
		);
	});

	it("continues from correlated tool results before the model audits and completes", async () => {
		const fetchMock = vi.fn(
			async (_input: RequestInfo | URL, _init?: RequestInit) =>
				new Response(
					JSON.stringify({
						choices: [
							{
								message: {
									role: "assistant",
									tool_calls: [
										{
											id: "complete",
											type: "function",
											function: {
												name: "completeResponse",
												arguments: JSON.stringify({
													text: "Checklist ready.",
												}),
											},
										},
									],
								},
							},
						],
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				),
		);
		vi.stubGlobal("fetch", fetchMock);
		const request: ModelRequest = {
			...createRequest(),
			history: [
				{
					calls: [
						{
							id: "create",
							command: "createArtifact",
							input: {
								id: "release-checklist",
								nodes: [
									{
										id: "items",
										kind: "checklist",
										items: [],
									},
								],
							},
						},
						{
							id: "early-complete",
							command: "completeResponse",
							input: { text: "Done." },
						},
						{
							id: "search",
							command: "searchWeb",
							input: { queries: ["release checklist sources"] },
						},
					],
					results: [
						{
							id: "create",
							command: "createArtifact",
							status: "accepted",
							view: {
								artifacts: [{ id: "release-checklist", revision: "1" }],
							},
							events: [{ type: "artifact-created" }],
						},
						{
							id: "early-complete",
							command: "completeResponse",
							status: "deferred",
							reason: "observe-artifact-mutation-before-continuing",
							view: {
								artifacts: [{ id: "release-checklist", revision: "1" }],
							},
							events: [],
						},
						{
							id: "search",
							command: "searchWeb",
							status: "capability-success",
							ownerId: "web-search",
							providerStatus: 200,
							fact: {
								searches: [
									{
										query: "release checklist sources",
										results: [
											{
												title: "Release guide",
												url: "https://example.com/release",
											},
										],
									},
								],
							},
							receipt: {
								provider: "brave-web-search",
								queryCount: 1,
								sourceCount: 1,
							},
							view: {
								artifacts: [{ id: "release-checklist", revision: "1" }],
							},
							events: [],
						},
					],
				},
			],
		};

		await expect(
			requestMlxWorkbenchModel(
				{
					baseUrl: "http://127.0.0.1:8080/v1",
					model: "mlx-community/example-model",
				},
				request,
			),
		).resolves.toEqual({
			ok: true,
			calls: [
				{
					id: "complete",
					command: "completeResponse",
					input: { text: "Checklist ready." },
				},
			],
		});

		const [, init] = fetchMock.mock.calls[0] ?? [];
		const body = JSON.parse(String(init?.body));
		expect(
			body.messages.map((message: { role: string }) => message.role),
		).toEqual(["system", "user", "assistant", "tool", "tool", "tool", "user"]);
		expect(
			body.messages[2].tool_calls.map((call: { id: string }) => call.id),
		).toEqual(["create", "early-complete", "search"]);
		expect(JSON.parse(body.messages[3].content)).toMatchObject({
			snapshot: { outcome: "accepted" },
			view: { artifacts: [{ id: "release-checklist", revision: "1" }] },
		});
		expect(JSON.parse(body.messages[4].content)).toMatchObject({
			snapshot: { outcome: "deferred" },
		});
		expect(JSON.parse(body.messages[5].content)).toMatchObject({
			snapshot: {
				outcome: "capability-success",
				ownerId: "web-search",
				providerStatus: 200,
				fact: {
					searches: [{ results: [{ url: "https://example.com/release" }] }],
				},
				receipt: {
					provider: "brave-web-search",
					queryCount: 1,
					sourceCount: 1,
				},
			},
		});
		expect(body.messages[0].content).toContain(
			"wait for its tool result before choosing the next command",
		);
		expect(body.messages[0].content).toContain("setChecklistItem");
		for (const kind of ["form", "timeline", "chart", "code-diff", "action"]) {
			expect(body.messages[0].content).toContain(kind);
		}
	});

	it("returns missing consumer configuration as a fact without fetching", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			requestMlxWorkbenchModel(
				{
					baseUrl: "",
					model: "",
				},
				createRequest(),
			),
		).resolves.toEqual({
			ok: false,
			error: {
				kind: "configuration",
				message: "A local model URL and model name are required.",
			},
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("returns network and staged malformed provider responses as sanitized facts", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new Error("secret network details");
			}),
		);
		await expect(
			requestMlxWorkbenchModel(
				{
					baseUrl: "http://127.0.0.1:8080/v1",
					model: "consumer-model",
				},
				createRequest(),
			),
		).resolves.toEqual({
			ok: false,
			error: {
				kind: "network",
				message: "The local model could not be reached.",
			},
		});

		const malformed = [
			{
				response: new Response("secret raw model payload {", { status: 200 }),
				message: "The local model returned invalid JSON.",
			},
			{
				response: new Response(JSON.stringify({ choices: [] }), {
					status: 200,
				}),
				message: "The local model returned an invalid completion envelope.",
			},
			{
				response: new Response(
					JSON.stringify({
						choices: [
							{
								message: {
									content: "secret model prose",
									tool_calls: [],
								},
							},
						],
					}),
					{ status: 200 },
				),
				message: "The local model returned no authorized compatible tool call.",
			},
		];
		for (const scenario of malformed) {
			vi.stubGlobal(
				"fetch",
				vi.fn(async () => scenario.response),
			);
			const result = await requestMlxWorkbenchModel(
				{
					baseUrl: "http://127.0.0.1:8080/v1",
					model: "consumer-model",
				},
				createRequest(),
			);
			expect(result).toEqual({
				ok: false,
				error: { kind: "invalid-response", message: scenario.message },
			});
			expect(JSON.stringify(result)).not.toContain("secret");
		}
	});
});

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
import { modelTools } from "./agent-loop";
import { probeMlxWorkbenchReadiness, requestMlxWorkbenchModel } from "./model";
import { component, source } from "./session";

const prompt = {
	channel: "text" as const,
	text: "Create a release checklist",
};

const createRequest = () => ({
	prompt,
	tools: modelTools(igniteTools(component).manifest),
	view: component.getView().modelContext,
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
		expect(
			body.tools.map(
				(tool: { function: { name: string } }) => tool.function.name,
			),
		).toEqual(["completeResponse", "createArtifact"]);
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

	it("returns network and malformed provider responses as sanitized facts", async () => {
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

		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(JSON.stringify({ choices: [] }), { status: 200 }),
			),
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
				kind: "invalid-response",
				message: "The local model returned an invalid response.",
			},
		});
	});
});

import { igniteTools } from "ignite-element/tools";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createMlxWorkbenchModel } from "./model";
import { component, source } from "./session";

const prompt = {
	channel: "text" as const,
	text: "Create a release checklist",
};

const createRequest = () => ({
	prompt,
	tools: igniteTools(component).manifest,
	view: component.getView(),
});

afterAll(() => source.stop());

describe("consumer-configured MLX workbench model", () => {
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
		const model = createMlxWorkbenchModel({
			component,
			baseUrl: "http://127.0.0.1:8080/v1/",
			model: "mlx-community/example-model",
			fetch: fetchMock,
		});

		const result = await model(createRequest());

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
		expect(body.messages.at(-1)).toMatchObject({
			role: "user",
		});
	});

	it("returns missing consumer configuration as a fact without fetching", async () => {
		const fetchMock = vi.fn();
		const model = createMlxWorkbenchModel({
			component,
			baseUrl: "",
			model: "",
			fetch: fetchMock,
		});

		await expect(model(createRequest())).resolves.toEqual({
			ok: false,
			error: {
				kind: "configuration",
				message: "A local model URL and model name are required.",
			},
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("returns network and malformed provider responses as sanitized facts", async () => {
		const unreachable = createMlxWorkbenchModel({
			component,
			baseUrl: "http://127.0.0.1:8080/v1",
			model: "consumer-model",
			fetch: vi.fn(async () => {
				throw new Error("secret network details");
			}),
		});
		await expect(unreachable(createRequest())).resolves.toEqual({
			ok: false,
			error: {
				kind: "network",
				message: "The local model could not be reached.",
			},
		});

		const malformed = createMlxWorkbenchModel({
			component,
			baseUrl: "http://127.0.0.1:8080/v1",
			model: "consumer-model",
			fetch: vi.fn(
				async () =>
					new Response(JSON.stringify({ choices: [] }), { status: 200 }),
			),
		});
		await expect(malformed(createRequest())).resolves.toEqual({
			ok: false,
			error: {
				kind: "invalid-response",
				message: "The local model returned an invalid response.",
			},
		});
	});
});

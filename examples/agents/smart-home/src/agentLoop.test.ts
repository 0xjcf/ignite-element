// @vitest-environment node
//
// Phase B's dogfood, key-free and headless: a scripted "model" drives a real
// ignite smart-home through the igniteTools + Anthropic loop in PURE NODE (no
// jsdom). This is the end-to-end proof of the DOM-free agent runtime (Phase A)
// AND a stress test of the agent API surface — varied command input schemas,
// the Option D scalar round-trip, the event observation stream, and errors-as-
// values — encoded as always-on assertions.
import { igniteTools, isOk } from "ignite-element/tools";
import {
	type AnthropicResponse,
	anthropic,
} from "ignite-element/tools/anthropic";
import {
	type OpenAIChatCompletionResponse,
	openai,
} from "ignite-element/tools/openai";
import { describe, expect, it, vi } from "vitest";
import { createActorWebHomeSession } from "./actor-web-home";
import { runHomeAgent, runHomeOpenAICompatibleAgent } from "./agentLoop";
import {
	createHome,
	createLocalHomeSession,
	DOORS,
	ROOMS,
	SCENE_TRANSITION_DELAY_MS,
	SCENES,
} from "./home";
import {
	type Model,
	type OpenAICompatibleModel,
	openAICompatibleModel,
	scriptedModel,
	scriptedOpenAICompatibleModel,
	toOpenAIAssistantMessage,
} from "./model";

describe("smart-home agent — Anthropic tool schemas (getSchema → adapter)", () => {
	const { tools } = igniteTools(createHome(), anthropic);
	const byName = (name: string) => tools.find((tool) => tool.name === name);

	it("runs headless: this whole file is in the node environment (no document)", () => {
		expect(typeof document).toBe("undefined");
	});

	it("translates an object command to an object input_schema", () => {
		expect(byName("toggleLight")?.input_schema).toMatchObject({
			type: "object",
			properties: {
				room: { type: "string", enum: [...ROOMS] },
				on: { type: "boolean" },
			},
		});
	});

	it("object-wraps scalar enum commands under a described `value` field (Option D)", () => {
		expect(byName("lockDoor")?.input_schema).toMatchObject({
			type: "object",
			properties: {
				value: {
					type: "string",
					enum: [...DOORS],
					description: "Door id to lock: front, back, or garage.",
				},
			},
			required: ["value"],
		});
		expect(byName("unlockDoor")?.input_schema).toMatchObject({
			properties: {
				value: {
					type: "string",
					enum: [...DOORS],
					description: "Door id to unlock: front, back, or garage.",
				},
			},
			required: ["value"],
		});
		expect(byName("runScene")?.input_schema).toMatchObject({
			properties: {
				value: {
					type: "string",
					enum: [...SCENES],
					description:
						"Scene name to activate: morning, away, movie, or night.",
				},
			},
			required: ["value"],
		});
		expect(byName("transitionScene")?.input_schema).toMatchObject({
			properties: {
				value: {
					type: "string",
					enum: [...SCENES],
					description:
						"Scene name to transition toward asynchronously: morning, away, movie, or night.",
				},
			},
			required: ["value"],
		});
	});

	it("object-wraps an array command under a described `value` field (Option D)", () => {
		expect(byName("dimRooms")?.input_schema).toMatchObject({
			type: "object",
			properties: {
				value: {
					type: "array",
					description:
						"Room ids to dim by turning lights off and closing blinds.",
					items: {
						type: "string",
						enum: [...ROOMS],
						description: "Room id to dim.",
					},
					minItems: 1,
				},
			},
			required: ["value"],
		});
	});

	it("emits an empty-object schema for a no-arg command", () => {
		expect(byName("status")?.input_schema).toEqual({
			type: "object",
			properties: {},
		});
	});
});

describe("smart-home agent — OpenAI-compatible tool schemas (getSchema → adapter)", () => {
	const { tools } = igniteTools(createHome(), openai);
	const byName = (name: string) =>
		tools.find((tool) => tool.function.name === name);

	it("translates an object command to OpenAI function parameters", () => {
		expect(byName("toggleLight")?.function.parameters).toMatchObject({
			type: "object",
			properties: {
				room: { type: "string", enum: [...ROOMS] },
				on: { type: "boolean" },
			},
		});
	});

	it("object-wraps scalar enum commands under OpenAI function parameters.value", () => {
		expect(byName("lockDoor")?.function.parameters).toMatchObject({
			type: "object",
			properties: {
				value: {
					type: "string",
					enum: [...DOORS],
					description: "Door id to lock: front, back, or garage.",
				},
			},
			required: ["value"],
		});
		expect(byName("runScene")?.function.parameters).toMatchObject({
			properties: {
				value: {
					type: "string",
					enum: [...SCENES],
					description:
						"Scene name to activate: morning, away, movie, or night.",
				},
			},
			required: ["value"],
		});
	});
});

describe("smart-home agent — scripted session (round-trip, headless)", () => {
	it("drives object + scalar-enum + no-arg commands, unwrapping scalars and observing events", async () => {
		const script: AnthropicResponse[] = [
			// object input
			{
				content: [
					{
						type: "tool_use",
						id: "c1",
						name: "toggleLight",
						input: { room: "living", on: true },
					},
				],
			},
			// object input with a bounded number
			{
				content: [
					{
						type: "tool_use",
						id: "c2",
						name: "setThermostat",
						input: { room: "bedroom", temp: 72 },
					},
				],
			},
			// scalar enum — Claude sends it object-wrapped as { value }
			{
				content: [
					{
						type: "tool_use",
						id: "c3",
						name: "lockDoor",
						input: { value: "front" },
					},
				],
			},
			// scalar enum + emits a domain event (scene-applied)
			{
				content: [
					{
						type: "tool_use",
						id: "c4",
						name: "runScene",
						input: { value: "movie" },
					},
				],
			},
			// invalid: temp out of range → InvalidInput (errors as values, never throws)
			{
				content: [
					{
						type: "tool_use",
						id: "c5",
						name: "setThermostat",
						input: { room: "living", temp: 200 },
					},
				],
			},
			// no-arg
			{ content: [{ type: "tool_use", id: "c6", name: "status", input: {} }] },
			// done
			{
				content: [
					{
						type: "text",
						text: "Living light on, bedroom 72°, movie scene set.",
					},
				],
			},
		];

		const result = await runHomeAgent(
			scriptedModel(script),
			"Turn on the living room light, set the bedroom to 72, lock the front door, and start movie mode.",
		);

		expect(result.modelCalls).toBe(7);
		expect(result.trace.map((t) => t.command)).toEqual([
			"toggleLight",
			"setThermostat",
			"lockDoor",
			"runScene",
			"setThermostat",
			"status",
		]);

		// Option D: scalar enums arrived as { value } and were unwrapped to bare strings.
		expect(result.trace[2]).toMatchObject({
			command: "lockDoor",
			input: "front",
			ok: true,
		});
		expect(result.trace[3]).toMatchObject({
			command: "runScene",
			input: "movie",
			ok: true,
		});
		// Object input passes through verbatim.
		expect(result.trace[0]).toMatchObject({
			command: "toggleLight",
			input: { room: "living", on: true },
		});
		// Each observation carries the derived view (not just the raw snapshot), so
		// the agent grounds on the read-model — after toggleLight the living light is on.
		expect(
			(result.trace[0].view as { lights: { living: boolean } }).lights.living,
		).toBe(true);
		// runScene emitted the scene-applied event (the observation stream).
		expect(result.trace[3].events).toContain("scene-applied");
		expect(result.trace[0].events).toContain("light-changed");

		// Errors as values: the out-of-range temp was rejected, never threw.
		expect(result.trace[4]).toMatchObject({
			command: "setThermostat",
			ok: false,
			errorKind: "InvalidInput",
		});

		// Final state reflects the valid commands; the invalid one left living temp alone.
		const view = result.home.getView();
		expect(view).toMatchObject({
			activeScene: "movie",
			thermostat: { bedroom: 72, living: 68 },
		});
		// movie scene turned the living light back off after toggleLight turned it on.
		expect(view.lights.living).toBe(false);
	});

	it("round-trips an array command through Anthropic value wrapping", async () => {
		const home = createHome();
		await home.execute("runScene", "morning");
		const tools = igniteTools(home, anthropic);
		const [call] = tools.toolCalls({
			content: [
				{
					type: "tool_use",
					id: "c-array",
					name: "dimRooms",
					input: { value: ["living", "kitchen"] },
				},
			],
		});

		expect(call).toMatchObject({
			id: "c-array",
			name: "dimRooms",
			input: ["living", "kitchen"],
		});

		const result = await tools.run(call);

		expect(isOk(result)).toBe(true);
		if (!isOk(result)) {
			throw new Error(`Expected dimRooms to run: ${result.error.kind}`);
		}

		expect(result.value.view).toMatchObject({
			activeScene: null,
			lights: { living: false, bedroom: true, kitchen: false },
			blinds: { living: 0, bedroom: 100, kitchen: 0 },
		});
		expect(result.value.events).toEqual(
			expect.arrayContaining([
				{ type: "light-changed", payload: { room: "living", on: false } },
				{ type: "light-changed", payload: { room: "kitchen", on: false } },
			]),
		);
	});

	it("clears the active scene when a device is manually overridden", async () => {
		const home = createHome();

		await home.execute("runScene", "morning");
		expect(home.getView().activeScene).toBe("morning");
		await home.execute("setThermostat", { room: "living", temp: 69 });
		expect(home.getView().activeScene).toBeNull();

		await home.execute("runScene", "movie");
		expect(home.getView().activeScene).toBe("movie");
		await home.execute("setBlinds", { room: "living", percent: 25 });
		expect(home.getView().activeScene).toBeNull();

		await home.execute("runScene", "away");
		expect(home.getView().activeScene).toBe("away");
		await home.execute("unlockDoor", "front");
		expect(home.getView().activeScene).toBeNull();
	});

	it("keeps the active scene when a manual command is a no-op", async () => {
		const home = createHome();

		await home.execute("runScene", "away");
		expect(home.getView().activeScene).toBe("away");
		await home.execute("lockDoor", "front");
		expect(home.getView().activeScene).toBe("away");

		await home.execute("runScene", "morning");
		expect(home.getView().activeScene).toBe("morning");
		await home.execute("setThermostat", { room: "living", temp: 70 });
		expect(home.getView().activeScene).toBe("morning");
		await home.execute("toggleLight", { room: "living", on: true });
		expect(home.getView().activeScene).toBe("morning");
	});

	it("observes a delayed scene after run() acknowledges the pending view", async () => {
		vi.useFakeTimers();
		const home = createHome();
		const tools = igniteTools(home);
		const observations: unknown[] = [];
		const subscription = tools.observe((observation) => {
			observations.push(observation);
		});

		try {
			const result = await tools.run({
				name: "transitionScene",
				input: "morning",
			});

			expect(isOk(result)).toBe(true);
			if (!isOk(result)) {
				throw new Error(
					`Expected transitionScene to run: ${result.error.kind}`,
				);
			}

			expect(result.value.events.map((event) => event.type)).not.toContain(
				"scene-applied",
			);
			expect(result.value.view).toMatchObject({
				activeScene: null,
				pendingScene: "morning",
				lights: { living: false, bedroom: false, kitchen: false },
			});

			await vi.runOnlyPendingTimersAsync();

			expect(home.getView()).toMatchObject({
				activeScene: "morning",
				pendingScene: null,
				lights: { living: true, bedroom: true, kitchen: true },
				thermostat: { living: 70 },
			});
			expect(observations).toEqual(
				expect.arrayContaining([
					{
						type: "event",
						event: { type: "scene-applied", payload: { scene: "morning" } },
					},
					expect.objectContaining({
						type: "view",
						view: expect.objectContaining({
							activeScene: "morning",
							pendingScene: null,
							lights: expect.objectContaining({
								living: true,
								bedroom: true,
								kitchen: true,
							}),
						}),
					}),
				]),
			);
		} finally {
			subscription.unsubscribe();
			vi.useRealTimers();
		}
	});

	it("cancels a delayed scene when a manual command runs before the timer", async () => {
		vi.useFakeTimers();
		const home = createHome();
		const tools = igniteTools(home);

		try {
			const result = await tools.run({
				name: "transitionScene",
				input: "morning",
			});

			expect(isOk(result)).toBe(true);
			if (!isOk(result)) {
				throw new Error(
					`Expected transitionScene to run: ${result.error.kind}`,
				);
			}

			expect(result.value.view).toMatchObject({
				activeScene: null,
				pendingScene: "morning",
			});

			const interimResult = await tools.run({
				name: "setThermostat",
				input: { room: "living", temp: 69 },
			});

			expect(isOk(interimResult)).toBe(true);
			if (!isOk(interimResult)) {
				throw new Error(
					`Expected setThermostat to run: ${interimResult.error.kind}`,
				);
			}

			expect(interimResult.value.view).toMatchObject({
				activeScene: null,
				pendingScene: null,
				thermostat: { living: 69 },
			});

			await vi.runOnlyPendingTimersAsync();

			expect(home.getView()).toMatchObject({
				activeScene: null,
				pendingScene: null,
				lights: { living: false, bedroom: false, kitchen: false },
				thermostat: { living: 69 },
			});
		} finally {
			vi.useRealTimers();
		}
	});

	it("restarts a delayed scene when transitionScene is repeated", async () => {
		vi.useFakeTimers();
		const home = createHome();
		const tools = igniteTools(home);

		try {
			const firstResult = await tools.run({
				name: "transitionScene",
				input: "morning",
			});
			expect(isOk(firstResult)).toBe(true);

			await vi.advanceTimersByTimeAsync(10);

			const secondResult = await tools.run({
				name: "transitionScene",
				input: "movie",
			});

			expect(isOk(secondResult)).toBe(true);
			if (!isOk(secondResult)) {
				throw new Error(
					`Expected transitionScene to run: ${secondResult.error.kind}`,
				);
			}

			expect(secondResult.value.view).toMatchObject({
				activeScene: null,
				pendingScene: "movie",
			});

			await vi.advanceTimersByTimeAsync(20);

			expect(home.getView()).toMatchObject({
				activeScene: null,
				pendingScene: "movie",
			});

			await vi.advanceTimersByTimeAsync(5);

			expect(home.getView()).toMatchObject({
				activeScene: "movie",
				pendingScene: null,
				lights: { living: false },
			});
		} finally {
			vi.useRealTimers();
		}
	});

	it("returns defensive copies from the derived view", () => {
		const home = createHome();
		const view = home.getView();

		view.lights.living = true;
		view.thermostat.living = 80;
		view.blinds.living = 100;
		view.locks.front = false;

		expect(home.getView()).toMatchObject({
			lights: { living: false },
			thermostat: { living: 68 },
			blinds: { living: 0 },
			locks: { front: true },
		});
	});

	it("stops the local runtime when closing the local session", async () => {
		vi.useFakeTimers();
		const session = createLocalHomeSession();
		try {
			const tools = igniteTools(session.home, anthropic);
			const result = await tools.run({
				name: "transitionScene",
				input: "movie",
			});

			expect(isOk(result)).toBe(true);
			expect(session.home.getView()).toMatchObject({
				pendingScene: "movie",
				activeScene: null,
			});

			await session.close();
			await vi.advanceTimersByTimeAsync(SCENE_TRANSITION_DELAY_MS);

			expect(session.home.getView()).toMatchObject({
				pendingScene: "movie",
				activeScene: null,
			});
		} finally {
			vi.useRealTimers();
		}
	});

	it("fails loudly when a scripted fixture runs out of model turns", async () => {
		const model = scriptedModel([
			{ content: [{ type: "text", text: "done" }] },
		]);

		await model({ tools: [], messages: [] });
		await expect(model({ tools: [], messages: [] })).rejects.toThrow(
			/scriptedModel exhausted/,
		);
	});

	it("fails loudly when the model never produces a final response", async () => {
		const toolOnlyModel: Model = async () => ({
			content: [
				{ type: "tool_use", id: "keep-going", name: "status", input: {} },
			],
		});

		await expect(runHomeAgent(toolOnlyModel, "never finish")).rejects.toThrow(
			/runHomeAgent hit MAX_TURNS/,
		);
	});
});

describe("smart-home agent — OpenAI-compatible scripted session", () => {
	it("drives the same headless home through Chat Completions tool_calls", async () => {
		const script: OpenAIChatCompletionResponse[] = [
			{
				choices: [
					{
						message: {
							role: "assistant",
							tool_calls: [
								{
									id: "call_1",
									type: "function",
									function: {
										name: "toggleLight",
										arguments: JSON.stringify({
											room: "living",
											on: true,
										}),
									},
								},
							],
						},
					},
				],
			},
			{
				choices: [
					{
						message: {
							role: "assistant",
							tool_calls: [
								{
									id: "call_2",
									type: "function",
									function: {
										name: "lockDoor",
										arguments: JSON.stringify({ value: "front" }),
									},
								},
								{
									id: "call_3",
									type: "function",
									function: {
										name: "runScene",
										arguments: JSON.stringify({ value: "movie" }),
									},
								},
							],
						},
					},
				],
			},
			{
				choices: [
					{
						message: {
							role: "assistant",
							content:
								"Living light toggled, front door locked, movie mode on.",
						},
					},
				],
			},
		];

		const result = await runHomeOpenAICompatibleAgent(
			scriptedOpenAICompatibleModel(script),
			"Turn on the living room light, lock the front door, and start movie mode.",
		);

		try {
			expect(result.modelCalls).toBe(3);
			expect(result.trace.map((entry) => entry.command)).toEqual([
				"toggleLight",
				"lockDoor",
				"runScene",
			]);
			expect(result.trace[1]).toMatchObject({
				command: "lockDoor",
				input: "front",
				ok: true,
			});
			expect(result.trace[2]).toMatchObject({
				command: "runScene",
				input: "movie",
				ok: true,
			});
			expect(result.home.getView()).toMatchObject({
				activeScene: "movie",
				locks: { front: true },
			});
			expect(result.finalText).toContain("movie mode");
		} finally {
			await result.close();
		}
	});

	it("omits empty tools from Chat Completions requests", async () => {
		const response: OpenAIChatCompletionResponse = {
			choices: [
				{ message: { role: "assistant", content: "No tools needed." } },
			],
		};
		const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
		const fetchImpl: typeof fetch = async (input, init) => {
			calls.push({ input, init });
			return new Response(JSON.stringify(response), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		};
		const model = openAICompatibleModel({
			baseUrl: "http://127.0.0.1:8080/v1",
			model: "mlx-test",
			fetch: fetchImpl,
		});

		await expect(
			model({
				tools: [],
				messages: [{ role: "user", content: "status" }],
			}),
		).resolves.toEqual(response);

		expect(calls).toHaveLength(1);
		expect(calls[0].input).toBe("http://127.0.0.1:8080/v1/chat/completions");
		expect(calls[0].init?.method).toBe("POST");
		const body = JSON.parse(String(calls[0].init?.body));
		expect(body).toMatchObject({
			model: "mlx-test",
			messages: [{ role: "user", content: "status" }],
		});
		expect(body).not.toHaveProperty("tools");
	});

	it("includes non-empty tools in Chat Completions requests", async () => {
		const response: OpenAIChatCompletionResponse = {
			choices: [
				{ message: { role: "assistant", content: "Tools are available." } },
			],
		};
		const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
		const fetchImpl: typeof fetch = async (input, init) => {
			calls.push({ input, init });
			return new Response(JSON.stringify(response), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		};
		const model = openAICompatibleModel({
			baseUrl: "http://127.0.0.1:8080/v1",
			model: "mlx-test",
			fetch: fetchImpl,
		});
		const [tool] = igniteTools(createHome(), openai).tools;
		if (!tool) {
			throw new Error("Expected smart-home OpenAI tool definitions.");
		}

		await expect(
			model({
				tools: [tool],
				messages: [{ role: "user", content: "status" }],
			}),
		).resolves.toEqual(response);

		const body = JSON.parse(String(calls[0].init?.body));
		expect(body.tools).toEqual([tool]);
	});

	it("fails with generic OpenAI-compatible guidance when the server is unreachable", async () => {
		const fetchImpl: typeof fetch = async () => {
			throw new TypeError("fetch failed");
		};
		const model = openAICompatibleModel({
			baseUrl: "http://127.0.0.1:8080/v1",
			model: "mlx-test",
			fetch: fetchImpl,
		});

		await expect(
			model({
				tools: [],
				messages: [{ role: "user", content: "status" }],
			}),
		).rejects.toThrow(/Could not reach OpenAI-compatible server/);
		await expect(
			model({
				tools: [],
				messages: [{ role: "user", content: "status" }],
			}),
		).rejects.toThrow(/local MLX server/);
	});

	it("bounds OpenAI-compatible error response details", async () => {
		const rawDetail = "x".repeat(1_200);
		const fetchImpl: typeof fetch = async () =>
			new Response(rawDetail, {
				status: 500,
				statusText: "Model Error",
			});
		const model = openAICompatibleModel({
			baseUrl: "http://127.0.0.1:8080/v1",
			model: "mlx-test",
			fetch: fetchImpl,
		});

		await expect(
			model({
				tools: [],
				messages: [{ role: "user", content: "status" }],
			}),
		).rejects.toThrow(`${"x".repeat(1_000)}...`);
		await expect(
			model({
				tools: [],
				messages: [{ role: "user", content: "status" }],
			}),
		).rejects.not.toThrow("x".repeat(1_001));
	});

	it("clears OpenAI-compatible request timeouts after network failures", async () => {
		vi.useFakeTimers();
		try {
			const fetchImpl: typeof fetch = async () => {
				throw new TypeError("fetch failed");
			};
			const model = openAICompatibleModel({
				baseUrl: "http://127.0.0.1:8080/v1",
				model: "mlx-test",
				fetch: fetchImpl,
				timeoutMs: 25,
			});

			await expect(
				model({
					tools: [],
					messages: [{ role: "user", content: "status" }],
				}),
			).rejects.toThrow(/Could not reach OpenAI-compatible server/);
			expect(vi.getTimerCount()).toBe(0);
		} finally {
			vi.useRealTimers();
		}
	});

	it("times out hung OpenAI-compatible model requests", async () => {
		vi.useFakeTimers();
		try {
			const fetchImpl: typeof fetch = async (_input, init) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => {
						reject(new Error("request aborted"));
					});
				});
			const model = openAICompatibleModel({
				baseUrl: "http://127.0.0.1:8080/v1",
				model: "mlx-test",
				fetch: fetchImpl,
				timeoutMs: 25,
			});

			const result = model({
				tools: [],
				messages: [{ role: "user", content: "status" }],
			});
			const expectation =
				expect(result).rejects.toThrow(/timed out after 25ms/);
			await vi.advanceTimersByTimeAsync(25);

			await expectation;
		} finally {
			vi.useRealTimers();
		}
	});

	it("keeps the timeout active while reading OpenAI-compatible response bodies", async () => {
		vi.useFakeTimers();
		try {
			const fetchImpl: typeof fetch = async (_input, init) =>
				({
					ok: true,
					json: () =>
						new Promise<unknown>((_resolve, reject) => {
							init?.signal?.addEventListener("abort", () => {
								reject(new Error("body aborted"));
							});
						}),
				}) as Response;
			const model = openAICompatibleModel({
				baseUrl: "http://127.0.0.1:8080/v1",
				model: "mlx-test",
				fetch: fetchImpl,
				timeoutMs: 25,
			});

			const result = model({
				tools: [],
				messages: [{ role: "user", content: "status" }],
			});
			const expectation =
				expect(result).rejects.toThrow(/timed out after 25ms/);
			await vi.advanceTimersByTimeAsync(25);

			await expectation;
		} finally {
			vi.useRealTimers();
		}
	});

	it("reports invalid JSON from an OpenAI-compatible server", async () => {
		const fetchImpl: typeof fetch = async () =>
			new Response("not json", {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		const model = openAICompatibleModel({
			baseUrl: "http://127.0.0.1:8080/v1",
			model: "mlx-test",
			fetch: fetchImpl,
		});

		await expect(
			model({
				tools: [],
				messages: [{ role: "user", content: "status" }],
			}),
		).rejects.toThrow(/returned invalid JSON/);
	});

	it("reports malformed OpenAI-compatible response bodies", async () => {
		const fetchImpl: typeof fetch = async () =>
			new Response(JSON.stringify({ choices: [] }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		const model = openAICompatibleModel({
			baseUrl: "http://127.0.0.1:8080/v1",
			model: "mlx-test",
			fetch: fetchImpl,
		});

		await expect(
			model({
				tools: [],
				messages: [{ role: "user", content: "status" }],
			}),
		).rejects.toThrow(/choices must be a non-empty array/);
	});

	it("rejects OpenAI-compatible choices without a message object", async () => {
		const fetchImpl: typeof fetch = async () =>
			new Response(JSON.stringify({ choices: [{}] }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		const model = openAICompatibleModel({
			baseUrl: "http://127.0.0.1:8080/v1",
			model: "mlx-test",
			fetch: fetchImpl,
		});

		await expect(
			model({
				tools: [],
				messages: [{ role: "user", content: "status" }],
			}),
		).rejects.toThrow(/choice\.message must be an object/);
	});

	it("rejects array-shaped OpenAI-compatible choice messages", async () => {
		const fetchImpl: typeof fetch = async () =>
			new Response(JSON.stringify({ choices: [{ message: [] }] }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		const model = openAICompatibleModel({
			baseUrl: "http://127.0.0.1:8080/v1",
			model: "mlx-test",
			fetch: fetchImpl,
		});

		await expect(
			model({
				tools: [],
				messages: [{ role: "user", content: "status" }],
			}),
		).rejects.toThrow(/choice\.message must be an object/);
	});

	it("rejects non-assistant OpenAI-compatible choice messages", async () => {
		const fetchImpl: typeof fetch = async () =>
			new Response(
				JSON.stringify({
					choices: [{ message: { role: "tool", content: "not an assistant" } }],
				}),
				{
					status: 200,
					headers: { "content-type": "application/json" },
				},
			);
		const model = openAICompatibleModel({
			baseUrl: "http://127.0.0.1:8080/v1",
			model: "mlx-test",
			fetch: fetchImpl,
		});

		await expect(
			model({
				tools: [],
				messages: [{ role: "user", content: "status" }],
			}),
		).rejects.toThrow(/choice\.message\.role must be "assistant"/);
	});

	it("rejects empty OpenAI-compatible assistant messages", async () => {
		const fetchImpl: typeof fetch = async () =>
			new Response(
				JSON.stringify({
					choices: [{ message: { role: "assistant" } }],
				}),
				{
					status: 200,
					headers: { "content-type": "application/json" },
				},
			);
		const model = openAICompatibleModel({
			baseUrl: "http://127.0.0.1:8080/v1",
			model: "mlx-test",
			fetch: fetchImpl,
		});

		await expect(
			model({
				tools: [],
				messages: [{ role: "user", content: "status" }],
			}),
		).rejects.toThrow(/assistant messages must include content or tool_calls/);
	});

	it("rejects empty OpenAI-compatible tool call arrays", async () => {
		const fetchImpl: typeof fetch = async () =>
			new Response(
				JSON.stringify({
					choices: [{ message: { role: "assistant", tool_calls: [] } }],
				}),
				{
					status: 200,
					headers: { "content-type": "application/json" },
				},
			);
		const model = openAICompatibleModel({
			baseUrl: "http://127.0.0.1:8080/v1",
			model: "mlx-test",
			fetch: fetchImpl,
		});

		await expect(
			model({
				tools: [],
				messages: [{ role: "user", content: "status" }],
			}),
		).rejects.toThrow(/message\.tool_calls must be valid/);
	});

	it("serializes assistant tool call arguments for replay", () => {
		const message = toOpenAIAssistantMessage({
			choices: [
				{
					message: {
						role: "assistant",
						tool_calls: [
							{
								id: "call_structured",
								type: "function",
								function: {
									name: "toggleLight",
									arguments: { room: "living", on: true },
								},
							},
						],
					},
				},
			],
		});

		expect(message.tool_calls?.[0]?.function.arguments).toBe(
			JSON.stringify({ room: "living", on: true }),
		);
	});

	it("normalizes structured OpenAI-compatible tool arguments before execution and replay", async () => {
		const observedMessages: Array<
			Parameters<OpenAICompatibleModel>[0]["messages"]
		> = [];
		let turn = 0;
		const model: OpenAICompatibleModel = async ({ messages }) => {
			observedMessages.push(
				JSON.parse(
					JSON.stringify(messages),
				) as Parameters<OpenAICompatibleModel>[0]["messages"],
			);
			turn += 1;
			if (turn === 1) {
				return {
					choices: [
						{
							message: {
								role: "assistant",
								tool_calls: [
									{
										id: "call_structured_loop",
										type: "function",
										function: {
											name: "toggleLight",
											arguments: { room: "living", on: true },
										},
									},
								],
							},
						},
					],
				};
			}
			return {
				choices: [
					{ message: { role: "assistant", content: "Living room is on." } },
				],
			};
		};

		const result = await runHomeOpenAICompatibleAgent(
			model,
			"turn on the living room light",
		);

		try {
			expect(result.trace).toHaveLength(1);
			expect(result.trace[0]).toMatchObject({
				command: "toggleLight",
				input: { room: "living", on: true },
				ok: true,
			});
			expect(result.home.getView().lights.living).toBe(true);

			const replayAssistantMessage = observedMessages[1]?.[1];
			expect(replayAssistantMessage).toMatchObject({
				role: "assistant",
				tool_calls: [
					{
						function: {
							arguments: JSON.stringify({ room: "living", on: true }),
						},
					},
				],
			});
		} finally {
			await result.close();
		}
	});

	it("normalizes missing OpenAI-compatible tool arguments to an empty object", async () => {
		const observedMessages: Array<
			Parameters<OpenAICompatibleModel>[0]["messages"]
		> = [];
		let turn = 0;
		const model: OpenAICompatibleModel = async ({ messages }) => {
			observedMessages.push(
				JSON.parse(
					JSON.stringify(messages),
				) as Parameters<OpenAICompatibleModel>[0]["messages"],
			);
			turn += 1;
			if (turn === 1) {
				return {
					choices: [
						{
							message: {
								role: "assistant",
								tool_calls: [
									{
										id: "call_status",
										type: "function",
										function: { name: "status" },
									},
								],
							},
						},
					],
				} as unknown as OpenAIChatCompletionResponse;
			}
			return {
				choices: [{ message: { role: "assistant", content: "Status read." } }],
			};
		};

		const result = await runHomeOpenAICompatibleAgent(model, "read status");

		try {
			expect(result.trace).toHaveLength(1);
			expect(result.trace[0]).toMatchObject({
				command: "status",
				ok: true,
			});
			const replayAssistantMessage = observedMessages[1]?.[1];
			expect(replayAssistantMessage).toMatchObject({
				role: "assistant",
				tool_calls: [
					{
						function: {
							arguments: "{}",
						},
					},
				],
			});
		} finally {
			await result.close();
		}
	});

	it("normalizes multi-choice OpenAI-compatible responses to the first choice", async () => {
		let turn = 0;
		const multiChoiceModel: OpenAICompatibleModel = async () => {
			const script: OpenAIChatCompletionResponse[] = [
				{
					choices: [
						{
							message: {
								role: "assistant",
								tool_calls: [
									{
										id: "multi-choice-1",
										type: "function",
										function: {
											name: "toggleLight",
											arguments: JSON.stringify({
												room: "kitchen",
												on: true,
											}),
										},
									},
								],
							},
						},
						{
							message: {
								role: "assistant",
								tool_calls: [
									{
										id: "multi-choice-2",
										type: "function",
										function: {
											name: "unlockDoor",
											arguments: JSON.stringify({ value: "front" }),
										},
									},
								],
							},
						},
					],
				},
				{
					choices: [
						{ message: { role: "assistant", content: "Kitchen light is on." } },
					],
				},
			];
			const response = script[turn++];
			if (!response) {
				throw new Error("multiChoiceModel exhausted");
			}
			return response;
		};

		const result = await runHomeOpenAICompatibleAgent(
			multiChoiceModel,
			"turn on the kitchen light",
		);
		try {
			expect(result.trace.map((entry) => entry.command)).toEqual([
				"toggleLight",
			]);
			expect(result.finalText).toBe("Kitchen light is on.");
			expect(result.home.getView()).toMatchObject({
				lights: { kitchen: true },
				allDoorsLocked: true,
			});
		} finally {
			await result.close();
		}
	});

	it("rejects malformed OpenAI-compatible model responses and closes the session", async () => {
		const close = vi.fn(async () => {});
		const runtimeFactory = async () => ({
			home: createHome(),
			close,
		});
		const malformedModel: OpenAICompatibleModel = async () =>
			({ choices: [] }) as OpenAIChatCompletionResponse;

		await expect(
			runHomeOpenAICompatibleAgent(malformedModel, "status", {
				runtimeFactory,
			}),
		).rejects.toThrow(/choices must be a non-empty array/);

		expect(close).toHaveBeenCalledTimes(1);
	});

	it("closes an injected runtime session when the Anthropic loop hits MAX_TURNS", async () => {
		const close = vi.fn(async () => {});
		const runtimeFactory = async () => ({
			home: createHome(),
			close,
		});
		const loopingScript: AnthropicResponse[] = Array.from(
			{ length: 12 },
			(_, turn) => ({
				content: [
					{
						type: "tool_use",
						id: `loop-${turn + 1}`,
						name: "status",
						input: {},
					},
				],
			}),
		);

		await expect(
			runHomeAgent(scriptedModel(loopingScript), "keep checking", {
				runtimeFactory,
			}),
		).rejects.toThrow(/MAX_TURNS/);

		expect(close).toHaveBeenCalledTimes(1);
	});

	it("closes an injected runtime session when the OpenAI-compatible loop hits MAX_TURNS", async () => {
		const close = vi.fn(async () => {});
		const runtimeFactory = async () => ({
			home: createHome(),
			close,
		});
		const loopingScript: OpenAIChatCompletionResponse[] = Array.from(
			{ length: 12 },
			(_, turn) => ({
				choices: [
					{
						message: {
							role: "assistant",
							tool_calls: [
								{
									id: `loop-${turn + 1}`,
									type: "function",
									function: {
										name: "status",
										arguments: JSON.stringify({}),
									},
								},
							],
						},
					},
				],
			}),
		);

		await expect(
			runHomeOpenAICompatibleAgent(
				scriptedOpenAICompatibleModel(loopingScript),
				"keep checking",
				{ runtimeFactory },
			),
		).rejects.toThrow(/MAX_TURNS/);

		expect(close).toHaveBeenCalledTimes(1);
	});
});

describe("smart-home agent — actor-web runtime dogfood", () => {
	it("drives an actor-web-backed runtime through the Anthropic loop via an injected runtimeFactory", async () => {
		const script: AnthropicResponse[] = [
			{
				content: [
					{
						type: "tool_use",
						id: "actor-web-1",
						name: "toggleLight",
						input: { room: "living", on: true },
					},
				],
			},
			{
				content: [
					{
						type: "tool_use",
						id: "actor-web-2",
						name: "runScene",
						input: { value: "movie" },
					},
				],
			},
			{
				content: [
					{
						type: "text",
						text: "Living room is ready for movie mode.",
					},
				],
			},
		];

		const result = await runHomeAgent(
			scriptedModel(script),
			"Turn on the living room light, then start movie mode.",
			{ runtimeFactory: createActorWebHomeSession },
		);

		try {
			expect(result.trace.map((entry) => entry.command)).toEqual([
				"toggleLight",
				"runScene",
			]);
			expect(result.trace[0]?.view).toMatchObject({
				lights: { living: true },
				lightsOn: ["living"],
			});
			expect(result.trace[1]).toMatchObject({
				command: "runScene",
				input: "movie",
				ok: true,
				view: {
					activeScene: "movie",
					lights: { living: false },
				},
			});
			expect(result.home.getView()).toMatchObject({
				activeScene: "movie",
				lights: { living: false },
			});
		} finally {
			await result.close();
		}
	});

	it("captures actor-web native emits in command-window observations and explicit runtime listeners", async () => {
		const session = await createActorWebHomeSession();
		const received: Array<{ scene: string }> = [];
		const subscription = session.home.on("scene-applied", (event) => {
			received.push(event.detail as { scene: string });
		});

		try {
			const tools = igniteTools(session.home, anthropic);
			const result = await tools.run({ name: "runScene", input: "movie" });

			expect(isOk(result)).toBe(true);
			if (!isOk(result)) {
				return;
			}

			expect(result.value.view).toMatchObject({
				activeScene: "movie",
				lights: { living: false },
			});
			expect(result.value.events).toContainEqual(
				expect.objectContaining({
					type: "scene-applied",
					payload: expect.objectContaining({ scene: "movie" }),
				}),
			);
			expect(received).toHaveLength(1);
			expect(received[0]).toMatchObject({ scene: "movie" });
		} finally {
			subscription.unsubscribe();
			await session.close();
		}
	});

	it("emits actor-web security changes for individual door updates", async () => {
		const session = await createActorWebHomeSession();
		const received: Array<{ allDoorsLocked: boolean }> = [];
		const subscription = session.home.on("security-changed", (event) => {
			received.push(event.detail as { allDoorsLocked: boolean });
		});

		try {
			const tools = igniteTools(session.home, anthropic);
			const first = await tools.run({ name: "unlockDoor", input: "front" });
			const second = await tools.run({ name: "unlockDoor", input: "back" });

			expect(isOk(first)).toBe(true);
			expect(isOk(second)).toBe(true);
			if (!isOk(first) || !isOk(second)) {
				return;
			}

			expect(first.value.events).toContainEqual(
				expect.objectContaining({
					type: "security-changed",
					payload: expect.objectContaining({ allDoorsLocked: false }),
				}),
			);
			expect(second.value.events).toContainEqual(
				expect.objectContaining({
					type: "security-changed",
					payload: expect.objectContaining({ allDoorsLocked: false }),
				}),
			);
			expect(received).toHaveLength(2);
			expect(received).toEqual([
				expect.objectContaining({ allDoorsLocked: false }),
				expect.objectContaining({ allDoorsLocked: false }),
			]);
		} finally {
			subscription.unsubscribe();
			await session.close();
		}
	});

	it("restarts actor-web delayed scene timing when transitionScene is repeated", async () => {
		vi.useFakeTimers();
		const session = await createActorWebHomeSession();

		try {
			const tools = igniteTools(session.home, anthropic);
			const firstResult = await tools.run({
				name: "transitionScene",
				input: "morning",
			});

			if (!isOk(firstResult)) {
				throw new Error(firstResult.error.kind);
			}

			expect(firstResult.value.view).toMatchObject({
				activeScene: null,
				pendingScene: "morning",
			});

			await vi.advanceTimersByTimeAsync(10);

			const secondResult = await tools.run({
				name: "transitionScene",
				input: "movie",
			});

			if (!isOk(secondResult)) {
				throw new Error(secondResult.error.kind);
			}

			expect(secondResult.value.view).toMatchObject({
				activeScene: null,
				pendingScene: "movie",
			});

			await vi.advanceTimersByTimeAsync(20);

			expect(session.home.getView()).toMatchObject({
				activeScene: null,
				pendingScene: "movie",
			});

			await vi.advanceTimersByTimeAsync(5);

			expect(session.home.getView()).toMatchObject({
				activeScene: "movie",
				pendingScene: null,
				lights: { living: false },
			});
		} finally {
			await session.close();
			vi.useRealTimers();
		}
	});

	it("cancels pending actor-web transition timers when the session closes", async () => {
		vi.useFakeTimers();
		const session = await createActorWebHomeSession();
		let closed = false;

		try {
			const tools = igniteTools(session.home, anthropic);
			const timerCountBeforeTransition = vi.getTimerCount();
			const result = await tools.run({
				name: "transitionScene",
				input: "movie",
			});

			if (!isOk(result)) {
				throw new Error(result.error.kind);
			}

			expect(result.value.view).toMatchObject({
				activeScene: null,
				pendingScene: "movie",
			});
			expect(vi.getTimerCount()).toBeGreaterThan(timerCountBeforeTransition);

			await session.close();
			closed = true;
			expect(vi.getTimerCount()).toBeLessThanOrEqual(
				timerCountBeforeTransition,
			);

			await vi.advanceTimersByTimeAsync(SCENE_TRANSITION_DELAY_MS + 1);
			expect(session.home.getView()).toMatchObject({
				activeScene: null,
				pendingScene: "movie",
			});
		} finally {
			if (!closed) {
				await session.close();
			}
			vi.useRealTimers();
		}
	});
});

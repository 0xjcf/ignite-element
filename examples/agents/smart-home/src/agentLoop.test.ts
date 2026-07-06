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
import { runHomeAgent, runHomeOpenAICompatibleAgent } from "./agentLoop";
import { createHome, DOORS, ROOMS, SCENES } from "./home";
import {
	type Model,
	openAICompatibleModel,
	scriptedModel,
	scriptedOpenAICompatibleModel,
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
				pendingScene: "morning",
				thermostat: { living: 69 },
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
	});

	it("posts a Chat Completions request with tools using injected fake fetch", async () => {
		const response: OpenAIChatCompletionResponse = {
			choices: [{ message: { content: "No tools needed." } }],
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
			tools: [],
		});
	});

	it("fails with MLX setup guidance when the local server is unreachable", async () => {
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
		).rejects.toThrow(/mlx_lm\.server/);
	});
});

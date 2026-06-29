// @vitest-environment node
//
// Phase B's dogfood, key-free and headless: a scripted "model" drives a real
// ignite smart-home through the igniteTools + Anthropic loop in PURE NODE (no
// jsdom). This is the end-to-end proof of the DOM-free agent runtime (Phase A)
// AND a stress test of the agent API surface — varied command input schemas,
// the Option D scalar round-trip, the event observation stream, and errors-as-
// values — encoded as always-on assertions.
import { igniteTools } from "ignite-element/tools";
import {
	type AnthropicResponse,
	anthropic,
} from "ignite-element/tools/anthropic";
import { describe, expect, it } from "vitest";
import { runHomeAgent } from "./agentLoop";
import { createHome, DOORS, ROOMS, SCENES } from "./home";
import { type Model, scriptedModel } from "./model";

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

	it("object-wraps a scalar enum command under `value` (Option D)", () => {
		expect(byName("lockDoor")?.input_schema).toMatchObject({
			type: "object",
			properties: { value: { type: "string", enum: [...DOORS] } },
			required: ["value"],
		});
		expect(byName("runScene")?.input_schema).toMatchObject({
			properties: { value: { type: "string", enum: [...SCENES] } },
		});
	});

	it("emits an empty-object schema for a no-arg command", () => {
		expect(byName("status")?.input_schema).toEqual({
			type: "object",
			properties: {},
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

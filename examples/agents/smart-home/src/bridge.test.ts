// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
	applyBridgeMessage,
	createCommandMessage,
	type HomeBridgeMessage,
} from "./bridge";
import type { HomeView } from "./render";

const view = (overrides: Partial<HomeView> = {}): HomeView => ({
	activeScene: null,
	allDoorsLocked: true,
	blinds: { living: 0, bedroom: 0, kitchen: 0 },
	lights: { living: false, bedroom: false, kitchen: false },
	lightsOn: [],
	locks: { front: true, back: true, garage: true },
	pendingScene: null,
	thermostat: { living: 68, bedroom: 68, kitchen: 68 },
	...overrides,
});

describe("smart-home terminal/browser bridge protocol", () => {
	it("applies server view and event broadcasts in order", () => {
		const first = view();
		const second = view({
			lights: { living: true, bedroom: false, kitchen: false },
			lightsOn: ["living"],
		});

		const messages: HomeBridgeMessage[] = [
			{ type: "home:view", view: first },
			{
				type: "home:event",
				event: {
					type: "light-changed",
					payload: { room: "living", on: true },
				},
				view: second,
			},
		];

		const state = messages.reduce(applyBridgeMessage, undefined);

		expect(state).toMatchObject({
			connected: true,
			lastEvent: {
				type: "light-changed",
				payload: { room: "living", on: true },
			},
			view: second,
		});
	});

	it("wraps browser commands for the shared headless runtime", () => {
		expect(
			createCommandMessage("toggleLight", { room: "kitchen", on: true }),
		).toEqual({
			type: "home:command",
			command: "toggleLight",
			input: { room: "kitchen", on: true },
		});
	});
});

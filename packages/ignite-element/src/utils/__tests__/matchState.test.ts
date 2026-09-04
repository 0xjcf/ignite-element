import { describe, expect, expectTypeOf, it } from "vitest";
import { createActor, createMachine } from "xstate";
import { matchState } from "../matchState";

describe("matchState", () => {
	it("matches the first key", () => {
		const machine = createMachine({
			initial: "idle",
			states: {
				idle: {},
				connected: {},
				error: {},
			},
		});
		const actor = createActor(machine);
		actor.start();

		const snapshot = actor.getSnapshot();
		const result = matchState(
			snapshot,
			{
				idle: "idle",
				error: "error",
			},
			"fallback",
		);

		expect(result).toBe("idle");
		actor.stop();
	});

	it("matches a later key", () => {
		const machine = createMachine({
			initial: "idle",
			states: {
				idle: {
					on: { CONNECT: "connected" },
				},
				connected: {},
				error: {},
			},
		});
		const actor = createActor(machine);
		actor.start();
		actor.send({ type: "CONNECT" });

		const snapshot = actor.getSnapshot();
		const result = matchState(
			snapshot,
			{
				idle: "idle",
				connected: "ready",
			},
			"fallback",
		);

		expect(result).toBe("ready");
		actor.stop();
	});

	it("returns fallback when none match", () => {
		const machine = createMachine({
			initial: "idle",
			states: {
				idle: {},
				error: {},
			},
		});
		const actor = createActor(machine);
		actor.start();

		const snapshot = actor.getSnapshot();
		const result = matchState(snapshot, { error: "error" }, "idle");

		expect(result).toBe("idle");
		actor.stop();
	});

	it("supports nested string patterns", () => {
		const machine = createMachine({
			initial: "auth",
			states: {
				auth: {
					initial: "loggedOut",
					states: {
						loggedOut: {
							on: { LOGIN: "loggedIn" },
						},
						loggedIn: {},
					},
				},
			},
		});

		const actor = createActor(machine);
		actor.start();
		actor.send({ type: "LOGIN" });

		const snapshot = actor.getSnapshot();
		const result = matchState(
			snapshot,
			{
				"auth.loggedOut": "out",
				"auth.loggedIn": "in",
			},
			"out",
		);

		expect(result).toBe("in");
		actor.stop();
	});

	it("preserves return type unions", () => {
		const machine = createMachine({
			initial: "idle",
			states: {
				idle: {},
				error: {},
			},
		});
		const actor = createActor(machine);
		actor.start();

		const snapshot = actor.getSnapshot();
		const cases = { idle: "idle", error: "error" } as const;
		const fallback = "unknown" as const;
		const result = matchState(snapshot, cases, fallback);

		expectTypeOf(result).toEqualTypeOf<"idle" | "error" | "unknown">();
		actor.stop();
	});
});

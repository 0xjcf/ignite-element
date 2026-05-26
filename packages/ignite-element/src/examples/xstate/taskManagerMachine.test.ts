import { createActor } from "xstate";
import { describe, expect, it } from "vitest";
import { taskManagerMachine } from "./taskManagerMachine";

describe("taskManagerMachine", () => {
	it("treats invalid toggle indexes as referentially stable no-ops", () => {
		const actor = createActor(taskManagerMachine);
		actor.start();

		const before = actor.getSnapshot().context.tasks;

		actor.send({ type: "TOGGLE", index: -1 });
		expect(actor.getSnapshot().context.tasks).toBe(before);

		actor.send({ type: "TOGGLE", index: before.length });
		expect(actor.getSnapshot().context.tasks).toBe(before);

		actor.stop();
	});
});

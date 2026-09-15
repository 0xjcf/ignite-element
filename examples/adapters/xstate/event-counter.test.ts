import { afterAll, expect, it } from "vitest";
import { core, counterActor, notifications } from "./event-counter";

afterAll(() => {
	core.dispose();
	counterActor.stop();
});
it("distinguishes reset occurrences from state comparisons", async () => {
	await core.execute({ command: "increment" });
	await core.execute({ command: "reset" });
	await core.execute({ command: "reset" });
	expect(
		notifications
			.filter((event) => event.type === "countChanged")
			.map((event) => event.count),
	).toEqual([1, 0]);
	expect(
		notifications
			.filter((event) => event.type === "counterReset")
			.map((event) => event.count),
	).toEqual([0, 0]);
});

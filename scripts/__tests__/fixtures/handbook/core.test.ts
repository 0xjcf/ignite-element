import { expect, it } from "vitest";
import { core, source } from "./redux";

it("pairs native snapshots with states and observes external source changes", async () => {
	const seen: number[] = [];
	try {
		const subscription = core.watch((next) => seen.push(next.count));
		const result = await core.execute({ command: "increment" });
		expect(result.snapshot.count).toBe(1);
		expect(result.states.count).toBe(1);
		expect(result.events).toEqual([]);
		source.dispatch({ type: "counter/increment" });
		expect(seen).toEqual([1, 2]);
		subscription.unsubscribe();
		source.dispatch({ type: "counter/increment" });
		expect(seen).toEqual([1, 2]);
	} finally {
		core.dispose();
	}
});

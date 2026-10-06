import { expect, it } from "vitest";
import { core, source } from "./redux";

it("reads projected states and observes external source changes", async () => {
	const seen: number[] = [];
	try {
		const subscription = core.watch((next) => seen.push(next.count));
		const result = await core.execute({ command: "increment" });
		expect(result).toBeUndefined();
		expect(core.get("states").count).toBe(1);
		source.dispatch({ type: "counter/increment" });
		// Subscribe delivers the current count (0), then each later change.
		expect(seen).toEqual([0, 1, 2]);
		subscription.unsubscribe();
		source.dispatch({ type: "counter/increment" });
		expect(seen).toEqual([0, 1, 2]);
	} finally {
		core.dispose();
	}
});

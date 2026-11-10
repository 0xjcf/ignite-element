// @vitest-environment node
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { assign, createActor, createMachine } from "xstate";
import { igniteCore } from "../xstate";

const parameters = { seed: 1801028, numRuns: 100 };
describe("borrowed source cleanup property", () => {
	it("releasing observations and disposing a core never stops a borrowed source", () => {
		fc.assert(
			fc.property(fc.array(fc.boolean(), { maxLength: 30 }), (deliveries) => {
				const source = createActor(
					createMachine({
						context: { count: 0 },
						on: {
							NEXT: {
								actions: assign({ count: ({ context }) => context.count + 1 }),
							},
						},
					}),
				).start();
				const stop = vi.spyOn(source, "stop");
				const core = igniteCore({
					source,
					states: (snapshot) => ({ count: snapshot.context.count }),
				});
				const listener = vi.fn();
				const subscription = core.watch(listener);
				for (const connected of deliveries) {
					if (!connected) subscription.unsubscribe();
					source.send({ type: "NEXT" });
				}
				subscription.unsubscribe();
				const calls = listener.mock.calls.length;
				core.dispose();
				source.send({ type: "NEXT" });
				expect(listener).toHaveBeenCalledTimes(calls);
				expect(source.getSnapshot().context.count).toBe(deliveries.length + 1);
				expect(stop).not.toHaveBeenCalled();
				source.stop();
			}),
			parameters,
		);
	});
});

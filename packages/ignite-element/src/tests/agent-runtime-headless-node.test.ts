// @vitest-environment node
//
// The headless agent runtime must be DOM-free: getSchema()/execute()/on()/
// watchView() have to work in pure Node (no jsdom). Before the createRuntimeHost
// fix these threw "document is not defined" via createRuntimeHost ->
// document.createElement. This file runs in the `node` environment (overriding
// the package's global jsdom) so it would fail without a genuinely DOM-free
// runtime. The DOM render path is intentionally not exercised here — it still
// requires a real DOM.
import { describe, expect, it, vi } from "vitest";
import { assign, setup } from "xstate";
import { igniteCore } from "../xstate";

function createCounter() {
	const machine = setup({
		types: {
			context: {} as { count: number },
			events: {} as { type: "INC" },
		},
	}).createMachine({
		id: "headless-counter",
		context: { count: 0 },
		initial: "active",
		states: {
			active: {
				on: {
					INC: {
						actions: assign({ count: ({ context }) => context.count + 1 }),
					},
				},
			},
		},
	});

	return igniteCore({
		source: machine,
		events: (event) => ({ counted: event<{ count: number }>() }),
		view: ({ snapshot }) => ({ count: snapshot.context.count }),
		commands: ({ actor }) => ({
			increment: () => actor.send({ type: "INC" }),
		}),
		effects: ({ emit, select }) => {
			const count = select((state) => state.context.count);
			if (count.changed) {
				emit("counted", { count: count.current });
			}
		},
	});
}

describe("agent runtime is DOM-free (pure Node, no jsdom)", () => {
	it("runs in an environment with no document", () => {
		expect(typeof document).toBe("undefined");
	});

	it("getSchema() builds the manifest without a DOM", () => {
		const counter = createCounter();
		const schema = counter.getSchema();
		expect(Object.keys(schema.commands)).toContain("increment");
		expect(schema.events).toContain("counted");
		expect(schema.view).toMatchObject({ count: 0 });
	});

	it("execute() runs a command and returns the post-ack snapshot + events", async () => {
		const counter = createCounter();
		const result = await counter.execute("increment");
		expect(result.state.context.count).toBe(1);
		expect(result.events).toEqual([{ type: "counted", payload: { count: 1 } }]);
	});

	it("on() receives effect-emitted events via the host EventTarget", async () => {
		const counter = createCounter();
		const handler = vi.fn();
		const subscription = counter.on("counted", handler);

		await counter.execute("increment");

		expect(handler).toHaveBeenCalledTimes(1);
		const event = handler.mock.calls[0][0] as CustomEvent<{ count: number }>;
		expect(event.detail).toEqual({ count: 1 });
		subscription.unsubscribe();
	});

	it("watchView()/getView() observe the derived view without a DOM", async () => {
		const counter = createCounter();
		const seen: Array<{ count: number }> = [];
		const subscription = counter.watchView((view) => seen.push(view));

		await counter.execute("increment");

		expect(counter.getView()).toEqual({ count: 1 });
		expect(seen[seen.length - 1]).toEqual({ count: 1 });
		subscription.unsubscribe();
	});
});

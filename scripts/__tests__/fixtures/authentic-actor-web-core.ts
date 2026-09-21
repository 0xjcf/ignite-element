import { createActorSource } from "@actor-web/runtime/source";
import { igniteCore } from "ignite-element/actor-web";

type Context = { count: number };
type Message = { type: "add"; amount: number };
export function createCore(
	ref: Parameters<typeof createActorSource<Context, Message>>[0],
) {
	const source = createActorSource(ref);
	const core = igniteCore({
		source,
		states: (snapshot) => ({ count: snapshot.context.count }),
		commands: ({ source: actor }) => ({
			add: (amount: number) => actor.send({ type: "add", amount }),
		}),
		events: (event) => ({ changed: event<{ count: number }>() }),
	});
	const count: number = core.get("states").count;
	core.watch((next, previous) => {
		const delta: number = next.count - previous.count;
		void delta;
	});
	core.on("changed", (fact) => {
		const value: number = fact.count;
		void value;
	});
	const execution = core.execute({ command: "add", input: 1 });
	void execution.then((result) => {
		// @ts-expect-error The command acknowledgement is not a native snapshot receipt.
		void result.snapshot;
		// @ts-expect-error Projected state requires an explicit read.
		void result.states;
		// @ts-expect-error Events require explicit subscriptions.
		void result.events;
	});
	// @ts-expect-error Authentic source-backed command input stays inferred.
	core.execute({ command: "add", input: "bad" });
	// @ts-expect-error Authentic source context is not erased to an untyped substitute.
	source.snapshot().context.missing;
	void count;
	return core;
}

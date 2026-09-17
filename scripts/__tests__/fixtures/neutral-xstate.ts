import { igniteCore } from "ignite-element/xstate";
import { createActor, createMachine } from "xstate";

const source = createActor(
	createMachine({
		types: {} as {
			context: { count: number };
			events: { type: "ADD"; amount: number };
		},
		context: { count: 0 },
	}),
).start();
const core = igniteCore({
	source,
	states: (snapshot) => ({ count: snapshot.context.count }),
	commands: ({ source: actor }) => ({
		add: (amount: number) => actor.send({ type: "ADD", amount }),
		multi: (a: number, b: number) => a + b,
	}),
	events: (event) => ({ changed: event<{ count: number }>() }),
});
source.getSnapshot().context.count;
// @ts-expect-error Multiple required positional arguments are not serialized input.
core.execute({ command: "multi", input: 2 });

// @ts-expect-error Removed helper export.
import { command } from "@ignite-element/core";

void command;
source.stop();

const count: number = core.get("states").count;
core.watch((next, previous) => {
	const delta: number = next.count - previous.count;
	void delta;
});
core.on("changed", (fact) => {
	const value: number = fact.count;
	void value;
});
core.execute({ command: "add", input: 2 });
// @ts-expect-error Invalid command input.
core.execute({ command: "add", input: "bad" });
// @ts-expect-error Invalid outward event.
core.on("missing", () => {});
// @ts-expect-error No zero-argument read.
core.get();
// @ts-expect-error No raw snapshot read key.
core.get("snapshot");
// @ts-expect-error Removed public getter.
core.getStates();
// @ts-expect-error Removed public schema getter.
core.getSchema();
// @ts-expect-error Removed helper-dependent query.
core.canExecute("add");
// @ts-expect-error Removed public raw observation.
core.watchSnapshot(() => {});
void count;
core.dispose();

// @ts-expect-error No public owned-source descriptor type.
import type { OwnedSource } from "@ignite-element/core";

// @ts-expect-error XState does not accept a source-construction function.
igniteCore({ source: () => source });
// @ts-expect-error XState does not accept an ownership descriptor.
igniteCore({ source: { create: () => source, dispose: () => source.stop() } });
const registration = core("compile-only-counter", (ctx) => ctx.count);
// @ts-expect-error Registration handles cannot rebind another runtime.
registration.bind(core);

// Compile-only migration guards: the removed property is not a compatibility API.
function commandContextContract() {
	igniteCore({
		source,
		// @ts-expect-error Commands expose source, not actor.
		commands: ({ actor }) => ({
			add: () => actor.send({ type: "ADD", amount: 1 }),
		}),
	});
	igniteCore({
		source,
		commands: ({ source }) => ({
			invalidMethod: () => {
				// @ts-expect-error XState capabilities are unchanged by the rename.
				source.dispatch({ type: "ADD", amount: 1 });
			},
		}),
	});
}
void commandContextContract;

import {
	type ActorWebCommandSource,
	igniteCore,
} from "ignite-element/actor-web";

declare const source: ActorWebCommandSource<
	{ count: number },
	{ type: "ADD"; amount: number },
	{ type: "changed"; count: number }
>;
const core = igniteCore({
	source,
	states: (snapshot) => ({ count: snapshot.context.count }),
	commands: ({ actor }) => ({
		add: (amount: number) => actor.send({ type: "ADD", amount }),
	}),
});
// @ts-expect-error Required host context is not a no-host source factory.
igniteCore({ source: (_context: { host: object }) => source });
// @ts-expect-error Inferable state-command collision.
igniteCore({
	source,
	states: (snapshot) => ({ add: snapshot.context.count }),
	commands: () => ({ add: () => 1 }),
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

const emittingSource = {
	address: "native",
	snapshot: () => ({
		address: "native",
		context: { count: 0 },
		phase: "active",
		toJSON: () => ({}),
	}),
	subscribe: () => () => {},
	subscribeEvent:
		(_listener: (event: { type: "reset"; count: number }) => void) => () => {},
};
igniteCore({
	source: emittingSource,
	events: (event) => ({
		reset: event<{ count: number }>(),
		changed: event<{ count: number }>(),
	}),
	effects: ({ emit }) => {
		emit({ type: "changed", count: 1 });
		// @ts-expect-error A present precise outward channel reserves this event.
		emit({ type: "reset", count: 0 });
	},
});

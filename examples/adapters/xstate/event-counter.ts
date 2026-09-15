import { igniteCore } from "ignite-element/xstate";
import { assign, createActor, emit, setup } from "xstate";

export const counterMachine = setup({
	types: {
		context: {} as { count: number },
		events: {} as { type: "INCREMENT" } | { type: "RESET" },
		emitted: {} as { type: "counterReset"; count: number },
	},
}).createMachine({
	context: { count: 0 },
	on: {
		INCREMENT: {
			actions: assign({ count: ({ context }) => context.count + 1 }),
		},
		RESET: {
			actions: [
				assign({ count: 0 }),
				emit(({ context }) => ({ type: "counterReset", count: context.count })),
			],
		},
	},
});

// The application creates, starts and eventually stops its borrowed source.
export const counterActor = createActor(counterMachine).start();
export const core = igniteCore({
	source: counterActor,
	states: (snapshot) => ({ count: snapshot.context.count }),
	commands: ({ actor }) => ({
		increment: () => actor.send({ type: "INCREMENT" }),
		reset: () => actor.send({ type: "RESET" }),
	}),
	events: (event) => ({
		countChanged: event<{ count: number }>(),
		counterReset: event<{ count: number }>(),
	}),
	effects: ({ select, emit }) => {
		const count = select((snapshot) => snapshot.context.count);
		if (count.changed) emit({ type: "countChanged", count: count.current });
	},
});

// Subscribe before issuing commands. execute().events is a capture window,
// not correlation with a durable business operation.
export const notifications: { type: string; count: number }[] = [];
core.on("countChanged", (event) => notifications.push(event));
core.on("counterReset", (event) => notifications.push(event));

// At application shutdown: core.dispose(); counterActor.stop();
// Terminal disposal owns the two subscriptions; no redundant unsubscribe pair.

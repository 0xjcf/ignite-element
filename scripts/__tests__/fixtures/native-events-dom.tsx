/** @jsxImportSource ignite-element/jsx */
import { igniteCore as eventCore } from "ignite-element/xstate";
import { igniteReact } from "ignite-element/react/web";
import { createElement as reactElement } from "react";
import {
	assign,
	createActor as eventActor,
	emit as nativeEmit,
	setup,
} from "xstate";

const eventMachine = setup({
	types: {
		context: {} as { count: number },
		events: {} as { type: "INCREMENT" } | { type: "RESET" },
		emitted: {} as
			| { type: "counterReset"; count: number }
			| { type: "private" },
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
				nativeEmit(({ context }) => ({
					type: "counterReset",
					count: context.count,
				})),
			],
		},
	},
});
const eventSource = eventActor(eventMachine).start();
const eventController = eventCore({
	source: eventSource,
	states: (s) => ({ count: s.context.count }),
	commands: ({ actor }) => ({
		increment: () => actor.send({ type: "INCREMENT" }),
		reset: () => actor.send({ type: "RESET" }),
	}),
	events: (e) => ({
		counterReset: e<{ count: number }>(),
		countChanged: e<{ count: number }>(),
	}),
	effects: ({ select, emit }) => {
		const count = select((s) => s.context.count);
		if (count.changed) emit({ type: "countChanged", count: count.current });
		// @ts-expect-error Native producer is reserved, despite the valid declaration.
		emit({ type: "counterReset", count: 0 });
	},
});
const EventElement = eventController("app-event-counter", (ctx) => (
	<div>
		<span>{ctx.count}</span>
		<button type="button" onClick={() => ctx.increment()}>
			Increment
		</button>
		<button type="button" onClick={() => ctx.reset()}>
			Reset
		</button>
	</div>
));
const EventCounter = igniteReact(EventElement);
export const eventReactView = reactElement(EventCounter, {
	onCountChanged: (detail) => {
		const n: number = detail.count;
		void n;
	},
	onCounterReset: (detail) => {
		const n: number = detail.count;
		void n;
	},
});
eventController.on("counterReset", (event) => {
	const n: number = event.count;
	void n;
});
eventCore({
	source: eventMachine,
	// @ts-expect-error The native payload is number, not string.
	events: (e) => ({ counterReset: e<{ count: string }>() }),
});
eventController.dispose();
eventSource.stop();

// Compile-only coverage against packed declarations; no startup or execution.
export function checkCombinedNativeMembers() {
	const machine = setup({
		types: { emitted: {} as { type: "first" | "second"; count: number } },
	}).createMachine({});
	const core = eventCore({
		source: machine,
		commands: ({ actor }) => ({ run: () => actor.send({ type: "RUN" }) }),
	});
	core.on("first", (event) => {
		const type: "first" = event.type;
		const count: number = event.count;
		void type;
		void count;
	});
	core.on("second", (event) => {
		const type: "second" = event.type;
		const count: number = event.count;
		void type;
		void count;
	});
	void core.execute({ command: "run" }).then(({ events }) => {
		for (const event of events) {
			const count: number = event.count;
			void count;
		}
	});
	eventCore({
		source: machine,
		// @ts-expect-error A combined native discriminator retains numeric payloads.
		events: (event) => ({ second: event<{ count: string }>() }),
	});
}

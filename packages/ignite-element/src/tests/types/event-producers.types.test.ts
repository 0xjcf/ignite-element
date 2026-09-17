import { expect, it } from "vitest";
import {
	type AnyStateMachine,
	createActor,
	createMachine,
	emit,
	setup,
} from "xstate";
import { igniteCore as actorCore } from "../../actor-web";
import { igniteCore as rootCore } from "../../IgniteCore";
import { igniteCore } from "../../xstate";

const machine = setup({
	types: {
		context: {} as { count: number },
		events: {} as { type: "RESET" } | { type: "inputOnly" },
		emitted: {} as
			| { type: "counterReset"; count: number }
			| { type: "private" },
	},
}).createMachine({
	context: { count: 0 },
	on: { RESET: { actions: emit({ type: "counterReset", count: 0 }) } },
});
function check() {
	const variants = setup({
		types: {
			emitted: {} as
				| { type: "first" | "second"; count: number }
				| { type: "first"; label: string },
		},
	}).createMachine({});
	const variantsCore = igniteCore({ source: variants });
	variantsCore.on("first", (event) => {
		const type: "first" = event.type;
		if ("count" in event) {
			const count: number = event.count;
			void count;
		} else {
			const label: string = event.label;
			void label;
		}
		void type;
	});
	igniteCore({
		source: variants,
		// @ts-expect-error The declaration must accept every variant of first.
		events: (event) => ({ first: event<{ count: number }>() }),
	});
	const combined = setup({
		types: { emitted: {} as { type: "first" | "second"; count: number } },
	}).createMachine({});
	igniteCore({
		source: combined,
		// @ts-expect-error A union-valued discriminator still carries a numeric payload.
		events: (event) => ({ first: event<{ count: string }>() }),
	});
	igniteCore({
		source: machine,
		events: (event) => ({
			counterReset: event<{ type: "counterReset"; count: number }>(),
		}),
	});
	for (const source of [machine, createActor(machine)] as const) {
		const core = igniteCore({
			source,
			states: (s) => ({ count: s.context.count }),
			commands: ({ source: actor }) => ({
				reset: () => actor.send({ type: "RESET" }),
			}),
			events: (e) => ({
				counterReset: e<{ count: number }>(),
				countChanged: e<{ count: number }>(),
				inputOnly: e<{ ok: boolean }>(),
			}),
			effects: ({ emit }) => {
				emit({ type: "countChanged", count: 1 });
				emit({ type: "inputOnly", ok: true });
				// @ts-expect-error native names belong to the source, even when declared
				emit({ type: "counterReset", count: 0 });
				// @ts-expect-error effect payload stays inferred
				emit({ type: "countChanged", count: "bad" });
			},
		});
		core("type-counter", (ctx) => {
			const count: number = ctx.count;
			const reset: () => void = ctx.reset;
			void count;
			void reset;
			return null;
		});
		core.on("counterReset", (event) => {
			const count: number = event.count;
			void count;
		});
		core.on("private", (event) => {
			const type: "private" = event.type;
			void type;
		});
		core.execute({ command: "reset" });
		const root = rootCore({
			source,
			states: (snapshot) => ({ count: snapshot.context.count }),
			commands: ({ source: actor }) => ({
				reset: () => actor.send({ type: "RESET" }),
			}),
			events: (event) => ({
				counterReset: event<{ count: number }>(),
				changed: event<{ count: number }>(),
			}),
			effects: ({ emit }) => {
				emit({ type: "changed", count: 1 });
				// @ts-expect-error Root entry also reserves actual native names.
				emit({ type: "counterReset", count: 1 });
			},
		});
		root("type-root-counter", (ctx) => {
			const count: number = ctx.count;
			ctx.reset();
			void count;
			return null;
		});
		root.on("private", (event) => {
			const type: "private" = event.type;
			void type;
		});
		root.execute({ command: "reset" });
	}
	for (const core of [
		igniteCore({
			source: combined,
			commands: ({ source: actor }) => ({
				run: () => actor.send({ type: "RUN" }),
			}),
		}),
		rootCore({
			source: combined,
			commands: ({ source: actor }) => ({
				run: () => actor.send({ type: "RUN" }),
			}),
		}),
	]) {
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
		void core.execute({ command: "run" }).then((result) => {
			for (const event of result.events) {
				if (event.type === "first") {
					const type: "first" = event.type;
					const count: number = event.count;
					void type;
					void count;
				}
				if (event.type === "second") {
					const type: "second" = event.type;
					const count: number = event.count;
					void type;
					void count;
				}
			}
		});
	}
	igniteCore({
		source: combined,
		events: (event) => ({
			first: event<{ count: number }>(),
			second: event<{ count: number }>(),
			changed: event<{ count: number }>(),
		}),
		effects: ({ emit }) => {
			emit({ type: "changed", count: 1 });
			// @ts-expect-error Both names of the native member are reserved.
			emit({ type: "first", count: 1 });
			// @ts-expect-error Both names of the native member are reserved.
			emit({ type: "second", count: 1 });
		},
	});
	igniteCore({
		source: machine,
		// @ts-expect-error declaration must accept the native payload without type
		events: (e) => ({ counterReset: e<{ count: string }>() }),
	});
	igniteCore({
		source: machine,
		events: (e) => ({ counterReset: e<{ count: number | string }>() }),
	});
	const broad: AnyStateMachine = machine;
	igniteCore({
		source: broad,
		events: (e) => ({ allowed: e<{ n: number }>() }),
		effects: ({ emit }) => {
			emit({ type: "allowed", n: 1 });
		},
	});
	igniteCore({
		source: createMachine({}),
		events: (e) => ({ allowed: e<{ n: number }>() }),
		effects: ({ emit }) => {
			emit({ type: "allowed", n: 1 });
		},
	});
	const equal = setup({
		types: {
			events: {} as { type: "reset" },
			emitted: {} as { type: "reset" },
		},
	}).createMachine({});
	const equalCore = igniteCore({
		source: equal,
		events: (e) => ({ reset: e() }),
		effects: ({ emit }) => {
			// @ts-expect-error An outward union equal to the input union still reserves its names.
			emit({ type: "reset" });
		},
	});
	equalCore.on("reset", (event) => {
		const name: "reset" = event.type;
		void name;
	});
	const nativeSource = {
		address: "typed",
		snapshot: () => ({
			address: "typed",
			context: { count: 0 },
			phase: "active",
			toJSON: () => ({}),
		}),
		subscribe: () => () => {},
		subscribeEvent:
			(
				_listener: (
					event: { type: "reset"; count: number } | { type: "private" },
				) => void,
			) =>
			() => {},
	};
	actorCore({
		source: nativeSource,
		states: (s) => ({ count: s.context.count }),
		events: (e) => ({
			reset: e<{ count: number }>(),
			changed: e<{ count: number }>(),
		}),
		effects: ({ emit }) => {
			emit({ type: "changed", count: 0 });
			// @ts-expect-error A required, precise outward channel establishes the native name.
			emit({ type: "reset", count: 0 });
		},
	});
	actorCore({
		source: nativeSource,
		// @ts-expect-error Public payload must accept the actual channel payload.
		events: (e) => ({ reset: e<{ count: string }>() }),
	});
}
it("compiles inferred producer restrictions without executing invalid examples", () => {
	expect(check).toBeTypeOf("function");
});

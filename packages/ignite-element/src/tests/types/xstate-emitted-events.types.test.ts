import { describe, expectTypeOf, it } from "vitest";
import { assign, createMachine, emit, setup } from "xstate";
import { igniteCore } from "../../IgniteCore";
import { igniteCore as subpathIgniteCore } from "../../xstate";

/**
 * The Emitted→Events typing thread for the xstate adapter. A machine that
 * declares `emitted` types surfaces those events on `on()` /
 * `execute().events` with NO manual type arguments on the `igniteCore` call,
 * mirroring the actor-web thread. A machine with no declared `emitted` types
 * (XState defaults `TEmitted` to the broad `EventObject`) must contribute
 * nothing — no string index signature on the events map.
 */

const emittingMachine = setup({
	types: {
		context: {} as { count: number },
		events: {} as { type: "INC" },
		emitted: {} as
			| { type: "count-changed"; count: number }
			| { type: "limit-reached" },
	},
}).createMachine({
	context: { count: 0 },
	on: {
		INC: {
			actions: [
				assign({ count: ({ context }) => context.count + 1 }),
				emit(({ context }) => ({
					type: "count-changed" as const,
					count: context.count,
				})),
			],
		},
	},
});

const plainMachine = createMachine({
	context: { count: 0 },
	on: {
		INC: {
			actions: assign({
				count: ({ context }) => (context as { count: number }).count + 1,
			}),
		},
	},
});

// Compile-time only: tsc checks this function body (including the
// `@ts-expect-error`), but it is never invoked at runtime.
async function _typeAssertions() {
	// No igniteCore<...> type arguments and no `events:` map.
	const register = igniteCore({
		source: emittingMachine,
		states: (snapshot) => ({ count: snapshot.context.count }),
		commands: ({ actor }) => ({
			increment: () => actor.send({ type: "INC" }),
		}),
	});

	// on() accepts emitted event names, with the payload typed to the member.
	register.on("count-changed", (event) => {
		expectTypeOf(event).toEqualTypeOf<{
			type: "count-changed";
			count: number;
		}>();
	});
	register.on("limit-reached", (event) => {
		expectTypeOf(event).toEqualTypeOf<{ type: "limit-reached" }>();
	});

	// @ts-expect-error — a name that is neither declared nor emitted is rejected.
	register.on("not-an-event", () => {});

	// A machine with no declared emitted types contributes nothing: the broad
	// EventObject default must not open the events map to arbitrary strings.
	const plainRegister = igniteCore({
		source: plainMachine,
		commands: ({ actor }) => ({
			increment: () => actor.send({ type: "INC" }),
		}),
	});

	// @ts-expect-error — no declared events and no emitted union: nothing to listen to.
	plainRegister.on("anything", () => {});

	// The adapter subpath entry (`ignite-element/xstate`) must thread emitted
	// types into `on()` exactly like the bare `ignite-element` entry above —
	// this is the path every example and consumer actually imports.
	const subpathRegister = subpathIgniteCore({
		source: emittingMachine,
		states: (snapshot) => ({ count: snapshot.context.count }),
		commands: ({ actor }) => ({
			increment: () => actor.send({ type: "INC" }),
		}),
	});
	subpathRegister.on("count-changed", (event) => {
		expectTypeOf(event).toEqualTypeOf<{
			type: "count-changed";
			count: number;
		}>();
	});
	// @ts-expect-error — unknown emitted name is still rejected on the subpath entry.
	subpathRegister.on("not-an-event", () => {});
}

describe("xstate emitted-event typing thread", () => {
	it("typechecks (assertions are compile-time only)", () => {
		expectTypeOf(_typeAssertions).toBeFunction();
	});
});

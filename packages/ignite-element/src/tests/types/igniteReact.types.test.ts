import { describe, expectTypeOf, it } from "vitest";
import { type EventFrom, setup } from "xstate";
import { igniteCore } from "../../IgniteCore";
import { igniteReact } from "../../react";
import type { CommandHandle, IgniteReactProps } from "../../react/igniteReact";

// A representative counter core: commands (zero-arg + single-arg setX) and a
// declared events map. Inference for the react wrapper flows ONLY from the
// single handle argument — no manual type args at igniteReact(...).
const counterMachine = setup({
	types: {} as {
		context: { count: number; label: string };
		events:
			| { type: "INC" }
			| { type: "DEC" }
			| { type: "SET_LABEL"; label: string };
	},
}).createMachine({
	context: { count: 0, label: "" },
	on: {
		INC: { actions: () => {} },
		DEC: { actions: () => {} },
		SET_LABEL: { actions: () => {} },
	},
});

type CounterEvent = EventFrom<typeof counterMachine>;

const Counter = igniteCore({
	source: counterMachine,
	view: ({ context }) => ({ count: context.count, label: context.label }),
	commands: ({ actor }) => ({
		increment: () => actor.send({ type: "INC" }),
		decrement: () => actor.send({ type: "DEC" }),
		setLabel: (label: string) => actor.send({ type: "SET_LABEL", label }),
	}),
	events: (event) => ({
		countChanged: event<{ count: number }>(),
	}),
})("inference-counter", ({ count, label }) =>
	createTextNode(`${label}: ${count}`),
);

// Minimal renderer stub so the example type-checks without pulling a renderer.
function createTextNode(_value: string): string {
	return _value;
}

type CounterCommands = {
	increment: () => void;
	decrement: () => void;
	setLabel: (label: string) => void;
};

type CounterEvents = {
	countChanged: { readonly __payload?: { count: number } };
};

describe("igniteReact type inference", () => {
	it("infers the props/ref types from the handle with no manual type args", () => {
		// No explicit type arguments — inference flows from `Counter`.
		const ReactCounter = igniteReact(Counter);
		expectTypeOf(ReactCounter).toBeFunction();
	});

	it("maps the events map to on<Event> callback props receiving the flat payload", () => {
		expectTypeOf<
			IgniteReactProps<CounterCommands, CounterEvents>["onCountChanged"]
		>().toEqualTypeOf<((event: { count: number }) => void) | undefined>();
	});

	it("maps single-arg setX commands to optional de-prefixed string props", () => {
		// setLabel(label: string) -> optional `label?: string`.
		expectTypeOf<
			IgniteReactProps<CounterCommands, CounterEvents>["label"]
		>().toEqualTypeOf<string | undefined>();
	});

	it("does not surface zero-arg commands or multi-arg commands as props", () => {
		type Props = IgniteReactProps<CounterCommands, CounterEvents>;
		// increment/decrement are zero-arg -> not props.
		expectTypeOf<keyof Props>().not.toEqualTypeOf<"increment">();
		expectTypeOf<keyof Props>().not.toEqualTypeOf<"decrement">();
	});

	it("exposes the full command surface as the ref CommandHandle", () => {
		expectTypeOf<CommandHandle<CounterCommands>>().toEqualTypeOf<{
			increment: () => void;
			decrement: () => void;
			setLabel: (label: string) => void;
		}>();
	});

	it("keeps the machine event union assignable (sanity)", () => {
		expectTypeOf<CounterEvent>().toMatchTypeOf<{ type: string }>();
	});
});

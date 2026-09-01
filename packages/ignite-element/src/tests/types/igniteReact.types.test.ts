import { describe, expectTypeOf, it } from "vitest";
import { type EventFrom, setup } from "xstate";
import { igniteCore } from "../../IgniteCore";
import { type IgniteReactRef, igniteReact } from "../../react";
import type {
	CommandHandle,
	IgniteReactProps,
	IgniteReactSetterProps,
} from "../../react/igniteReact";

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
	states: (snapshot) => ({
		count: snapshot.context.count,
		label: snapshot.context.label,
	}),
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

// Edge-case command shapes for the setX -> prop mapping. Only a single-arg
// `setX` becomes a prop; zero-arg commands, multi-arg `setX`, and zero-arg
// `setX` must all be excluded. Locks the `Parameters<...> extends [unknown]`
// guard in IgniteReactSetterProps against regression.
type EdgeSetterCommands = {
	increment: () => void;
	setLabel: (label: string) => void;
	setRange: (min: number, max: number) => void;
	setReset: () => void;
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

	it("locks the exact prop surface — zero-arg commands are not props", () => {
		// A `keyof Props` (a union) vs a single literal `.not.toEqualTypeOf` check
		// is vacuously true, so pin the WHOLE key set: only the event prop and the
		// single-arg setX. increment/decrement (zero-arg) are excluded.
		expectTypeOf<
			keyof IgniteReactProps<CounterCommands, CounterEvents>
		>().toEqualTypeOf<"onCountChanged" | "label">();
	});

	it("maps only single-arg setX to setter props — multi-arg and zero-arg setX excluded", () => {
		// setLabel(label) -> `label`; setRange(min, max) (multi-arg) and setReset()
		// (zero-arg) are NOT setter props, nor is the non-setX `increment`.
		expectTypeOf<
			keyof IgniteReactSetterProps<EdgeSetterCommands>
		>().toEqualTypeOf<"label">();
	});

	it("exposes the full command surface as the ref CommandHandle", () => {
		expectTypeOf<CommandHandle<CounterCommands>>().toEqualTypeOf<{
			increment: () => void;
			decrement: () => void;
			setLabel: (label: string) => void;
		}>();
	});

	it("derives the ref type from the handle via the public IgniteReactRef", () => {
		// What a consumer types a useRef with: `IgniteReactRef<typeof Core>` (the
		// igniteCore handle) resolves to the full CommandHandle — no hand-written
		// shape, no drift. Note: it must be the handle, not the wrapper component
		// (a React component lacks tagName/getSchema, so it would be `never`).
		expectTypeOf<IgniteReactRef<typeof Counter>>().toEqualTypeOf<{
			increment: () => void;
			decrement: () => void;
			setLabel: (label: string) => void;
		}>();
	});

	it("keeps the machine event union assignable (sanity)", () => {
		expectTypeOf<CounterEvent>().toMatchTypeOf<{ type: string }>();
	});
});

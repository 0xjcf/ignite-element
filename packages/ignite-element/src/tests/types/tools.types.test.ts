import { describe, expectTypeOf, it } from "vitest";
import { createMachine } from "xstate";
import { igniteCore } from "../../IgniteCore";
import type { EventDescriptor } from "../../RenderArgs";
import type {
	NeutralManifest,
	NeutralToolCall,
	ToolDialect,
	ToolError,
	ToolStreamObservation,
} from "../../tools";
import { igniteTools } from "../../tools";

describe("igniteTools types", () => {
	const machine = createMachine({
		initial: "off",
		states: {
			off: { on: { TOGGLE: "on" } },
			on: { on: { TOGGLE: "off" } },
		},
	});

	const component = igniteCore({
		adapter: "xstate",
		source: machine,
		states: (snapshot) => ({ isOn: snapshot.matches("on") }),
		commands: ({ actor }) => ({
			toggle: () => actor.send({ type: "TOGGLE" }),
		}),
		events: (event) => ({
			toggled: event<{ isOn: boolean }>(),
		}),
	});

	type ComponentSnapshot = ReturnType<typeof component.getSnapshot>;

	it("exposes a NeutralManifest and an errors-as-values run", () => {
		const { manifest, resolveCall, run } = igniteTools(component);

		expectTypeOf(manifest).toEqualTypeOf<NeutralManifest>();
		expectTypeOf(resolveCall).toBeFunction();
		expectTypeOf(run).toBeFunction();
	});

	it("types the run observation from the component's snapshot + events", () => {
		const { run } = igniteTools(component);

		// Wrapped uncalled: the body is typechecked but never executed (these
		// `.types.test.ts` files also run under vitest). The success branch carries
		// the component's snapshot + typed events; the failure branch is ToolError.
		const probe = async () => {
			const result = await run({ name: "toggle", input: undefined });

			if (result.ok) {
				expectTypeOf(result.value.snapshot).toEqualTypeOf<ComponentSnapshot>();
				// The observation also carries the derived states, typed from the
				// component's `states` projection.
				expectTypeOf(result.value.states).toEqualTypeOf<{ isOn: boolean }>();
				expectTypeOf(result.value.events).toEqualTypeOf<
					Array<{ type: "toggled"; isOn: boolean }>
				>();
			} else {
				expectTypeOf(result.error).toEqualTypeOf<ToolError>();
			}
		};
		void probe;
	});

	it("types observe() from the component's states + events", () => {
		const { observe } = igniteTools(component);

		observe((observation) => {
			expectTypeOf(observation).toEqualTypeOf<
				ToolStreamObservation<
					{ isOn: boolean },
					{ toggled: EventDescriptor<{ isOn: boolean }> }
				>
			>();

			if (observation.type === "states") {
				expectTypeOf(observation.states).toEqualTypeOf<{ isOn: boolean }>();
				expectTypeOf(observation.prevStates).toEqualTypeOf<{ isOn: boolean }>();
			} else {
				expectTypeOf(observation.event).toEqualTypeOf<{
					type: "toggled";
					isOn: boolean;
				}>();
			}
		});
	});

	it("types a dialect's tools and translators from the dialect generics", () => {
		type Defs = Array<{ tool: string }>;
		type Resp = { calls: NeutralToolCall[] };
		type Block = { id?: string };

		const dialect: ToolDialect<Defs, Resp, Block> = {
			tools: (manifest) => manifest.map((t) => ({ tool: t.name })),
			toolCalls: (response) => response.calls,
			toolResult: (result) => ({ id: result.id }),
		};

		const tools = igniteTools(component, dialect);

		expectTypeOf(tools.tools).toEqualTypeOf<Defs>();
		expectTypeOf(tools.toolCalls).parameter(0).toEqualTypeOf<Resp>();
		expectTypeOf(tools.toolCalls).returns.toEqualTypeOf<NeutralToolCall[]>();
		expectTypeOf(tools.toolResult).returns.toEqualTypeOf<Block>();
	});
});

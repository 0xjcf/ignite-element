import { describe, expectTypeOf, it } from "vitest";
import { createMachine } from "xstate";
import { igniteCore } from "../../IgniteCore";
import type {
	NeutralManifest,
	NeutralToolCall,
	ToolDialect,
	ToolError,
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
		view: ({ snapshot }) => ({ isOn: snapshot.matches("on") }),
		commands: ({ actor }) => ({
			toggle: () => actor.send({ type: "TOGGLE" }),
		}),
		events: (event) => ({
			toggled: event<{ isOn: boolean }>(),
		}),
	});

	type ComponentSnapshot = ReturnType<typeof component.getSnapshot>;

	it("exposes a NeutralManifest and an errors-as-values invoke", () => {
		const { manifest, resolveCall, invoke } = igniteTools(component);

		expectTypeOf(manifest).toEqualTypeOf<NeutralManifest>();
		expectTypeOf(resolveCall).toBeFunction();
		expectTypeOf(invoke).toBeFunction();
	});

	it("types the invoke observation from the component's snapshot + events", () => {
		const { invoke } = igniteTools(component);

		// Wrapped uncalled: the body is typechecked but never executed (these
		// `.types.test.ts` files also run under vitest). The success branch carries
		// the component's snapshot + typed events; the failure branch is ToolError.
		const probe = async () => {
			const result = await invoke({ name: "toggle", input: undefined });

			if (result.ok) {
				expectTypeOf(result.value.snapshot).toEqualTypeOf<ComponentSnapshot>();
				expectTypeOf(result.value.events).toEqualTypeOf<
					Array<{ type: "toggled"; payload: { isOn: boolean } }>
				>();
			} else {
				expectTypeOf(result.error).toEqualTypeOf<ToolError>();
			}
		};
		void probe;
	});

	it("types a dialect's tools and translators from the dialect generics", () => {
		type Defs = Array<{ tool: string }>;
		type Resp = { calls: NeutralToolCall[] };
		type Block = { id?: string };

		const dialect: ToolDialect<Defs, Resp, Block> = {
			toToolDefs: (manifest) => manifest.map((t) => ({ tool: t.name })),
			parseToolCalls: (response) => response.calls,
			toToolResult: (result) => ({ id: result.id }),
		};

		const tools = igniteTools(component, dialect);

		expectTypeOf(tools.tools).toEqualTypeOf<Defs>();
		expectTypeOf(tools.parseToolCalls).parameter(0).toEqualTypeOf<Resp>();
		expectTypeOf(tools.parseToolCalls).returns.toEqualTypeOf<
			NeutralToolCall[]
		>();
		expectTypeOf(tools.toToolResult).returns.toEqualTypeOf<Block>();
	});
});

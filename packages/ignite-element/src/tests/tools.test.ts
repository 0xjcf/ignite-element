import { describe, expect, it, vi } from "vitest";
import type { EventDescriptor } from "../RenderArgs";
import type {
	IgniteToolsRuntime,
	NeutralManifest,
	NeutralToolCall,
	NeutralToolResult,
	ToolDialect,
} from "../tools";
import { buildManifest, igniteTools, isErr, isOk, resolveCall } from "../tools";
import type { IgniteAgentSchema, IgniteSchemaObject } from "../types/schema";

// --- Fakes (zero LLM, zero adapters, fully deterministic) ---------------------

type FakeState = { count: number; last?: string; payload?: unknown };
type FakeView = { count: number; label: string };

type FakeEvents = {
	"item-added": EventDescriptor<{ id: number }>;
};

const fakeSchema: IgniteAgentSchema<FakeState, FakeView> = {
	commands: {
		// no-arg command (no `input` metadata)
		increment: { description: "Increment the count." },
		// scalar-input command (positional number payload)
		setLimit: {
			description: "Set the limit.",
			input: { type: "number", minimum: 3, maximum: 12 },
		},
		// object-input command
		addItem: {
			description: "Add an item.",
			input: {
				type: "object",
				properties: { name: { type: "string" }, qty: { type: "number" } },
				required: ["name"],
			},
		},
		// enum-input command
		pickColor: {
			description: "Pick a color.",
			input: { type: "string", enum: ["red", "green", "blue"] },
		},
		// command that rejects when executed
		boom: { description: "Always fails." },
		// gated command (availability predicate exists)
		adminOnly: { description: "Admin only.", gated: true },
	},
	events: ["item-added"],
	state: { count: 0 },
	view: { count: 0, label: "zero" },
};

type FakeComponent = IgniteToolsRuntime<
	FakeState,
	Record<string, (...args: never[]) => unknown>,
	FakeEvents,
	FakeState,
	FakeView
> & {
	calls: Array<{ name: string; payload: unknown }>;
	canExecute?: (name: string) => boolean;
};

function createFakeComponent(
	options: { canExecute?: (name: string) => boolean } = {},
): FakeComponent {
	const calls: Array<{ name: string; payload: unknown }> = [];
	const component: FakeComponent = {
		calls,
		getSchema: () => fakeSchema,
		execute: (async (name: string, payload?: unknown) => {
			calls.push({ name, payload });
			if (name === "boom") {
				throw new Error("kaboom");
			}
			return {
				state: { count: 1, last: name, payload },
				events: [{ type: "item-added", payload: { id: 1 } }],
			};
		}) as FakeComponent["execute"],
		// The derived read-model the agent grounds on; reflects the calls so far.
		getView: () => ({
			count: calls.length,
			label: calls.length > 0 ? "active" : "zero",
		}),
	};
	if (options.canExecute) {
		component.canExecute = options.canExecute;
	}
	return component;
}

class ThisBoundFakeComponent implements FakeComponent {
	calls: Array<{ name: string; payload: unknown }> = [];

	execute = async function (
		this: ThisBoundFakeComponent,
		name: string,
		payload?: unknown,
	) {
		this.calls.push({ name, payload });
		return {
			state: { count: this.calls.length, last: name, payload },
			events: [{ type: "item-added", payload: { id: this.calls.length } }],
		};
	} as FakeComponent["execute"];

	getSchema() {
		return fakeSchema;
	}

	getView() {
		return {
			count: this.calls.length,
			label: this.calls.length > 0 ? "active" : "zero",
		};
	}
}

// A minimal fake provider dialect: proves the ToolDialect port wiring without
// any real provider SDK. Its wire shapes are intentionally invented.
type FakeToolDefs = Array<{ tool: string; schema: unknown }>;
type FakeResponse = {
	calls: Array<{ id: string; name: string; input: unknown }>;
};
type FakeResultBlock = {
	tool_use_id: string | undefined;
	is_error: boolean;
	content: unknown;
};

const fakeDialect: ToolDialect<FakeToolDefs, FakeResponse, FakeResultBlock> = {
	tools: (manifest: NeutralManifest) =>
		manifest.map((t) => ({ tool: t.name, schema: t.inputSchema })),
	// The fake wire format is object-shaped already, so it ignores `manifest`
	// (no scalar wrapping to undo) — proving the param is optional to consume.
	toolCalls: (response: FakeResponse): NeutralToolCall[] =>
		response.calls.map((c) => ({ id: c.id, name: c.name, input: c.input })),
	toolResult: (result: NeutralToolResult): FakeResultBlock => ({
		tool_use_id: result.id,
		is_error: isErr(result.result),
		content: result.result.ok ? result.result.value : result.result.error,
	}),
};

// --- buildManifest (pure core) ------------------------------------------------

describe("buildManifest", () => {
	it("maps getSchema().commands to neutral tools, sorted by name", () => {
		const manifest = buildManifest(fakeSchema);
		expect(manifest.map((t) => t.name)).toEqual([
			"addItem",
			"adminOnly",
			"boom",
			"increment",
			"pickColor",
			"setLimit",
		]);
	});

	it("carries description and input schema as the tool's inputSchema", () => {
		const manifest = buildManifest(fakeSchema);
		const setLimit = manifest.find((t) => t.name === "setLimit");
		expect(setLimit).toMatchObject({
			name: "setLimit",
			description: "Set the limit.",
			inputSchema: { type: "number", minimum: 3, maximum: 12 },
			gated: false,
		});
	});

	it("synthesizes an empty object schema for no-arg commands", () => {
		const manifest = buildManifest(fakeSchema);
		const increment = manifest.find((t) => t.name === "increment");
		expect(increment?.inputSchema).toEqual({ type: "object", properties: {} });
	});

	it("preserves object input schemas verbatim", () => {
		const manifest = buildManifest(fakeSchema);
		const addItem = manifest.find((t) => t.name === "addItem");
		expect(addItem?.inputSchema).toEqual({
			type: "object",
			properties: { name: { type: "string" }, qty: { type: "number" } },
			required: ["name"],
		});
	});

	it("marks gated commands and includes them when no availability predicate is given", () => {
		const manifest = buildManifest(fakeSchema);
		const adminOnly = manifest.find((t) => t.name === "adminOnly");
		expect(adminOnly?.gated).toBe(true);
	});

	it("omits gated commands that are unavailable per canExecute", () => {
		const manifest = buildManifest(fakeSchema, (name) => name !== "adminOnly");
		expect(manifest.find((t) => t.name === "adminOnly")).toBeUndefined();
		// non-gated commands are unaffected by the predicate
		expect(manifest.find((t) => t.name === "increment")).toBeDefined();
	});

	it("includes gated commands that are available per canExecute", () => {
		const manifest = buildManifest(fakeSchema, () => true);
		expect(manifest.find((t) => t.name === "adminOnly")).toBeDefined();
	});
});

// --- resolveCall (pure core, errors as values) --------------------------------

describe("resolveCall", () => {
	const manifest = buildManifest(fakeSchema);

	it("routes a valid scalar input to { command, payload }", () => {
		const result = resolveCall(manifest, "setLimit", 5);
		expect(result).toEqual({
			ok: true,
			value: { command: "setLimit", payload: 5 },
		});
	});

	it("routes a no-arg command with undefined payload", () => {
		const result = resolveCall(manifest, "increment", undefined);
		expect(result).toEqual({
			ok: true,
			value: { command: "increment", payload: undefined },
		});
	});

	it("returns UnknownCommand for a name not in the manifest", () => {
		const result = resolveCall(manifest, "nope", 1);
		expect(result).toEqual({
			ok: false,
			error: { kind: "UnknownCommand", name: "nope" },
		});
	});

	it("returns InvalidInput on a type mismatch", () => {
		const result = resolveCall(manifest, "setLimit", "not-a-number");
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expect(result.error.kind).toBe("InvalidInput");
			expect(result.error).toMatchObject({ name: "setLimit" });
			if (result.error.kind === "InvalidInput") {
				expect(result.error.issues.length).toBeGreaterThan(0);
			}
		}
	});

	it("returns InvalidInput when a number is out of range", () => {
		const result = resolveCall(manifest, "setLimit", 99);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) expect(result.error.kind).toBe("InvalidInput");
	});

	it("returns InvalidInput for an enum violation", () => {
		const result = resolveCall(manifest, "pickColor", "purple");
		expect(isErr(result)).toBe(true);
		if (isErr(result)) expect(result.error.kind).toBe("InvalidInput");
	});

	it("accepts a valid enum value", () => {
		const result = resolveCall(manifest, "pickColor", "green");
		expect(isOk(result)).toBe(true);
	});

	it("returns InvalidInput when a required object property is missing", () => {
		const result = resolveCall(manifest, "addItem", { qty: 2 });
		expect(isErr(result)).toBe(true);
		if (isErr(result)) expect(result.error.kind).toBe("InvalidInput");
	});

	it("accepts a valid object payload", () => {
		const result = resolveCall(manifest, "addItem", { name: "apple", qty: 2 });
		expect(isOk(result)).toBe(true);
		if (isOk(result)) {
			expect(result.value).toEqual({
				command: "addItem",
				payload: { name: "apple", qty: 2 },
			});
		}
	});

	it("returns Unavailable for a gated command when canExecute is false", () => {
		const gatedManifest = buildManifest(fakeSchema);
		const result = resolveCall(
			gatedManifest,
			"adminOnly",
			undefined,
			(name) => name !== "adminOnly",
		);
		expect(result).toEqual({
			ok: false,
			error: { kind: "Unavailable", name: "adminOnly" },
		});
	});
});

// --- resolveCall: input-schema validation (the validator) ---------------------

describe("resolveCall input validation", () => {
	const tool = (inputSchema: IgniteSchemaObject): NeutralManifest => [
		{ name: "t", inputSchema, gated: false },
	];

	it("accepts an exact multiple and rejects a non-multiple", () => {
		const manifest = tool({ type: "number", multipleOf: 0.5 });
		expect(isOk(resolveCall(manifest, "t", 1.5))).toBe(true);
		expect(isErr(resolveCall(manifest, "t", 0.3))).toBe(true);
	});

	it("treats a float-imprecise multiple as valid", () => {
		// 0.3 / 0.1 === 2.9999999999999996 — must not be rejected.
		const manifest = tool({ type: "number", multipleOf: 0.1 });
		expect(isOk(resolveCall(manifest, "t", 0.3))).toBe(true);
	});

	it("enforces string minLength/maxLength", () => {
		const manifest = tool({ type: "string", minLength: 2, maxLength: 4 });
		expect(isErr(resolveCall(manifest, "t", "a"))).toBe(true);
		expect(isErr(resolveCall(manifest, "t", "abcde"))).toBe(true);
		expect(isOk(resolveCall(manifest, "t", "abc"))).toBe(true);
	});

	it("enforces a string pattern", () => {
		const manifest = tool({ type: "string", pattern: "^[a-z]+$" });
		expect(isErr(resolveCall(manifest, "t", "ABC"))).toBe(true);
		expect(isOk(resolveCall(manifest, "t", "abc"))).toBe(true);
	});

	it("type-checks booleans", () => {
		const manifest = tool({ type: "boolean" });
		expect(isOk(resolveCall(manifest, "t", true))).toBe(true);
		expect(isErr(resolveCall(manifest, "t", "nope"))).toBe(true);
	});

	it("enforces array bounds and validates element types", () => {
		const manifest = tool({
			type: "array",
			items: { type: "string" },
			minItems: 1,
			maxItems: 2,
		});
		expect(isErr(resolveCall(manifest, "t", []))).toBe(true); // below minItems
		expect(isErr(resolveCall(manifest, "t", ["a", "b", "c"]))).toBe(true); // above maxItems
		expect(isErr(resolveCall(manifest, "t", [1]))).toBe(true); // wrong element type
		expect(isOk(resolveCall(manifest, "t", ["a", "b"]))).toBe(true);
	});

	it("accepts an omitted input when the schema declares a default", () => {
		const manifest = tool({ type: "number", default: 5 });
		expect(isOk(resolveCall(manifest, "t", undefined))).toBe(true);
	});
});

// --- igniteTools factory + run shell ------------------------------------------

describe("igniteTools (neutral, no dialect)", () => {
	it("exposes manifest, resolveCall, and run", () => {
		const component = createFakeComponent();
		const tools = igniteTools(component);
		expect(Array.isArray(tools.manifest)).toBe(true);
		expect(typeof tools.resolveCall).toBe("function");
		expect(typeof tools.run).toBe("function");
		expect("tools" in tools).toBe(false);
	});

	it("run routes a valid call through execute and returns { snapshot, view, events }", async () => {
		const component = createFakeComponent();
		const { run } = igniteTools(component);
		const result = await run({ name: "setLimit", input: 7 });
		expect(component.calls).toEqual([{ name: "setLimit", payload: 7 }]);
		expect(isOk(result)).toBe(true);
		if (isOk(result)) {
			expect(result.value.snapshot).toEqual({
				count: 1,
				last: "setLimit",
				payload: 7,
			});
			// The observation carries the derived view (post-command), so the agent
			// can ground on the read-model, not just the raw snapshot.
			expect(result.value.view).toEqual({ count: 1, label: "active" });
			expect(result.value.events).toEqual([
				{ type: "item-added", payload: { id: 1 } },
			]);
		}
	});

	it("binds runtime methods before calling execute and getView", async () => {
		const component = new ThisBoundFakeComponent();
		const { run } = igniteTools(component);
		const result = await run({ name: "setLimit", input: 7 });
		expect(component.calls).toEqual([{ name: "setLimit", payload: 7 }]);
		expect(isOk(result)).toBe(true);
		if (isOk(result)) {
			expect(result.value.snapshot).toMatchObject({
				count: 1,
				last: "setLimit",
			});
			expect(result.value.view).toEqual({ count: 1, label: "active" });
		}
	});

	it("run does not call execute on an unknown command", async () => {
		const component = createFakeComponent();
		const { run } = igniteTools(component);
		const result = await run({ name: "ghost", input: 1 });
		expect(component.calls).toEqual([]);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) expect(result.error.kind).toBe("UnknownCommand");
	});

	it("run does not call execute on invalid input", async () => {
		const component = createFakeComponent();
		const { run } = igniteTools(component);
		const result = await run({ name: "setLimit", input: "bad" });
		expect(component.calls).toEqual([]);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) expect(result.error.kind).toBe("InvalidInput");
	});

	it("run captures an execute rejection as ExecuteFailed (never throws across the seam)", async () => {
		const component = createFakeComponent();
		const { run } = igniteTools(component);
		const result = await run({ name: "boom", input: undefined });
		expect(isErr(result)).toBe(true);
		if (isErr(result)) {
			expect(result.error.kind).toBe("ExecuteFailed");
			expect(result.error).toMatchObject({ name: "boom" });
			if (result.error.kind === "ExecuteFailed") {
				expect(result.error.message).toContain("kaboom");
			}
		}
	});

	it("run returns Unavailable when availability flips after the manifest is built", async () => {
		// Availability is dynamic (snapshot-dependent): the command is offered at
		// manifest-build time but becomes unavailable before the call runs.
		let adminAvailable = true;
		const component = createFakeComponent({
			canExecute: (name) => name !== "adminOnly" || adminAvailable,
		});
		const { manifest, run } = igniteTools(component);
		// Offered at build time.
		expect(manifest.find((t) => t.name === "adminOnly")).toBeDefined();
		// Snapshot changes -> command no longer available.
		adminAvailable = false;
		const result = await run({ name: "adminOnly", input: undefined });
		expect(component.calls).toEqual([]);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) expect(result.error.kind).toBe("Unavailable");
	});

	it("omits gated, unavailable commands from the manifest", () => {
		const component = createFakeComponent({
			canExecute: (name) => name !== "adminOnly",
		});
		const { manifest } = igniteTools(component);
		expect(manifest.find((t) => t.name === "adminOnly")).toBeUndefined();
	});
});

describe("igniteTools (with a ToolDialect)", () => {
	it("exposes provider tool defs plus toolCalls/toolResult helpers", () => {
		const component = createFakeComponent();
		const tools = igniteTools(component, fakeDialect);
		expect(tools.tools).toEqual(
			tools.manifest.map((t) => ({ tool: t.name, schema: t.inputSchema })),
		);
		expect(typeof tools.toolCalls).toBe("function");
		expect(typeof tools.toolResult).toBe("function");
	});

	it("round-trips a provider response: toolCalls -> run -> toolResult", async () => {
		const component = createFakeComponent();
		const { toolCalls, run, toolResult } = igniteTools(component, fakeDialect);

		const response: FakeResponse = {
			calls: [{ id: "call_1", name: "setLimit", input: 8 }],
		};
		const calls = toolCalls(response);
		expect(calls).toEqual([{ id: "call_1", name: "setLimit", input: 8 }]);

		const result = await run(calls[0]);
		expect(isOk(result)).toBe(true);

		const block = toolResult({
			id: calls[0].id,
			name: calls[0].name,
			result,
		});
		expect(block).toMatchObject({ tool_use_id: "call_1", is_error: false });
	});

	it("maps a failed command into an error tool-result block", async () => {
		const component = createFakeComponent();
		const { run, toolResult } = igniteTools(component, fakeDialect);
		const call: NeutralToolCall = {
			id: "call_2",
			name: "boom",
			input: undefined,
		};
		const result = await run(call);
		const block = toolResult({ id: call.id, name: call.name, result });
		expect(block).toMatchObject({ tool_use_id: "call_2", is_error: true });
	});

	it("never throws across the seam even when execute rejects", async () => {
		const component = createFakeComponent();
		const spy = vi.spyOn(component, "execute");
		const { run } = igniteTools(component, fakeDialect);
		await expect(
			run({ name: "boom", input: undefined }),
		).resolves.toMatchObject({ ok: false });
		expect(spy).toHaveBeenCalledTimes(1);
	});
});

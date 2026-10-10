import { describe, expect, it } from "vitest";
import type { IgniteToolsRuntime } from "../tools";
import {
	buildManifest,
	defineToolSchema,
	igniteTools,
	resolveCall,
} from "../tools";
import type { IgniteAgentSchema } from "../types/schema";

const schema = defineToolSchema({
	status: {
		description: "Read the count.",
		input: { type: "object", properties: {} },
		read: true,
	},
	gatedStatus: {
		description: "Read when the predicate allows it.",
		input: { type: "object", properties: {} },
		read: true,
		gated: true,
	},
	increment: {
		description: "Add one.",
		input: { type: "object", properties: {} },
	},
	setLimit: {
		description: "Set the limit.",
		input: { type: "number", minimum: 0, maximum: 12, default: 5 },
		consequential: true,
	},
	rename: {
		description: "Rename with two fields.",
		input: {
			type: "object",
			properties: { a: { type: "number" }, b: { type: "number" } },
		},
		consequential: true,
	},
	boom: {
		description: "Fail after approval.",
		input: { type: "object", properties: {} },
		consequential: true,
	},
	both: {
		description: "A read flag does not bypass a consequential command.",
		input: { type: "object", properties: {} },
		read: true,
		consequential: true,
	},
});

const catalogue: IgniteAgentSchema = {
	schemaVersion: 1,
	states: { schema: null },
	commands: Object.fromEntries(
		Object.keys(schema).map((name) => [name, { input: null }]),
	),
	events: [],
};

type Call = { command: string; input?: unknown };

function createRuntime(options?: { defer?: boolean }) {
	const calls: Call[] = [];
	let states = { count: 0 };
	const pending: Array<() => void> = [];
	const runtime = {
		calls,
		release() {
			pending.shift()?.();
		},
		get(key: "states" | "schema" | "commands" | "events") {
			if (key === "states") return states;
			if (key === "schema") return catalogue;
			return catalogue[key];
		},
		async execute(call: Call) {
			calls.push(call);
			if (options?.defer) {
				await new Promise<void>((resolve) => {
					pending.push(resolve);
				});
			}
			if (call.command === "boom") {
				throw new Error("kaboom");
			}
			states = { count: calls.length };
			return { command: call.command };
		},
		on() {
			return { unsubscribe() {} };
		},
		watch(
			handler: (
				next: { count: number },
				previous: { count: number } | undefined,
			) => void,
		) {
			handler(states, undefined);
			return { unsubscribe() {} };
		},
	};
	return runtime;
}

function bind(
	runtime: ReturnType<typeof createRuntime>,
	options: {
		canExecute?: (name: string) => boolean;
	} = {},
) {
	return igniteTools({
		core: runtime as unknown as IgniteToolsRuntime,
		schema,
		...options,
	});
}

describe("igniteTools fails closed", () => {
	it("offers read tools and omits commands when canExecute is omitted", () => {
		const manifest = buildManifest(schema);
		expect(manifest.map((tool) => tool.name)).toEqual(["status"]);
		expect(manifest[0]).toMatchObject({ read: true, gated: false });
	});

	it("keeps an ungated read available when the command predicate denies it", () => {
		const manifest = buildManifest(schema, () => false);
		expect(manifest.map((tool) => tool.name)).toEqual(["status"]);
	});

	it("omits a gated read unless the predicate allows it", () => {
		expect(
			buildManifest(schema).find((tool) => tool.name === "gatedStatus"),
		).toBeUndefined();
		expect(
			buildManifest(schema, (name) => name === "gatedStatus").find(
				(tool) => tool.name === "gatedStatus",
			),
		).toMatchObject({ read: true, gated: true });
	});

	it("omits a non-gated command when the predicate returns false", () => {
		const manifest = buildManifest(schema, (name) => name !== "increment");
		expect(manifest.find((tool) => tool.name === "increment")).toBeUndefined();
		expect(manifest.find((tool) => tool.name === "status")).toBeDefined();
	});

	it("does not let a read flag bypass a consequential command", () => {
		expect(
			buildManifest(schema).find((tool) => tool.name === "both"),
		).toBeUndefined();
		expect(
			buildManifest(schema, () => true).find((tool) => tool.name === "both"),
		).toMatchObject({
			read: false,
			consequential: true,
		});
	});

	it("refuses a command on a stale manifest when no predicate is supplied", () => {
		const manifest = buildManifest(schema, () => true);
		expect(resolveCall(manifest, "increment", undefined)).toEqual({
			ok: false,
			error: { kind: "Unavailable", name: "increment" },
		});
		expect(resolveCall(manifest, "status", undefined).ok).toBe(true);
	});

	it("runs a read and observe path without an allow, and does not run a command", async () => {
		const runtime = createRuntime();
		const { manifest, run, observe, until } = bind(runtime);
		expect(manifest.find((tool) => tool.name === "increment")).toBeUndefined();

		const seen: string[] = [];
		const subscription = observe((observation) => {
			if (observation.type === "states") seen.push("states");
		});
		subscription.unsubscribe();
		const states = await until((observation) =>
			observation.type === "states" ? observation.states : undefined,
		);
		expect(seen).toEqual(["states"]);
		expect(states).toEqual({ count: 0 });

		const read = await run({ name: "status", input: undefined });
		expect(read.ok).toBe(true);
		expect(runtime.calls).toEqual([{ command: "status" }]);

		const denied = await run({ name: "increment", input: undefined });
		expect(denied).toEqual({
			ok: false,
			error: { kind: "UnknownCommand", name: "increment" },
		});
		expect(runtime.calls).toEqual([{ command: "status" }]);
	});

	it("runs a command only when canExecute returns true", async () => {
		const runtime = createRuntime();
		const { run } = bind(runtime, {
			canExecute: (name) => name === "increment",
		});
		const result = await run({ name: "increment", input: undefined });
		expect(result.ok).toBe(true);
		expect(runtime.calls).toEqual([{ command: "increment" }]);
	});

	it("returns Unavailable when a previously offered command is no longer allowed", async () => {
		let allowed = true;
		const runtime = createRuntime();
		const { manifest, run } = bind(runtime, {
			canExecute: (name) => name !== "increment" || allowed,
		});
		expect(manifest.find((tool) => tool.name === "increment")).toBeDefined();
		allowed = false;
		const result = await run({ name: "increment", input: undefined });
		expect(result).toEqual({
			ok: false,
			error: { kind: "Unavailable", name: "increment" },
		});
		expect(runtime.calls).toEqual([]);
	});
});

describe("approval stays with the application", () => {
	it("runs an allowed consequential command without an approval record", async () => {
		const runtime = createRuntime();
		const { run } = bind(runtime, { canExecute: () => true });
		const first = await run({ name: "setLimit", input: 5 });
		const second = await run({ name: "setLimit", input: 5 });
		expect(first.ok).toBe(true);
		expect(second.ok).toBe(true);
		expect(runtime.calls).toEqual([
			{ command: "setLimit", input: 5 },
			{ command: "setLimit", input: 5 },
		]);
	});

	it("does not keep a replay ledger on the runtime", async () => {
		const firstRuntime = createRuntime();
		const secondRuntime = createRuntime();
		const first = bind(firstRuntime, { canExecute: () => true });
		const second = bind(secondRuntime, { canExecute: () => true });
		expect(
			(await first.run({ name: "rename", input: { b: 2, a: 1 } })).ok,
		).toBe(true);
		expect(
			(await second.run({ name: "rename", input: { b: 2, a: 1 } })).ok,
		).toBe(true);
		expect(firstRuntime.calls).toEqual([
			{ command: "rename", input: { b: 2, a: 1 } },
		]);
		expect(secondRuntime.calls).toEqual([
			{ command: "rename", input: { b: 2, a: 1 } },
		]);
	});

	it("still executes when a previous allowed call failed", async () => {
		const runtime = createRuntime();
		const { run } = bind(runtime, { canExecute: () => true });
		const failed = await run({ name: "boom", input: undefined });
		expect(failed.ok).toBe(false);
		if (!failed.ok) expect(failed.error.kind).toBe("ExecuteFailed");
		const again = await run({ name: "boom", input: undefined });
		expect(again.ok).toBe(false);
		if (!again.ok) expect(again.error.kind).toBe("ExecuteFailed");
		expect(runtime.calls).toHaveLength(2);
	});
});

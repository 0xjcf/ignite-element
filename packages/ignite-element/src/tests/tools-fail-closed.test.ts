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
		canExecute?: (
			name: string,
			input?: unknown,
			context?: { core: object; execute?: boolean },
		) => boolean;
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

describe("canExecute receives the call and fails closed", () => {
	it("passes the validated input and the target runtime", async () => {
		const runtime = createRuntime();
		const seen: Array<{ name: string; input: unknown; core?: object }> = [];
		const { run } = bind(runtime, {
			canExecute: (name, input, context) => {
				if (name !== "setLimit") return false;
				if (!context) return true;
				seen.push({ name, input, core: context.core });
				return input === 5 && context.core === runtime;
			},
		});
		const result = await run({ name: "setLimit", input: undefined });
		expect(result.ok).toBe(true);
		expect(seen).toContainEqual({
			name: "setLimit",
			input: 5,
			core: runtime,
		});
		expect(runtime.calls).toEqual([{ command: "setLimit", input: 5 }]);
	});

	it("returns Unavailable when the predicate throws", () => {
		expect(() =>
			buildManifest(schema, () => {
				throw new Error("predicate failed");
			}),
		).not.toThrow();
		const manifest = buildManifest(schema, (name) => name === "increment");
		expect(() =>
			resolveCall(manifest, "increment", undefined, () => {
				throw new Error("predicate failed");
			}),
		).not.toThrow();
		expect(
			resolveCall(manifest, "increment", undefined, () => {
				throw new Error("predicate failed");
			}),
		).toEqual({
			ok: false,
			error: { kind: "Unavailable", name: "increment" },
		});
	});

	it("denies a predicate result whose then getter throws", () => {
		const boom = () => {
			const value: { then?: unknown } = {};
			// The getter must throw when the library inspects it.
			// biome-ignore lint/suspicious/noThenProperty: this is the throwing thenable under test
			Object.defineProperty(value, "then", {
				get() {
					throw new Error("then");
				},
			});
			return value as unknown as boolean;
		};
		expect(() => buildManifest(schema, boom)).not.toThrow();
		expect(buildManifest(schema, boom).map((tool) => tool.name)).toEqual([
			"status",
		]);
		const manifest = buildManifest(schema, () => true);
		expect(() =>
			resolveCall(manifest, "increment", undefined, boom),
		).not.toThrow();
		expect(resolveCall(manifest, "increment", undefined, boom)).toEqual({
			ok: false,
			error: { kind: "Unavailable", name: "increment" },
		});
	});

	it("returns Unavailable for a non-boolean predicate result", () => {
		const manifest = buildManifest(schema, () => true);
		expect(
			resolveCall(
				manifest,
				"increment",
				undefined,
				() => 1 as unknown as boolean,
			),
		).toEqual({
			ok: false,
			error: { kind: "Unavailable", name: "increment" },
		});
	});

	it("returns Unavailable for a promise and does not treat it as allow", async () => {
		const manifest = buildManifest(schema, () => true);
		const errors: unknown[] = [];
		const onUnhandled = (reason: unknown) => {
			errors.push(reason);
		};
		process.on("unhandledRejection", onUnhandled);
		const pending = resolveCall(
			manifest,
			"increment",
			undefined,
			() => Promise.resolve(true) as unknown as boolean,
		);
		const rejected = resolveCall(manifest, "increment", undefined, () => {
			return Promise.reject(new Error("denied")) as unknown as boolean;
		});
		await new Promise((resolve) => setTimeout(resolve, 0));
		process.off("unhandledRejection", onUnhandled);
		expect(pending).toEqual({
			ok: false,
			error: { kind: "Unavailable", name: "increment" },
		});
		expect(rejected).toEqual({
			ok: false,
			error: { kind: "Unavailable", name: "increment" },
		});
		expect(errors).toEqual([]);
	});

	it("does not resolve prototype, case, or whitespace names", () => {
		const manifest = buildManifest(schema, () => true);
		for (const name of [
			"constructor",
			"toString",
			"__proto__",
			"Increment",
			" increment",
			"increment ",
		]) {
			expect(resolveCall(manifest, name, undefined, () => true)).toEqual({
				ok: false,
				error: { kind: "UnknownCommand", name },
			});
		}
	});

	it("checks each call in a batch and turns a throwing predicate into Unavailable", async () => {
		const runtime = createRuntime();
		const { run } = bind(runtime, {
			canExecute: (name, input) => {
				if (name === "setLimit" && input !== undefined) {
					throw new Error("no");
				}
				return name === "increment" || name === "setLimit";
			},
		});
		const [allowed, denied] = await Promise.all([
			run({ name: "increment", input: undefined }),
			run({ name: "setLimit", input: 5 }),
		]);
		expect(allowed.ok).toBe(true);
		expect(denied).toEqual({
			ok: false,
			error: { kind: "Unavailable", name: "setLimit" },
		});
		expect(runtime.calls).toEqual([{ command: "increment" }]);
	});

	it("sets execute only on the run path, not on resolveCall", async () => {
		const runtime = createRuntime();
		const phases: Array<boolean | undefined> = [];
		const tools = bind(runtime, {
			canExecute: (name, _input, context) => {
				if (context) phases.push(context.execute);
				return name === "setLimit";
			},
		});
		expect(tools.resolveCall("setLimit", 6).ok).toBe(true);
		expect(phases).toEqual([undefined]);
		expect((await tools.run({ name: "setLimit", input: 6 })).ok).toBe(true);
		expect(phases).toEqual([undefined, true]);
		expect(runtime.calls).toEqual([{ command: "setLimit", input: 6 }]);
	});

	it("rejects non-JSON inputs before canExecute", () => {
		const open = defineToolSchema({
			amount: {
				description: "Any finite number.",
				input: { type: "number" },
			},
			series: {
				description: "Numbers.",
				input: { type: "array", items: { type: "number" } },
			},
			payload: {
				description: "An object.",
				input: {
					type: "object",
					properties: { a: { type: "number" } },
				},
			},
		});
		const manifest = buildManifest(open, () => true);
		const seen: unknown[] = [];
		const allow = (_name: string, input?: unknown) => {
			seen.push(input);
			return true;
		};
		for (const [name, input] of [
			["amount", Number.POSITIVE_INFINITY],
			["amount", Number.NEGATIVE_INFINITY],
			["series", [1, undefined, 2]],
			["payload", new Date(0)],
			["payload", new Map()],
			["payload", new Set()],
		] as const) {
			expect(resolveCall(manifest, name, input, allow)).toMatchObject({
				ok: false,
				error: { kind: "InvalidInput", name },
			});
		}
		expect(seen).toEqual([]);
		expect(resolveCall(manifest, "amount", 0, allow).ok).toBe(true);
		expect(resolveCall(manifest, "amount", -0, allow).ok).toBe(true);
		expect(Object.is(seen[0], 0)).toBe(true);
		expect(Object.is(seen[1], -0)).toBe(true);
	});

	it("refuses a command on a stale manifest when the predicate is omitted at resolve", () => {
		const manifest = buildManifest(schema, () => true);
		expect(manifest.find((tool) => tool.name === "increment")).toBeDefined();
		expect(resolveCall(manifest, "increment", undefined)).toEqual({
			ok: false,
			error: { kind: "Unavailable", name: "increment" },
		});
	});
});

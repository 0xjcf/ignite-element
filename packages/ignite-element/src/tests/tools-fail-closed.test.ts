import vm from "node:vm";
import { describe, expect, it } from "vitest";
import type { IgniteToolsRuntime } from "../tools";
import {
	buildManifest,
	defineToolSchema,
	igniteTools,
	resolveCall,
} from "../tools";
import type { ToolInputSchema } from "../tools/types";
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

	it("uses one immutable snapshot for validation, preflight, and execution", async () => {
		const runtime = createRuntime();
		let reads = 0;
		const input: { temp?: number } = {};
		Object.defineProperty(input, "temp", {
			enumerable: true,
			configurable: true,
			get() {
				reads += 1;
				return reads === 1 ? 72 : 99;
			},
		});
		const seen: unknown[] = [];
		const tools = igniteTools({
			core: runtime as unknown as IgniteToolsRuntime,
			schema: defineToolSchema({
				setThermostat: {
					description: "Set the thermostat.",
					input: {
						type: "object",
						properties: { temp: { type: "number" } },
						required: ["temp"],
					},
					consequential: true,
				},
			}),
			canExecute: (_name, value, context) => {
				if (context?.execute) seen.push(value);
				return true;
			},
		});

		const result = await tools.run({ name: "setThermostat", input });
		expect(result.ok).toBe(true);
		expect(runtime.calls).toEqual([
			{ command: "setThermostat", input: { temp: 72 } },
		]);
		const executed = runtime.calls[0]?.input;
		expect(seen).toEqual([executed]);
		expect(Object.isFrozen(executed)).toBe(true);
		expect(Object.getOwnPropertyDescriptor(executed, "temp")?.get).toBe(
			undefined,
		);
		expect(input.temp).toBe(99);
	});

	it("snapshots a schema default before preflight and execution", async () => {
		const runtime = createRuntime();
		let reads = 0;
		const fallback: { temp?: number } = {};
		Object.defineProperty(fallback, "temp", {
			enumerable: true,
			configurable: true,
			get() {
				reads += 1;
				return reads === 1 ? 70 : 12;
			},
		});
		const seen: unknown[] = [];
		const tools = igniteTools({
			core: runtime as unknown as IgniteToolsRuntime,
			schema: defineToolSchema({
				setThermostat: {
					description: "Set the thermostat.",
					input: {
						type: "object",
						properties: { temp: { type: "number" } },
						required: ["temp"],
						default: fallback,
					},
					consequential: true,
				},
			}),
			canExecute: (_name, value, context) => {
				if (context?.execute) seen.push(value);
				return true;
			},
		});

		const result = await tools.run({
			name: "setThermostat",
			input: undefined,
		});
		expect(result.ok).toBe(true);
		expect(runtime.calls).toEqual([
			{ command: "setThermostat", input: { temp: 70 } },
		]);
		expect(seen).toEqual([runtime.calls[0]?.input]);
		expect(fallback.temp).toBe(12);
	});

	it("returns InvalidInput when an accessor throws while reading the call", () => {
		const input: { temp?: number } = {};
		Object.defineProperty(input, "temp", {
			enumerable: true,
			configurable: true,
			get() {
				throw new Error("unreadable");
			},
		});
		const manifest = buildManifest(
			defineToolSchema({
				setThermostat: {
					description: "Set the thermostat.",
					input: {
						type: "object",
						properties: { temp: { type: "number" } },
						required: ["temp"],
					},
				},
			}),
			() => true,
		);
		const seen: unknown[] = [];
		expect(() =>
			resolveCall(manifest, "setThermostat", input, (_name, value) => {
				seen.push(value);
				return true;
			}),
		).not.toThrow();
		expect(
			resolveCall(manifest, "setThermostat", input, () => true),
		).toMatchObject({
			ok: false,
			error: { kind: "InvalidInput", name: "setThermostat" },
		});
		expect(seen).toEqual([]);
	});
});

describe("observation setup does not spend an approval", () => {
	function observationRuntime(options?: {
		events?: Array<{ type: string }>;
		failGet?: () => boolean;
		on?: (type: string) => { unsubscribe(): void };
	}) {
		const calls: Call[] = [];
		const events = options?.events ?? [{ type: "tick" }];
		const runtime = {
			calls,
			get(key: "states" | "schema" | "commands" | "events") {
				if (key === "events") {
					if (options?.failGet?.()) throw new Error("events down");
					return events;
				}
				if (key === "states") return { count: 0 };
				if (key === "schema") {
					return {
						...catalogue,
						events: events.map((event) => ({
							type: event.type,
							payload: null,
						})),
					};
				}
				return catalogue[key];
			},
			async execute(call: Call) {
				calls.push(call);
				return { command: call.command };
			},
			on(type: string) {
				return options?.on?.(type) ?? { unsubscribe() {} };
			},
			watch() {
				return { unsubscribe() {} };
			},
		};
		return runtime;
	}

	it("does not pass execute when event lookup throws, and a retry can run", async () => {
		let failGet = true;
		let spent = false;
		const runtime = observationRuntime({
			failGet: () => failGet,
		});
		const tools = igniteTools({
			core: runtime as unknown as IgniteToolsRuntime,
			schema,
			canExecute: (_name, _input, context) => {
				if (context?.execute) spent = true;
				return true;
			},
		});

		const failed = await tools.run({ name: "increment", input: undefined });
		expect(failed).toMatchObject({
			ok: false,
			error: { kind: "ExecuteFailed", name: "increment" },
		});
		expect(spent).toBe(false);
		expect(runtime.calls).toEqual([]);

		failGet = false;
		const retried = await tools.run({ name: "increment", input: undefined });
		expect(retried.ok).toBe(true);
		expect(spent).toBe(true);
		expect(runtime.calls).toEqual([{ command: "increment" }]);
	});

	it("unsubscribes earlier handles when a later subscription throws", async () => {
		let failSecond = true;
		let ons = 0;
		let spent = false;
		const unsubscribed: string[] = [];
		const runtime = observationRuntime({
			events: [{ type: "a" }, { type: "b" }],
			on(type) {
				ons += 1;
				if (failSecond && ons === 2) throw new Error("on failed");
				return {
					unsubscribe() {
						unsubscribed.push(type);
					},
				};
			},
		});
		const tools = igniteTools({
			core: runtime as unknown as IgniteToolsRuntime,
			schema,
			canExecute: (_name, _input, context) => {
				if (context?.execute) spent = true;
				return true;
			},
		});

		const failed = await tools.run({ name: "increment", input: undefined });
		expect(failed).toMatchObject({
			ok: false,
			error: { kind: "ExecuteFailed", name: "increment" },
		});
		expect(spent).toBe(false);
		expect(unsubscribed).toEqual(["a"]);
		expect(runtime.calls).toEqual([]);

		failSecond = false;
		ons = 0;
		const retried = await tools.run({ name: "increment", input: undefined });
		expect(retried.ok).toBe(true);
		expect(spent).toBe(true);
		expect(runtime.calls).toEqual([{ command: "increment" }]);
	});

	it("unsubscribes when the consuming preflight denies the call", async () => {
		const unsubscribed: string[] = [];
		let sawExecute = false;
		const runtime = observationRuntime({
			on(type) {
				return {
					unsubscribe() {
						unsubscribed.push(type);
					},
				};
			},
		});
		const tools = igniteTools({
			core: runtime as unknown as IgniteToolsRuntime,
			schema,
			canExecute: (_name, _input, context) => {
				if (context?.execute) {
					sawExecute = true;
					return false;
				}
				return true;
			},
		});

		const denied = await tools.run({ name: "increment", input: undefined });
		expect(denied).toEqual({
			ok: false,
			error: { kind: "Unavailable", name: "increment" },
		});
		expect(sawExecute).toBe(true);
		expect(unsubscribed).toEqual(["tick"]);
		expect(runtime.calls).toEqual([]);
	});

	it("unsubscribes when the consuming preflight returns a thenable", async () => {
		const unsubscribed: string[] = [];
		const runtime = observationRuntime({
			on(type) {
				return {
					unsubscribe() {
						unsubscribed.push(type);
					},
				};
			},
		});
		const tools = igniteTools({
			core: runtime as unknown as IgniteToolsRuntime,
			schema,
			canExecute: (_name, _input, context) => {
				if (context?.execute)
					return Promise.resolve(true) as unknown as boolean;
				return true;
			},
		});
		const denied = await tools.run({ name: "increment", input: undefined });
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(denied).toEqual({
			ok: false,
			error: { kind: "Unavailable", name: "increment" },
		});
		expect(unsubscribed).toEqual(["tick"]);
		expect(runtime.calls).toEqual([]);
	});
});

describe("schema defaults are validated before they are routed", () => {
	const seenInputs: unknown[] = [];
	const allow = (_name: string, input?: unknown) => {
		seenInputs.push(input);
		return true;
	};

	function manifestFor(input: ToolInputSchema) {
		return buildManifest(
			defineToolSchema({
				setLimit: {
					description: "Set the limit.",
					input,
					consequential: true,
				},
			}),
			() => true,
		);
	}

	it("rejects a default that is non-finite, out of range, or the wrong type", () => {
		const cases: Array<{ input: ToolInputSchema; issue: RegExp }> = [
			{
				input: { type: "number", default: Number.POSITIVE_INFINITY },
				issue: /finite/,
			},
			{
				input: { type: "number", default: Number.NEGATIVE_INFINITY },
				issue: /finite/,
			},
			{
				input: { type: "number", minimum: 1, maximum: 3, default: 0 },
				issue: /minimum/,
			},
			{
				input: { type: "number", minimum: 1, maximum: 3, default: 4 },
				issue: /maximum/,
			},
			{
				input: { type: "number", default: "nope" },
				issue: /finite number/,
			},
			{
				input: { type: "string", enum: ["a", "b"], default: "c" },
				issue: /not one of/,
			},
			{
				input: { type: "boolean", default: "yes" },
				issue: /boolean/,
			},
		];

		for (const { input, issue } of cases) {
			seenInputs.length = 0;
			const result = resolveCall(
				manifestFor(input),
				"setLimit",
				undefined,
				allow,
			);
			expect(result).toMatchObject({
				ok: false,
				error: { kind: "InvalidInput", name: "setLimit" },
			});
			if (!result.ok && result.error.kind === "InvalidInput") {
				expect(result.error.issues.join("\n")).toMatch(issue);
			}
			expect(seenInputs).toEqual([]);
		}
	});

	it("rejects a nested default that violates the property schema", () => {
		seenInputs.length = 0;
		const result = resolveCall(
			manifestFor({
				type: "object",
				properties: {
					limit: { type: "number", default: Number.POSITIVE_INFINITY },
				},
			}),
			"setLimit",
			{ limit: undefined },
			allow,
		);
		expect(result).toMatchObject({
			ok: false,
			error: { kind: "InvalidInput", name: "setLimit" },
		});
		if (!result.ok && result.error.kind === "InvalidInput") {
			expect(result.error.issues.join("\n")).toMatch(/finite/);
		}
		expect(seenInputs).toEqual([]);
	});
});

describe("plain objects from another JavaScript realm", () => {
	it("accepts a JSON object whose prototype belongs to another realm", () => {
		const input = vm.runInNewContext("({ room: 'living', temp: 72 })");
		expect(Object.getPrototypeOf(input)).not.toBe(Object.prototype);
		const manifest = buildManifest(
			defineToolSchema({
				payload: {
					description: "An object.",
					input: {
						type: "object",
						properties: {
							room: { type: "string" },
							temp: { type: "number" },
						},
						required: ["room", "temp"],
					},
				},
			}),
			() => true,
		);
		const result = resolveCall(manifest, "payload", input, () => true);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.input).toEqual({ room: "living", temp: 72 });
			expect(result.value.input).not.toBe(input);
			expect(Object.isFrozen(result.value.input)).toBe(true);
		}
	});

	it("accepts a null-prototype object and rejects a class instance", () => {
		const input = Object.create(null) as { room?: string; temp?: number };
		input.room = "living";
		input.temp = 72;
		class Room {
			room = "living";
			temp = 72;
		}
		const manifest = buildManifest(
			defineToolSchema({
				payload: {
					description: "An object.",
					input: {
						type: "object",
						properties: {
							room: { type: "string" },
							temp: { type: "number" },
						},
						required: ["room", "temp"],
					},
				},
			}),
			() => true,
		);
		const result = resolveCall(manifest, "payload", input, () => true);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.input).toEqual({ room: "living", temp: 72 });
		}
		expect(
			resolveCall(manifest, "payload", new Room(), () => true),
		).toMatchObject({
			ok: false,
			error: { kind: "InvalidInput", name: "payload" },
		});
	});

	it("rejects cyclic input before canExecute", () => {
		const manifest = buildManifest(
			defineToolSchema({
				payload: {
					description: "An object.",
					input: { type: "object", properties: {} },
				},
			}),
			() => true,
		);
		const input: { self?: unknown } = {};
		input.self = input;
		const seen: unknown[] = [];
		expect(
			resolveCall(manifest, "payload", input, (_name, value) => {
				seen.push(value);
				return true;
			}),
		).toMatchObject({
			ok: false,
			error: { kind: "InvalidInput", name: "payload" },
		});
		expect(seen).toEqual([]);
	});

	it("still rejects Date, Map, and Set created in another realm", () => {
		const manifest = buildManifest(
			defineToolSchema({
				payload: {
					description: "An object.",
					input: { type: "object", properties: {} },
				},
			}),
			() => true,
		);
		const seen: unknown[] = [];
		const allow = (_name: string, input?: unknown) => {
			seen.push(input);
			return true;
		};
		for (const source of ["new Date(0)", "new Map()", "new Set()"]) {
			expect(
				resolveCall(manifest, "payload", vm.runInNewContext(source), allow),
			).toMatchObject({
				ok: false,
				error: { kind: "InvalidInput", name: "payload" },
			});
		}
		expect(seen).toEqual([]);
	});
});

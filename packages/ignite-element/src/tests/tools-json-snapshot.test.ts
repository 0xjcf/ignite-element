import vm from "node:vm";
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
	amount: {
		description: "A finite number.",
		input: { type: "number" },
		consequential: true,
	},
	payload: {
		description: "An object.",
		input: {
			type: "object",
			properties: {
				a: { type: "number" },
				b: { type: "number" },
			},
		},
		consequential: true,
	},
	loose: {
		description: "An object with an untyped field.",
		input: {
			type: "object",
			properties: { v: {} },
		},
		consequential: true,
	},
	box: {
		description: "An object that may nest.",
		input: {
			type: "object",
			properties: { a: {} },
		},
		consequential: true,
	},
	series: {
		description: "An array with no item schema.",
		input: { type: "array" },
		consequential: true,
	},
	setLimit: {
		description: "A number with a default.",
		input: { type: "number", default: Number.POSITIVE_INFINITY },
		consequential: true,
	},
});

const catalogue: IgniteAgentSchema = {
	schemaVersion: 1,
	states: { schema: null },
	commands: Object.fromEntries(
		Object.keys(schema).map((name) => [name, { input: null }]),
	),
	events: [{ type: "tick", payload: null }],
};

const manifest = buildManifest(schema, () => true);

function invalid(name: string, input: unknown) {
	const seen: unknown[] = [];
	const result = (() => {
		try {
			return resolveCall(manifest, name, input, (_command, value) => {
				seen.push(value);
				return true;
			});
		} catch (error) {
			return error;
		}
	})();
	expect(result).toMatchObject({
		ok: false,
		error: { kind: "InvalidInput", name },
	});
	expect(seen).toEqual([]);
}

describe("plain JSON snapshot pairs", () => {
	it("rejects non-finite numbers before canExecute", () => {
		invalid("amount", Number.POSITIVE_INFINITY);
		invalid("amount", Number.NEGATIVE_INFINITY);
		invalid("amount", Number.NaN);
	});

	it("rejects an undefined array slot and keeps null distinct", () => {
		invalid("series", [1, undefined, 2]);
		const hole = [1, null, 2];
		delete hole[1];
		invalid("series", hole);
		const seen: unknown[] = [];
		const result = resolveCall(
			manifest,
			"series",
			[1, null, 2],
			(_n, value) => {
				seen.push(value);
				return true;
			},
		);
		expect(result.ok).toBe(true);
		expect(seen).toEqual([[1, null, 2]]);
	});

	it("normalizes signed zero to zero in the snapshot", () => {
		const seen: unknown[] = [];
		expect(
			resolveCall(manifest, "amount", -0, (_n, value) => {
				seen.push(value);
				return true;
			}).ok,
		).toBe(true);
		expect(Object.is(seen[0], 0)).toBe(true);
		expect(Object.is(seen[0], -0)).toBe(false);
	});

	it("rejects Date, Map, Set, and bigint before canExecute", () => {
		invalid("payload", new Date(0));
		invalid("payload", new Map());
		invalid("payload", new Set());
		invalid("series", [1n]);
		invalid("loose", { v: 1n });
	});

	it("rejects symbol keys, accessors, functions, and class instances", () => {
		const symbolKey: { a: number; [key: symbol]: string } = { a: 1 };
		symbolKey[Symbol("id")] = "x";
		invalid("payload", symbolKey);

		let reads = 0;
		const accessor: { a?: number } = {};
		Object.defineProperty(accessor, "a", {
			enumerable: true,
			configurable: true,
			get() {
				reads += 1;
				return reads >= 3 ? 99 : 1;
			},
		});
		invalid("payload", accessor);
		expect(reads).toBe(0);

		const proxy = new Proxy(
			{ a: 1 },
			{
				get(target, key, receiver) {
					if (key === "a") {
						reads += 1;
						return 99;
					}
					return Reflect.get(target, key, receiver);
				},
			},
		);
		const seen: unknown[] = [];
		const result = resolveCall(manifest, "payload", proxy, (_n, value) => {
			seen.push(value);
			return true;
		});
		expect(result.ok).toBe(true);
		expect(seen).toEqual([{ a: 1 }]);
		expect(reads).toBe(0);
		if (result.ok) {
			expect(Object.isFrozen(result.value.input)).toBe(true);
			expect(result.value.input).not.toBe(proxy);
		}

		invalid("loose", { v: () => 1 });
		class Box {
			a = 1;
		}
		invalid("payload", new Box());
	});

	it("does not call toJSON", () => {
		const enumerable = {
			a: 2,
			toJSON() {
				return { a: 1 };
			},
		};
		invalid("payload", enumerable);

		const hidden = { a: 2 };
		Object.defineProperty(hidden, "toJSON", {
			enumerable: false,
			value: () => ({ a: 1 }),
		});
		const seen: unknown[] = [];
		const result = resolveCall(manifest, "payload", hidden, (_n, value) => {
			seen.push(value);
			return true;
		});
		expect(result.ok).toBe(true);
		expect(seen).toEqual([{ a: 2 }]);
		expect(
			Object.getOwnPropertyDescriptor(seen[0] as object, "toJSON"),
		).toBeUndefined();
	});

	it("rejects cycles and over-depth without throwing", () => {
		const cycle: { a?: unknown } = {};
		cycle.a = cycle;
		invalid("box", cycle);

		let deep: unknown = { a: 1 };
		for (let index = 0; index < 8000; index += 1) deep = { a: deep };
		invalid("box", deep);
	});

	it("keeps an own __proto__ key and rejects a __proto__ prototype", () => {
		const parsed = JSON.parse('{"__proto__":{"admin":true},"a":1}') as {
			a: number;
		};
		const seen: unknown[] = [];
		const result = resolveCall(manifest, "payload", parsed, (_n, value) => {
			seen.push(value);
			return true;
		});
		expect(result.ok).toBe(true);
		const snapshot = seen[0] as { a: number; __proto__?: unknown };
		expect(snapshot.a).toBe(1);
		expect(
			Object.getOwnPropertyDescriptor(snapshot, "__proto__")?.enumerable,
		).toBe(true);
		expect(Object.getPrototypeOf(snapshot)).toBe(Object.prototype);
		expect((Object.prototype as { admin?: boolean }).admin).toBeUndefined();

		const literal = { __proto__: { admin: true }, a: 1 } as { a: number };
		invalid("payload", literal);
	});

	it("accepts a null-prototype object and a cross-realm object as detached plain snapshots", () => {
		const nil = Object.create(null) as { a: number };
		nil.a = 1;
		const foreign = vm.runInNewContext("({ a: 1 })") as { a: number };
		expect(Object.getPrototypeOf(foreign)).not.toBe(Object.prototype);
		for (const input of [nil, foreign]) {
			const seen: unknown[] = [];
			expect(
				resolveCall(manifest, "payload", input, (_n, value) => {
					seen.push(value);
					return true;
				}).ok,
			).toBe(true);
			const snapshot = seen[0] as { a: number };
			expect(snapshot).toEqual({ a: 1 });
			expect(snapshot).not.toBe(input);
			expect(Object.isFrozen(snapshot)).toBe(true);
			expect(Object.getPrototypeOf(snapshot)).toBe(Object.prototype);
		}
	});

	it("passes one frozen snapshot to canExecute and execute", async () => {
		const calls: Array<{ command: string; input?: unknown }> = [];
		const seen: unknown[] = [];
		const runtime = {
			get(key: "states" | "schema" | "commands" | "events") {
				if (key === "states") return { count: 0 };
				if (key === "schema") return catalogue;
				if (key === "events") return catalogue.events;
				return catalogue.commands;
			},
			async execute(call: { command: string; input?: unknown }) {
				calls.push(call);
				return { command: call.command };
			},
			on() {
				return { unsubscribe() {} };
			},
			watch() {
				return { unsubscribe() {} };
			},
		};
		const tools = igniteTools({
			core: runtime as unknown as IgniteToolsRuntime,
			schema,
			canExecute: (name, input, context) => {
				if (!context) return name === "payload";
				if (context.execute !== true || !input || typeof input !== "object") {
					return context.execute !== true;
				}
				seen.push(input);
				try {
					(input as { a: number }).a = 99;
				} catch {
					// The snapshot is frozen.
				}
				return true;
			},
		});
		const result = await tools.run({
			name: "payload",
			input: { b: 2, a: 1 },
		});
		expect(result.ok).toBe(true);
		expect(seen).toHaveLength(1);
		expect(calls[0]?.input).toBe(seen[0]);
		expect(calls[0]?.input).toEqual({ b: 2, a: 1 });
		expect(Object.isFrozen(calls[0]?.input)).toBe(true);
	});

	it("rejects exotic values nested in an untyped field", () => {
		invalid("box", { a: Number.POSITIVE_INFINITY });
		invalid("box", { a: new Date(0) });
		const nestedProxy = new Proxy({ n: 1 }, {});
		const seenProxy: unknown[] = [];
		const copied = resolveCall(
			manifest,
			"box",
			{ a: nestedProxy },
			(_n, value) => {
				seenProxy.push(value);
				return true;
			},
		);
		expect(copied.ok).toBe(true);
		expect(seenProxy).toEqual([{ a: { n: 1 } }]);
		if (
			copied.ok &&
			copied.value.input &&
			typeof copied.value.input === "object"
		) {
			const field = (copied.value.input as { a: object }).a;
			expect(Object.isFrozen(field)).toBe(true);
			expect(field).not.toBe(nestedProxy);
		}
		class SubArray extends Array<number> {}
		invalid("box", { a: new SubArray(1) });
		const hole = [1, 2];
		delete hole[1];
		invalid("box", { a: hole });
		let reads = 0;
		const nested: { hidden?: number } = {};
		Object.defineProperty(nested, "hidden", {
			enumerable: true,
			configurable: true,
			get() {
				reads += 1;
				return 1;
			},
		});
		invalid("box", { a: nested });
		expect(reads).toBe(0);
		const indexed: number[] = [];
		Object.defineProperty(indexed, "0", {
			enumerable: true,
			configurable: true,
			get() {
				reads += 1;
				return 1;
			},
		});
		Object.defineProperty(indexed, "length", { value: 1 });
		invalid("box", { a: indexed });
		expect(reads).toBe(0);

		const symbolArray = [1];
		Object.defineProperty(symbolArray, Symbol("id"), { value: "x" });
		invalid("series", symbolArray);
		const named = [1];
		Object.defineProperty(named, "extra", {
			value: true,
			enumerable: true,
		});
		invalid("series", named);
	});

	it("returns InvalidInput when a schema default throws", () => {
		const thrown = {
			type: "number" as const,
			get default(): number {
				throw new Error("default getter");
			},
		};
		const finite = defineToolSchema({
			setLimit: {
				description: "Bounded.",
				input: thrown,
				consequential: true,
			},
		});
		const bounded = buildManifest(finite, () => true);
		expect(() =>
			resolveCall(bounded, "setLimit", undefined, () => true),
		).not.toThrow();
		expect(
			resolveCall(bounded, "setLimit", undefined, () => true),
		).toMatchObject({
			ok: false,
			error: { kind: "InvalidInput", name: "setLimit" },
		});

		const nested = defineToolSchema({
			payload: {
				description: "An object.",
				input: {
					type: "object",
					properties: {
						limit: {
							type: "number",
							get default(): number {
								throw new Error("nested default");
							},
						},
					},
				},
				consequential: true,
			},
		});
		const objects = buildManifest(nested, () => true);
		expect(() =>
			resolveCall(objects, "payload", { limit: undefined }, () => true),
		).not.toThrow();
		expect(
			resolveCall(objects, "payload", { limit: undefined }, () => true),
		).toMatchObject({
			ok: false,
			error: { kind: "InvalidInput", name: "payload" },
		});
	});

	it("rejects a non-finite schema default before canExecute", () => {
		invalid("setLimit", undefined);
		const finite = defineToolSchema({
			setLimit: {
				description: "Bounded.",
				input: { type: "number", minimum: 1, maximum: 3, default: 0 },
				consequential: true,
			},
		});
		const bounded = buildManifest(finite, () => true);
		expect(
			resolveCall(bounded, "setLimit", undefined, () => true),
		).toMatchObject({
			ok: false,
			error: { kind: "InvalidInput", name: "setLimit" },
		});
	});

	it("returns InvalidInput when getPrototypeOf throws", () => {
		const input = {};
		Object.setPrototypeOf(input, {});
		const proxy = new Proxy(input, {
			getPrototypeOf() {
				throw new Error("prototype getter");
			},
		});
		invalid("payload", proxy);
	});

	it("validates the detached snapshot when a browser proxy changes between reads", () => {
		const host = globalThis as {
			process?: { getBuiltinModule?: (name: string) => unknown };
		};
		const saved = host.process?.getBuiltinModule;
		if (host.process) host.process.getBuiltinModule = undefined;
		try {
			const bounded = buildManifest(
				defineToolSchema({
					setTemp: {
						description: "Bounded temperature.",
						input: {
							type: "object",
							properties: {
								temp: { type: "number", minimum: 0, maximum: 100 },
							},
						},
						consequential: true,
					},
				}),
				() => true,
			);
			let reads = 0;
			const changing = new Proxy(
				{ temp: 0 },
				{
					getOwnPropertyDescriptor(_target, key) {
						if (key !== "temp") {
							return Reflect.getOwnPropertyDescriptor(_target, key);
						}
						reads += 1;
						return {
							value: reads === 1 ? 72 : 999,
							writable: true,
							enumerable: true,
							configurable: true,
						};
					},
				},
			);
			const seen: unknown[] = [];
			const result = resolveCall(
				bounded,
				"setTemp",
				changing,
				(_name, value) => {
					seen.push(value);
					return true;
				},
			);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.input).toEqual({ temp: 72 });
				expect(Object.isFrozen(result.value.input)).toBe(true);
			}
			expect(seen).toEqual([{ temp: 72 }]);
			expect(reads).toBe(1);

			reads = 0;
			const outOfRange = new Proxy(
				{ temp: 0 },
				{
					getOwnPropertyDescriptor(_target, key) {
						if (key !== "temp") {
							return Reflect.getOwnPropertyDescriptor(_target, key);
						}
						reads += 1;
						return {
							value: 999,
							writable: true,
							enumerable: true,
							configurable: true,
						};
					},
				},
			);
			const denied: unknown[] = [];
			expect(
				resolveCall(bounded, "setTemp", outOfRange, (_name, value) => {
					denied.push(value);
					return true;
				}),
			).toMatchObject({
				ok: false,
				error: { kind: "InvalidInput", name: "setTemp" },
			});
			expect(denied).toEqual([]);
			expect(reads).toBe(1);
		} finally {
			if (host.process && saved) host.process.getBuiltinModule = saved;
		}
	});
});

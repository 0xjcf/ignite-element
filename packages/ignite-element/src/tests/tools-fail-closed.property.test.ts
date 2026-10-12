/**
 * Fail-closed properties for igniteTools.
 * The CI seed and run count are fixed so a failure replays the same sequence.
 * Seed: 20261011. Runs: 200 per case.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import fc from "fast-check";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import type {
	IgniteToolsRuntime,
	NeutralToolCall,
	ToolInputSchema,
	ToolSchema,
} from "../tools";
import {
	buildManifest,
	defineToolSchema,
	igniteTools,
	resolveCall,
} from "../tools";
import { snapshotPlainJson } from "../tools/plainJson";
import { fromProviderInput } from "../tools/scalar";
import { validateToolInputValue } from "../tools/toolInput";

const PROPERTY_SEED = 20261011;
const PROPERTY_RUNS = 200;

const looseSchema = defineToolSchema({
	act: {
		description: "Submit a payload.",
		input: { type: "object", properties: { v: {} } },
		consequential: true,
	},
});

const jsonKey = fc.stringMatching(/^[a-z][a-z0-9]{0,2}$/);

function plainJson(depth: number): fc.Arbitrary<unknown> {
	const leaf = fc.oneof(
		fc.constant(null),
		fc.boolean(),
		fc.stringMatching(/^[a-z0-9]{0,6}$/),
		fc.integer({ min: -30, max: 30 }),
	);
	if (depth <= 0) return leaf;
	return fc.oneof(
		{ weight: 5, arbitrary: leaf },
		{
			weight: 2,
			arbitrary: fc.array(plainJson(depth - 1), { maxLength: 3 }),
		},
		{
			weight: 2,
			arbitrary: fc.dictionary(jsonKey, plainJson(depth - 1), {
				maxKeys: 3,
				noNullPrototype: true,
			}),
		},
	);
}

const jsonValue = plainJson(2);
const jsonContainer = fc.oneof(
	fc.array(plainJson(1), { maxLength: 3 }),
	fc.dictionary(jsonKey, plainJson(1), {
		maxKeys: 3,
		noNullPrototype: true,
	}),
);

type Call = { command: string; input?: unknown };

function createRuntime() {
	const calls: Call[] = [];
	const runtime = {
		calls,
		get(key: string) {
			if (key === "events") return [];
			if (key === "states") return {};
			if (key === "schema") {
				return {
					schemaVersion: 1,
					states: { schema: null },
					commands: {},
					events: [],
				};
			}
			return [];
		},
		async execute(call: Call) {
			calls.push(call);
			return { command: call.command };
		},
		on() {
			return { unsubscribe() {} };
		},
		watch(handler: (states: unknown, previous: unknown) => void) {
			handler({}, undefined);
			return { unsubscribe() {} };
		},
	};
	return runtime;
}

function cloneJson<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function sameJson(left: unknown, right: unknown): boolean {
	if (typeof left === "number" || typeof right === "number") {
		return (
			typeof left === "number" &&
			typeof right === "number" &&
			Object.is(left, right)
		);
	}
	if (Object.is(left, right)) return true;
	if (Array.isArray(left) || Array.isArray(right)) {
		if (!Array.isArray(left) || !Array.isArray(right)) return false;
		if (left.length !== right.length) return false;
		return left.every((item, index) => sameJson(item, right[index]));
	}
	if (isRecord(left) && isRecord(right)) {
		const leftKeys = Object.keys(left).sort();
		const rightKeys = Object.keys(right).sort();
		if (leftKeys.length !== rightKeys.length) return false;
		return leftKeys.every(
			(key, index) =>
				key === rightKeys[index] && sameJson(left[key], right[key]),
		);
	}
	return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDeepFrozenPlainJson(
	value: unknown,
	seen = new WeakSet<object>(),
): boolean {
	if (value === null) return true;
	if (typeof value === "string" || typeof value === "boolean") return true;
	if (typeof value === "number") {
		return Number.isFinite(value) && !Object.is(value, -0);
	}
	if (typeof value !== "object") return false;
	if (seen.has(value)) return false;
	if (!Object.isFrozen(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	if (Array.isArray(value)) {
		if (prototype !== Array.prototype) return false;
		seen.add(value);
		for (const key of Reflect.ownKeys(value)) {
			if (key === "length") continue;
			if (typeof key !== "string" || !/^(?:0|[1-9]\d*)$/.test(key)) {
				return false;
			}
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			if (
				!descriptor ||
				descriptor.enumerable !== true ||
				!("value" in descriptor)
			) {
				return false;
			}
		}
		if (Object.keys(value).length !== value.length) return false;
		for (let index = 0; index < value.length; index += 1) {
			if (!isDeepFrozenPlainJson(value[index], seen)) return false;
		}
		seen.delete(value);
		return true;
	}
	if (prototype !== Object.prototype) return false;
	seen.add(value);
	for (const key of Reflect.ownKeys(value)) {
		if (typeof key !== "string") return false;
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (
			!descriptor ||
			descriptor.enumerable !== true ||
			!("value" in descriptor)
		) {
			return false;
		}
		if (!isDeepFrozenPlainJson(descriptor.value, seen)) return false;
	}
	seen.delete(value);
	return true;
}

type SchemaCase = { schema: ToolInputSchema; input: unknown };

function freshInput(input: unknown): unknown {
	if (typeof input === "number" && !Number.isFinite(input)) return input;
	if (typeof input === "object" && input !== null) return cloneJson(input);
	return input;
}

async function assertSchemaRejection(schemaCase: SchemaCase): Promise<void> {
	const schema = cloneJson(schemaCase.schema);
	const input = freshInput(schemaCase.input);
	const defined = defineToolSchema({
		act: {
			description: "Act.",
			input: schema,
			consequential: true,
		},
	});
	const manifest = buildManifest(defined, () => true);
	let consulted = 0;
	let thrown = false;
	let resolved: ReturnType<typeof resolveCall> | undefined;
	try {
		resolved = resolveCall(manifest, "act", input, () => {
			consulted += 1;
			return true;
		});
	} catch {
		thrown = true;
	}
	expect(thrown).toBe(false);
	expect(resolved).toMatchObject({
		ok: false,
		error: { kind: "InvalidInput", name: "act" },
	});
	if (resolved && !resolved.ok && resolved.error.kind === "InvalidInput") {
		expect(resolved.error.issues.length).toBeGreaterThan(0);
	}
	expect(consulted).toBe(0);

	const runtime = createRuntime();
	let listed = 0;
	let runConsulted = 0;
	const tools = igniteTools({
		core: runtime as unknown as IgniteToolsRuntime,
		schema: defined,
		canExecute: (_name, value, context) => {
			if (value === undefined && context === undefined) listed += 1;
			else runConsulted += 1;
			return true;
		},
	});
	const ran = await tools.run({
		name: "act",
		input: freshInput(schemaCase.input),
	});
	expect(ran).toMatchObject({
		ok: false,
		error: { kind: "InvalidInput", name: "act" },
	});
	expect(runtime.calls).toEqual([]);
	expect(listed).toBe(1);
	expect(runConsulted).toBe(0);
}

type Outcome = {
	threw: boolean;
	resolveOk: boolean;
	resolveKind?: string;
	resolveInput?: unknown;
	runOk: boolean;
	runKind?: string;
	calls: Call[];
	preflight?: unknown;
	preflightSet: boolean;
};

async function exercise(input: unknown): Promise<Outcome> {
	const runtime = createRuntime();
	let preflight: unknown;
	let preflightSet = false;
	const tools = igniteTools({
		core: runtime as unknown as IgniteToolsRuntime,
		schema: looseSchema,
		canExecute: (_name, value, context) => {
			if (context?.execute === true) {
				preflight = value;
				preflightSet = true;
			}
			return true;
		},
	});
	let threw = false;
	let resolved: ReturnType<typeof tools.resolveCall> | undefined;
	try {
		resolved = tools.resolveCall("act", input);
	} catch {
		threw = true;
	}
	let ran: Awaited<ReturnType<typeof tools.run>> | undefined;
	try {
		ran = await tools.run({ name: "act", input });
	} catch {
		threw = true;
	}
	return {
		threw,
		resolveOk: resolved?.ok === true,
		resolveKind: resolved && !resolved.ok ? resolved.error.kind : undefined,
		resolveInput: resolved?.ok === true ? resolved.value.input : undefined,
		runOk: ran?.ok === true,
		runKind: ran && !ran.ok ? ran.error.kind : undefined,
		calls: runtime.calls,
		preflight,
		preflightSet,
	};
}

function assertRejected(outcome: Outcome, reads: () => number): void {
	expect(outcome.threw).toBe(false);
	expect(outcome.resolveOk).toBe(false);
	expect(outcome.resolveKind).toBe("InvalidInput");
	expect(outcome.runOk).toBe(false);
	expect(outcome.runKind).toBe("InvalidInput");
	expect(outcome.calls).toEqual([]);
	expect(outcome.preflightSet).toBe(false);
	expect(reads()).toBe(0);
}

function assertAccepted(
	outcome: Outcome,
	input: unknown,
	expected: unknown,
	reads: () => number,
	mutate: () => void,
): void {
	expect(outcome.threw).toBe(false);
	expect(outcome.resolveOk).toBe(true);
	expect(outcome.runOk).toBe(true);
	expect(outcome.preflightSet).toBe(true);
	expect(outcome.preflight).toBe(outcome.calls[0]?.input);
	expect(outcome.calls).toHaveLength(1);
	const snapshot = outcome.calls[0]?.input;
	expect(isDeepFrozenPlainJson(snapshot)).toBe(true);
	expect(sameJson(snapshot, JSON.parse(JSON.stringify(snapshot)))).toBe(true);
	expect(sameJson(snapshot, expected)).toBe(true);
	expect(sameJson(outcome.resolveInput, expected)).toBe(true);
	if (typeof input === "object" && input !== null) {
		expect(snapshot).not.toBe(input);
	}
	expect(reads()).toBe(0);
	mutate();
	expect(sameJson(snapshot, expected)).toBe(true);
}

function nonFinite(flag: string): number {
	if (flag === "NaN") return Number.NaN;
	if (flag === "Infinity") return Number.POSITIVE_INFINITY;
	return Number.NEGATIVE_INFINITY;
}

function dataProxy(target: object, reads: { count: number }): object {
	return new Proxy(target, {
		get(current, key, receiver) {
			if (typeof key === "string") reads.count += 1;
			return Reflect.get(current, key, receiver);
		},
	});
}

async function assertProperty<T>(
	arbitrary: fc.Arbitrary<T>,
	predicate: (value: T) => Promise<void>,
): Promise<void> {
	await fc.assert(
		fc.asyncProperty(arbitrary, async (value) => {
			await predicate(value);
			return true;
		}),
		{ seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS, endOnFailure: true },
	);
}

const schemaViolations: fc.Arbitrary<SchemaCase> = fc.oneof(
	fc
		.oneof(
			fc.stringMatching(/^[a-z]{0,4}$/),
			fc.boolean(),
			fc.constant(null),
			fc
				.constantFrom("object", "array")
				.map((shape) => (shape === "object" ? { a: 1 } : [1])),
			fc
				.constantFrom("NaN", "Infinity", "-Infinity")
				.map((flag) => nonFinite(flag)),
		)
		.map((input) => ({ schema: { type: "number" as const }, input })),
	fc
		.tuple(fc.integer({ min: -200, max: 200 }), fc.integer({ min: 1, max: 40 }))
		.map(([minimum, delta]) => ({
			schema: { type: "number" as const, minimum },
			input: minimum - delta,
		})),
	fc
		.tuple(fc.integer({ min: -200, max: 200 }), fc.integer({ min: 1, max: 40 }))
		.map(([maximum, delta]) => ({
			schema: { type: "number" as const, maximum },
			input: maximum + delta,
		})),
	fc.integer({ min: 2, max: 9 }).chain((step) =>
		fc.integer({ min: 0, max: 12 }).map((multiple) => ({
			schema: { type: "number" as const, multipleOf: step },
			input: multiple * step + 1,
		})),
	),
	fc
		.oneof(
			fc.integer({ min: -5, max: 5 }),
			fc.boolean(),
			fc.constant(null),
			fc.constant({ a: 1 }),
			fc.constant([1]),
		)
		.map((input) => ({ schema: { type: "string" as const }, input })),
	fc
		.uniqueArray(fc.stringMatching(/^[a-z]{1,3}$/), {
			minLength: 1,
			maxLength: 4,
		})
		.map((members) => ({
			schema: { type: "string" as const, enum: members },
			input: `${members[0]}#`,
		})),
	fc.integer({ min: 1, max: 6 }).chain((minLength) =>
		fc.stringMatching(/^[a-z]{0,5}$/).map((body) => ({
			schema: { type: "string" as const, minLength },
			input: body.slice(0, minLength - 1),
		})),
	),
	fc.integer({ min: 0, max: 4 }).chain((maxLength) =>
		fc.stringMatching(/^[a-z]{1,3}$/).map((extra) => ({
			schema: { type: "string" as const, maxLength },
			input: `${"a".repeat(maxLength)}${extra}`,
		})),
	),
	fc.stringMatching(/^[a-z]{0,4}[0-9][a-z0-9]{0,4}$/).map((input) => ({
		schema: { type: "string" as const, pattern: "^[a-z]+$" },
		input,
	})),
	fc
		.oneof(
			fc.integer({ min: -2, max: 2 }),
			fc.stringMatching(/^[a-z]{0,4}$/),
			fc.constant(null),
			fc.constant({ a: true }),
			fc.constant([true]),
		)
		.map((input) => ({ schema: { type: "boolean" as const }, input })),
	fc
		.oneof(
			fc.integer({ min: -2, max: 2 }),
			fc.stringMatching(/^[a-z]{0,4}$/),
			fc.boolean(),
			fc.constant(null),
			fc.constant([1]),
		)
		.map((input) => ({
			schema: {
				type: "object" as const,
				properties: { a: { type: "number" as const } },
			},
			input,
		})),
	fc.constantFrom({}, { b: 1 }, { a: "x" }).map((input) => ({
		schema: {
			type: "object" as const,
			properties: { a: { type: "number" as const } },
			required: ["a"],
		},
		input,
	})),
	fc
		.oneof(
			fc.stringMatching(/^[a-z0-9]{0,4}$/),
			fc.boolean(),
			fc.constant(null),
			fc.constant([1]),
			fc.constant({ n: 1 }),
		)
		.map((bad) => ({
			schema: {
				type: "object" as const,
				properties: { a: { type: "number" as const } },
			},
			input: { a: bad },
		})),
	fc.stringMatching(/^[a-z]{1,3}$/).chain((key) =>
		fc
			.oneof(
				fc.integer({ min: 0, max: 3 }),
				fc.stringMatching(/^[a-z]{0,2}$/),
				fc.boolean(),
			)
			.map((value) => ({
				schema: { type: "object" as const, properties: {} },
				input: { [key]: value },
			})),
	),
	fc
		.oneof(
			fc.integer({ min: -2, max: 2 }),
			fc.stringMatching(/^[a-z]{0,3}$/),
			fc.boolean(),
			fc.constant(null),
			fc.constant({ a: 1 }),
		)
		.map((input) => ({
			schema: {
				type: "array" as const,
				items: { type: "number" as const },
			},
			input,
		})),
	fc.integer({ min: 1, max: 4 }).chain((minItems) =>
		fc
			.array(fc.integer({ min: 0, max: 5 }), {
				minLength: 0,
				maxLength: minItems - 1,
			})
			.map((input) => ({
				schema: {
					type: "array" as const,
					minItems,
					items: { type: "number" as const },
				},
				input,
			})),
	),
	fc.integer({ min: 0, max: 3 }).chain((maxItems) =>
		fc
			.array(fc.integer({ min: 0, max: 5 }), {
				minLength: maxItems + 1,
				maxLength: maxItems + 2,
			})
			.map((input) => ({
				schema: {
					type: "array" as const,
					maxItems,
					items: { type: "number" as const },
				},
				input,
			})),
	),
	fc.array(fc.integer({ min: 0, max: 9 }), { maxLength: 3 }).map((prefix) => ({
		schema: {
			type: "array" as const,
			items: { type: "number" as const, minimum: 0 },
		},
		input: [...prefix, -1],
	})),
);

describe(`igniteTools fail-closed properties (seed ${PROPERTY_SEED}, runs ${PROPERTY_RUNS})`, () => {
	it("rejects every input that fails the schema", async () => {
		await assertProperty(schemaViolations, assertSchemaRejection);
	}, 60_000);

	it("shares one frozen plain-JSON snapshot for every accepted input", async () => {
		await assertProperty(jsonValue, async (value) => {
			const source = cloneJson(value);
			const input = { v: source };
			const expected = { v: cloneJson(value) };
			const outcome = await exercise(input);
			assertAccepted(
				outcome,
				input,
				expected,
				() => 0,
				() => {
					if (source && typeof source === "object") {
						if (Array.isArray(source)) source.push("mutated");
						else (source as Record<string, unknown>).mutated = true;
					} else {
						input.v = "mutated";
					}
				},
			);
		});

		await assertProperty(
			fc.record({ root: fc.boolean(), value: jsonContainer }),
			async ({ root, value }) => {
				const reads = { count: 0 };
				const payload = cloneJson(value);
				const expected = { v: cloneJson(value) };
				const target = root ? { v: payload } : (payload as object);
				const proxy = dataProxy(target, reads);
				const input = root ? proxy : { v: proxy };
				const outcome = await exercise(input);
				const liveReads = reads.count;
				assertAccepted(
					outcome,
					input,
					expected,
					() => liveReads,
					() => {
						if (Array.isArray(payload)) payload.push("mutated");
						else (payload as Record<string, unknown>).mutated = true;
					},
				);
			},
		);

		await assertProperty(jsonValue, async (value) => {
			const input = Object.create(null) as { v?: unknown; extra?: number };
			input.v = cloneJson(value);
			const expected = { v: cloneJson(value) };
			const outcome = await exercise(input);
			assertAccepted(
				outcome,
				input,
				expected,
				() => 0,
				() => {
					input.extra = 1;
				},
			);
		});

		await assertProperty(jsonValue, async (value) => {
			const input = { v: cloneJson(value) } as {
				v: unknown;
				hidden?: string;
			};
			Object.defineProperty(input, "hidden", {
				value: "secret",
				enumerable: false,
				writable: true,
				configurable: true,
			});
			const expected = { v: cloneJson(value) };
			const outcome = await exercise(input);
			assertAccepted(
				outcome,
				input,
				expected,
				() => 0,
				() => {
					input.hidden = "changed";
				},
			);
		});

		await assertProperty(
			fc.constantFrom("number", "object", "array"),
			async (shape) => {
				const input =
					shape === "number"
						? { v: -0 }
						: shape === "object"
							? { v: { n: -0 } }
							: { v: [-0, 1] };
				const expected =
					shape === "number"
						? { v: 0 }
						: shape === "object"
							? { v: { n: 0 } }
							: { v: [0, 1] };
				const outcome = await exercise(input);
				assertAccepted(
					outcome,
					input,
					expected,
					() => 0,
					() => {
						if (shape === "number") {
							(input as { v: number }).v = 4;
						} else if (shape === "object") {
							(input as { v: { n: number } }).v.n = 4;
						} else {
							(input as { v: number[] }).v.push(4);
						}
					},
				);
			},
		);

		await assertProperty(fc.constant(null), async () => {
			let reads = 0;
			const input: { v?: number } = {};
			Object.defineProperty(input, "v", {
				enumerable: true,
				configurable: true,
				get() {
					reads += 1;
					return 1;
				},
			});
			assertRejected(await exercise(input), () => reads);
		});

		await assertProperty(fc.constant(null), async () => {
			let reads = 0;
			const target: { v?: number } = {};
			Object.defineProperty(target, "v", {
				enumerable: true,
				configurable: true,
				get() {
					reads += 1;
					return 1;
				},
			});
			assertRejected(await exercise(new Proxy(target, {})), () => reads);
		});

		await assertProperty(fc.constant(null), async () => {
			const inner: { self?: unknown } = {};
			inner.self = inner;
			assertRejected(await exercise({ v: inner }), () => 0);
		});

		await assertProperty(
			fc.constantFrom("NaN", "Infinity", "-Infinity"),
			async (flag) => {
				assertRejected(await exercise({ v: nonFinite(flag) }), () => 0);
			},
		);

		await assertProperty(fc.constant(null), async () => {
			assertRejected(await exercise({ v: new Date(0) }), () => 0);
		});
		await assertProperty(fc.constant(null), async () => {
			assertRejected(await exercise({ v: new Map() }), () => 0);
		});
		await assertProperty(fc.constant(null), async () => {
			assertRejected(await exercise({ v: new Set() }), () => 0);
		});

		await assertProperty(jsonValue, async (value) => {
			const input: Record<string | symbol, unknown> = { v: cloneJson(value) };
			input[Symbol("id")] = "x";
			assertRejected(await exercise(input), () => 0);
		});

		await assertProperty(fc.constant(null), async () => {
			const items: Array<number | undefined> = [1, 2, 3];
			delete items[1];
			assertRejected(await exercise({ v: items }), () => 0);
		});

		await assertProperty(fc.constant(null), async () => {
			assertRejected(await exercise({ v: 1n }), () => 0);
		});
		await assertProperty(fc.constant(null), async () => {
			assertRejected(await exercise({ v: () => 1 }), () => 0);
		});
		await assertProperty(fc.constant(null), async () => {
			const input = new Proxy(
				{ v: 1 },
				{
					ownKeys() {
						throw new Error("ownKeys");
					},
				},
			);
			assertRejected(await exercise(input), () => 0);
		});
	}, 60_000);

	it("returns ToolError when the predicate throws", async () => {
		const reason = fc.oneof(
			fc.string({ maxLength: 12 }),
			fc.integer({ min: -5, max: 5 }),
			fc.constant(undefined),
			fc.constant(null),
		);
		const input = { v: 1 };

		await assertProperty(reason, async (thrown) => {
			const runtime = createRuntime();
			let tools: ReturnType<typeof igniteTools> | undefined;
			expect(() => {
				tools = igniteTools({
					core: runtime as unknown as IgniteToolsRuntime,
					schema: looseSchema,
					canExecute: () => {
						throw thrown;
					},
				});
			}).not.toThrow();
			if (!tools) throw new Error("bind failed");
			expect(
				tools.manifest.find((tool) => tool.name === "act"),
			).toBeUndefined();
			expect(tools.resolveCall("act", input)).toEqual({
				ok: false,
				error: { kind: "UnknownCommand", name: "act" },
			});
			await expect(tools.run({ name: "act", input })).resolves.toEqual({
				ok: false,
				error: { kind: "UnknownCommand", name: "act" },
			});
			expect(runtime.calls).toEqual([]);
		});

		await assertProperty(reason, async (thrown) => {
			const runtime = createRuntime();
			let executeChecks = 0;
			const tools = igniteTools({
				core: runtime as unknown as IgniteToolsRuntime,
				schema: looseSchema,
				canExecute: (_name, _value, context) => {
					if (context?.execute === true) {
						executeChecks += 1;
						throw thrown;
					}
					return true;
				},
			});
			expect(tools.manifest.find((tool) => tool.name === "act")).toBeDefined();
			expect(tools.resolveCall("act", input).ok).toBe(true);
			await expect(tools.run({ name: "act", input })).resolves.toEqual({
				ok: false,
				error: { kind: "Unavailable", name: "act" },
			});
			expect(executeChecks).toBe(1);
			expect(runtime.calls).toEqual([]);
		});

		await assertProperty(reason, async (thrown) => {
			const runtime = createRuntime();
			const tools = igniteTools({
				core: runtime as unknown as IgniteToolsRuntime,
				schema: looseSchema,
				canExecute: (_name, value, context) => {
					if (value !== undefined || context !== undefined) throw thrown;
					return true;
				},
			});
			expect(tools.manifest.find((tool) => tool.name === "act")).toBeDefined();
			expect(tools.resolveCall("act", input)).toEqual({
				ok: false,
				error: { kind: "Unavailable", name: "act" },
			});
			await expect(tools.run({ name: "act", input })).resolves.toEqual({
				ok: false,
				error: { kind: "Unavailable", name: "act" },
			});
			expect(runtime.calls).toEqual([]);
		});
	}, 60_000);
});

/**
 * The input value that passes validation is exactly the value routed to
 * canExecute and execute. The schema default is read once.
 * CI seed: 20261011. Runs: 200.
 */

type RawValue =
	| { kind: "undefined" }
	| { kind: "number"; n: number }
	| { kind: "negzero" }
	| { kind: "nan" }
	| { kind: "posinf" }
	| { kind: "neginf" }
	| { kind: "string"; s: string }
	| { kind: "boolean"; b: boolean }
	| { kind: "null" }
	| { kind: "object"; v: number | null }
	| { kind: "array"; items: number[] }
	| { kind: "date" }
	| { kind: "map" }
	| { kind: "set" }
	| { kind: "bigint" };

type DefaultAccess = "changing-getter" | "stable-getter" | "data";

type DefaultSample = {
	type: "number" | "string" | "boolean" | "object" | "array";
	minimum: number | undefined;
	maximum: number | undefined;
	multipleOf: number | undefined;
	minLength: number | undefined;
	maxLength: number | undefined;
	enumValues: string[] | undefined;
	pattern: boolean;
	required: boolean;
	minItems: number | undefined;
	maxItems: number | undefined;
	placement: "top" | "nested";
	access: DefaultAccess;
	first: RawValue;
	later: RawValue;
};

function materializeRaw(raw: RawValue): unknown {
	switch (raw.kind) {
		case "undefined":
			return undefined;
		case "number":
			return raw.n;
		case "negzero":
			return -0;
		case "nan":
			return Number.NaN;
		case "posinf":
			return Number.POSITIVE_INFINITY;
		case "neginf":
			return Number.NEGATIVE_INFINITY;
		case "string":
			return raw.s;
		case "boolean":
			return raw.b;
		case "null":
			return null;
		case "object":
			return raw.v === null ? {} : { v: raw.v };
		case "array":
			return raw.items.slice();
		case "date":
			return new Date(0);
		case "map":
			return new Map();
		case "set":
			return new Set();
		case "bigint":
			return 1n;
	}
}

function optionalNumber(
	min: number,
	max: number,
): fc.Arbitrary<number | undefined> {
	return fc.oneof(
		{ weight: 2, arbitrary: fc.constant(undefined) },
		{ weight: 3, arbitrary: fc.integer({ min, max }) },
	);
}

const rawValue: fc.Arbitrary<RawValue> = fc.oneof(
	{ weight: 5, arbitrary: fc.constant({ kind: "undefined" }) },
	{
		weight: 4,
		arbitrary: fc
			.integer({ min: -30, max: 30 })
			.map((n): RawValue => ({ kind: "number", n })),
	},
	{ weight: 1, arbitrary: fc.constant({ kind: "negzero" }) },
	{ weight: 1, arbitrary: fc.constant({ kind: "nan" }) },
	{ weight: 1, arbitrary: fc.constant({ kind: "posinf" }) },
	{ weight: 1, arbitrary: fc.constant({ kind: "neginf" }) },
	{
		weight: 3,
		arbitrary: fc
			.stringMatching(/^[a-z0-9]{0,6}$/)
			.map((s): RawValue => ({ kind: "string", s })),
	},
	{
		weight: 2,
		arbitrary: fc.boolean().map((b): RawValue => ({ kind: "boolean", b })),
	},
	{ weight: 1, arbitrary: fc.constant({ kind: "null" }) },
	{
		weight: 2,
		arbitrary: fc
			.oneof(fc.constant(null), fc.integer({ min: -10, max: 10 }))
			.map((v): RawValue => ({ kind: "object", v })),
	},
	{
		weight: 2,
		arbitrary: fc
			.array(fc.integer({ min: -10, max: 10 }), { maxLength: 3 })
			.map((items): RawValue => ({ kind: "array", items })),
	},
	{ weight: 1, arbitrary: fc.constant({ kind: "date" }) },
	{ weight: 1, arbitrary: fc.constant({ kind: "map" }) },
	{ weight: 1, arbitrary: fc.constant({ kind: "set" }) },
	{ weight: 1, arbitrary: fc.constant({ kind: "bigint" }) },
);

const defaultSample: fc.Arbitrary<DefaultSample> = fc.record({
	type: fc.constantFrom("number", "string", "boolean", "object", "array"),
	minimum: optionalNumber(-5, 5),
	maximum: optionalNumber(-5, 5),
	multipleOf: optionalNumber(1, 4),
	minLength: optionalNumber(0, 3),
	maxLength: optionalNumber(0, 6),
	enumValues: fc.oneof(
		{ weight: 2, arbitrary: fc.constant(undefined) },
		{
			weight: 1,
			arbitrary: fc.array(fc.stringMatching(/^[a-z]{1,3}$/), {
				minLength: 1,
				maxLength: 3,
			}),
		},
	),
	pattern: fc.boolean(),
	required: fc.boolean(),
	minItems: optionalNumber(0, 2),
	maxItems: optionalNumber(0, 3),
	placement: fc.constantFrom("top", "nested"),
	access: fc.constantFrom("changing-getter", "stable-getter", "data"),
	first: rawValue,
	later: rawValue,
});

function constraintSchema(sample: DefaultSample): ToolInputSchema {
	const schema: ToolInputSchema = { type: sample.type };
	if (sample.type === "number") {
		if (sample.minimum !== undefined) schema.minimum = sample.minimum;
		if (sample.maximum !== undefined) schema.maximum = sample.maximum;
		if (sample.multipleOf !== undefined) schema.multipleOf = sample.multipleOf;
	}
	if (sample.type === "string") {
		if (sample.minLength !== undefined) schema.minLength = sample.minLength;
		if (sample.maxLength !== undefined) schema.maxLength = sample.maxLength;
		if (sample.enumValues !== undefined) schema.enum = sample.enumValues;
		if (sample.pattern) schema.pattern = "^[a-z]+$";
	}
	if (sample.type === "object") {
		schema.properties = { v: { type: "number" } };
		if (sample.required) schema.required = ["v"];
	}
	if (sample.type === "array") {
		schema.items = { type: "number" };
		if (sample.minItems !== undefined) schema.minItems = sample.minItems;
		if (sample.maxItems !== undefined) schema.maxItems = sample.maxItems;
	}
	return schema;
}

function omitOwnDefault(schema: ToolInputSchema): ToolInputSchema {
	const copy: ToolInputSchema = {};
	for (const key of Reflect.ownKeys(schema)) {
		if (key === "default") continue;
		const descriptor = Object.getOwnPropertyDescriptor(schema, key);
		if (descriptor) Object.defineProperty(copy, key, descriptor);
	}
	return copy;
}

function watchDefault(
	schema: ToolInputSchema,
	access: DefaultAccess,
	first: unknown,
	later: unknown,
): { schema: ToolInputSchema; reads: unknown[] } {
	const reads: unknown[] = [];
	if (access === "data") {
		schema.default = first;
	} else {
		const values = access === "stable-getter" ? [first] : [first, later];
		let index = 0;
		Object.defineProperty(schema, "default", {
			enumerable: true,
			configurable: true,
			get() {
				const value = values[Math.min(index, values.length - 1)];
				index += 1;
				return value;
			},
		});
	}
	const wrapped = new Proxy(schema, {
		get(target, key, receiver) {
			const value = Reflect.get(target, key, receiver);
			if (key === "default") reads.push(value);
			return value;
		},
	});
	return { schema: wrapped, reads };
}

function expectedFromMaterialized(
	schema: ToolInputSchema,
	materialized: unknown,
	placement: DefaultSample["placement"],
): { ok: true; input: unknown } | { ok: false } {
	if (placement === "nested") {
		const parent: ToolInputSchema = {
			type: "object",
			properties: { v: omitOwnDefault(schema) },
		};
		const snapshot = snapshotPlainJson({ v: materialized }, "input", parent);
		if (!snapshot.ok) return { ok: false };
		const issues = validateToolInputValue(parent, snapshot.value, "input");
		if (issues.length > 0) return { ok: false };
		return { ok: true, input: snapshot.value };
	}
	const bare = omitOwnDefault(schema);
	if (materialized === undefined) {
		const issues = validateToolInputValue(bare, undefined, "input");
		if (issues.length > 0) return { ok: false };
		return { ok: true, input: undefined };
	}
	const snapshot = snapshotPlainJson(materialized, "input", bare);
	if (!snapshot.ok) return { ok: false };
	const issues = validateToolInputValue(bare, snapshot.value, "input");
	if (issues.length > 0) return { ok: false };
	return { ok: true, input: snapshot.value };
}

function prepareDefault(sample: DefaultSample): {
	schema: ReturnType<typeof defineToolSchema>;
	input: unknown;
	reads: unknown[];
	watched: ToolInputSchema;
} {
	const first = materializeRaw(sample.first);
	const later = materializeRaw(sample.later);
	const watched = watchDefault(
		constraintSchema(sample),
		sample.access,
		first,
		later,
	);
	const inputSchema =
		sample.placement === "top"
			? watched.schema
			: { type: "object" as const, properties: { v: watched.schema } };
	return {
		schema: defineToolSchema({
			act: {
				description: "Act.",
				input: inputSchema,
				consequential: true,
			},
		}),
		input: sample.placement === "top" ? undefined : { v: undefined },
		reads: watched.reads,
		watched: watched.schema,
	};
}

function assertMaterializedRoute(
	ok: boolean,
	routed: unknown,
	seen: unknown[],
	executed: unknown,
	expected: { ok: true; input: unknown } | { ok: false },
): void {
	if (!expected.ok) {
		expect(ok).toBe(false);
		expect(seen).toEqual([]);
		expect(executed).toBeUndefined();
		return;
	}
	expect(ok).toBe(true);
	expect(seen).toHaveLength(1);
	expect(seen[0]).toBe(routed);
	expect(executed).toBe(routed);
	expect(sameJson(routed, expected.input)).toBe(true);
	if (routed !== undefined) {
		expect(isDeepFrozenPlainJson(routed)).toBe(true);
	}
}

describe(`schema default is materialized once (seed ${PROPERTY_SEED}, runs ${PROPERTY_RUNS})`, () => {
	it("routes the validated default to canExecute and execute", async () => {
		// The input value that passes validation is exactly the value routed
		// to canExecute and execute. The schema default is read once, including
		// when a getter returns a different value on every read.
		await fc.assert(
			fc.asyncProperty(defaultSample, async (sample) => {
				const resolved = prepareDefault(sample);
				expect(resolved.reads).toEqual([]);
				const manifest = buildManifest(resolved.schema, () => true);
				expect(resolved.reads).toEqual([]);
				const resolveSeen: unknown[] = [];
				let resolveThrew = false;
				let resolveResult: ReturnType<typeof resolveCall> | undefined;
				try {
					resolveResult = resolveCall(
						manifest,
						"act",
						resolved.input,
						(_name, value) => {
							resolveSeen.push(value);
							return true;
						},
					);
				} catch {
					resolveThrew = true;
				}
				expect(resolveThrew).toBe(false);
				expect(resolved.reads).toHaveLength(1);
				const resolveExpected = expectedFromMaterialized(
					resolved.watched,
					resolved.reads[0],
					sample.placement,
				);
				assertMaterializedRoute(
					resolveResult?.ok === true,
					resolveResult?.ok === true ? resolveResult.value.input : undefined,
					resolveSeen,
					resolveResult?.ok === true ? resolveResult.value.input : undefined,
					resolveExpected,
				);
				if (!resolveResult?.ok) {
					expect(resolveResult).toMatchObject({
						ok: false,
						error: { kind: "InvalidInput", name: "act" },
					});
				}

				const ran = prepareDefault(sample);
				expect(ran.reads).toEqual([]);
				const runtime = createRuntime();
				const runSeen: unknown[] = [];
				const tools = igniteTools({
					core: runtime as unknown as IgniteToolsRuntime,
					schema: ran.schema,
					canExecute: (_name, value, context) => {
						if (context?.execute === true) runSeen.push(value);
						return true;
					},
				});
				expect(ran.reads).toEqual([]);
				let runThrew = false;
				let runResult: Awaited<ReturnType<typeof tools.run>> | undefined;
				try {
					runResult = await tools.run({ name: "act", input: ran.input });
				} catch {
					runThrew = true;
				}
				expect(runThrew).toBe(false);
				expect(ran.reads).toHaveLength(1);
				const runExpected = expectedFromMaterialized(
					ran.watched,
					ran.reads[0],
					sample.placement,
				);
				assertMaterializedRoute(
					runResult?.ok === true,
					runSeen[0],
					runSeen,
					runtime.calls[0]?.input,
					runExpected,
				);
				if (!runResult?.ok) {
					expect(runResult).toMatchObject({
						ok: false,
						error: { kind: "InvalidInput", name: "act" },
					});
					expect(runtime.calls).toEqual([]);
				}
				return true;
			}),
			{
				seed: PROPERTY_SEED,
				numRuns: PROPERTY_RUNS,
				endOnFailure: true,
			},
		);
	}, 60_000);
});

const commandName = fc.stringMatching(/^[a-z][a-z0-9]{0,6}$/);

type HostileTag =
	| "object"
	| "array"
	| "number"
	| "null"
	| "date"
	| "cycle"
	| "proxy"
	| "nan";

const allowlistedCase = fc
	.uniqueArray(commandName, { minLength: 1, maxLength: 4 })
	.chain((names) =>
		fc.record({
			names: fc.constant(names),
			allow: fc.shuffledSubarray(names),
			tag: fc.constantFrom(
				"object" as const,
				"array" as const,
				"number" as const,
				"null" as const,
				"date" as const,
				"cycle" as const,
				"proxy" as const,
				"nan" as const,
			),
			payload: plainJson(1),
		}),
	);

function schemaFor(names: readonly string[]): ToolSchema {
	const commands: {
		[name: string]: {
			description: string;
			input: ToolInputSchema;
			consequential: true;
		};
	} = {};
	for (const name of names) {
		commands[name] = {
			description: "Act.",
			input: { type: "object", properties: { v: {} } },
			consequential: true,
		};
	}
	return commands;
}

function callInput(tag: HostileTag, payload: unknown): unknown {
	if (tag === "object") return { v: cloneJson(payload) };
	if (tag === "array") return [cloneJson(payload)];
	if (tag === "number") return 4;
	if (tag === "null") return null;
	if (tag === "date") return new Date(0);
	if (tag === "nan") return Number.NaN;
	if (tag === "cycle") {
		const cycle: { self?: unknown } = {};
		cycle.self = cycle;
		return cycle;
	}
	return new Proxy(
		{ v: 1 },
		{
			ownKeys() {
				throw new Error("ownKeys");
			},
		},
	);
}

describe(`non-allowlisted commands are denied (seed ${PROPERTY_SEED}, runs ${PROPERTY_RUNS})`, () => {
	it("denies every command outside the allowlist", async () => {
		// Arbitrary non-allowlisted commands are always denied.
		// Hostile inputs are generated. An allowlisted plain object still runs.
		await fc.assert(
			fc.asyncProperty(allowlistedCase, async (sample) => {
				const allow = new Set(sample.allow);
				const defined = defineToolSchema(schemaFor(sample.names));
				const runtime = createRuntime();
				let threw = false;
				let tools: ReturnType<typeof igniteTools> | undefined;
				try {
					tools = igniteTools({
						core: runtime as unknown as IgniteToolsRuntime,
						schema: defined,
						canExecute: (name) => allow.has(name),
					});
				} catch {
					threw = true;
				}
				expect(threw).toBe(false);
				if (!tools) throw new Error("bind failed");
				for (const name of sample.names) {
					expect(tools.manifest.some((tool) => tool.name === name)).toBe(
						allow.has(name),
					);
				}
				const outsider = `!${sample.names[0]}`;
				for (const name of [...sample.names, outsider]) {
					const allowed = allow.has(name) && sample.names.includes(name);
					let resolveThrew = false;
					let resolved: ReturnType<typeof tools.resolveCall> | undefined;
					try {
						resolved = tools.resolveCall(
							name,
							callInput(sample.tag, sample.payload),
						);
					} catch {
						resolveThrew = true;
					}
					let runThrew = false;
					let ran: Awaited<ReturnType<typeof tools.run>> | undefined;
					try {
						ran = await tools.run({
							name,
							input: callInput(sample.tag, sample.payload),
						});
					} catch {
						runThrew = true;
					}
					expect(resolveThrew).toBe(false);
					expect(runThrew).toBe(false);
					if (!allowed) {
						expect(resolved?.ok).toBe(false);
						expect(ran?.ok).toBe(false);
						expect(resolved).toMatchObject({
							ok: false,
							error: { kind: "UnknownCommand", name },
						});
						expect(ran).toMatchObject({
							ok: false,
							error: { kind: "UnknownCommand", name },
						});
						continue;
					}
					if (sample.tag === "object") {
						expect(resolved?.ok).toBe(true);
						expect(ran?.ok).toBe(true);
						continue;
					}
					expect(resolved).toMatchObject({
						ok: false,
						error: { kind: "InvalidInput", name },
					});
					expect(ran).toMatchObject({
						ok: false,
						error: { kind: "InvalidInput", name },
					});
				}
				const executed = runtime.calls.map((call) => call.command);
				expect(executed.every((name) => allow.has(name))).toBe(true);
				if (sample.tag !== "object") {
					expect(runtime.calls).toEqual([]);
				} else expect(runtime.calls).toHaveLength(sample.allow.length);
				return true;
			}),
			{
				seed: PROPERTY_SEED,
				numRuns: PROPERTY_RUNS,
				endOnFailure: true,
			},
		);
	}, 60_000);
});

describe(`no-arg snapshot is the routed input (seed ${PROPERTY_SEED}, runs ${PROPERTY_RUNS})`, () => {
	it("routes the validated {} snapshot to canExecute and execute", async () => {
		// The input value that passes validation is exactly the value routed
		// to canExecute and execute, including {}.
		const empty = fc.constantFrom(
			"plain" as const,
			"null-proto" as const,
			"parsed" as const,
			"frozen" as const,
		);

		function providerEmpty(kind: "plain" | "null-proto" | "parsed" | "frozen") {
			if (kind === "null-proto") return Object.create(null) as object;
			if (kind === "parsed") return JSON.parse("{}") as object;
			if (kind === "frozen") return Object.freeze({});
			return {};
		}

		await fc.assert(
			fc.asyncProperty(
				empty,
				fc.stringMatching(/^[a-z][a-z0-9]{0,5}$/),
				async (kind, name) => {
					const input = providerEmpty(kind);
					const preflight: unknown[] = [];
					const consuming: unknown[] = [];
					const runtime = createRuntime();
					const tools = igniteTools({
						core: runtime as unknown as IgniteToolsRuntime,
						schema: defineToolSchema({
							[name]: {
								description: "No arguments.",
								input: { type: "object", properties: {} },
								consequential: true,
							},
						}),
						canExecute: (_command, value, context) => {
							if (context?.execute) consuming.push(value);
							else if (context) preflight.push(value);
							return true;
						},
					});
					const resolved = tools.resolveCall(name, input);
					expect(resolved.ok).toBe(true);
					if (!resolved.ok) return false;
					const snapshot = resolved.value.input;
					expect(snapshot).toEqual({});
					expect(Object.isFrozen(snapshot)).toBe(true);
					expect(preflight[preflight.length - 1]).toBe(snapshot);
					const ran = await tools.run({ name, input });
					expect(ran.ok).toBe(true);
					const executed = runtime.calls[runtime.calls.length - 1]?.input;
					expect(executed).toEqual({});
					expect(Object.isFrozen(executed)).toBe(true);
					expect(consuming[consuming.length - 1]).toBe(executed);
					return true;
				},
			),
			{ seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS, endOnFailure: true },
		);
	}, 60_000);
});

function publishedToolsGuide(): string {
	let dir = process.cwd();
	for (let hop = 0; hop < 6; hop += 1) {
		const candidate = path.join(
			dir,
			"docs/site/src/content/docs/guides/tools.mdx",
		);
		if (existsSync(candidate)) return candidate;
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	throw new Error("published tools guide missing");
}

describe(`published approval guide keeps distinct depth-boundary keys (seed ${PROPERTY_SEED}, runs ${PROPERTY_RUNS})`, () => {
	it("does not share an approval key for accepted values that differ at the depth boundary", async () => {
		// Two values that snapshot accepts and that differ only at the
		// depth-boundary leaf must not share an approval key when canonicalized
		// the way the published guide specifies.
		const guidePath = publishedToolsGuide();
		const source = readFileSync(guidePath, "utf8");
		const fence = [...source.matchAll(/```ts\n([\s\S]*?)```/g)].find((match) =>
			match[1]?.includes("function canonicalValue"),
		);
		const block = fence?.[1];
		if (!block) throw new Error("published canonicalizer missing");
		const start = block.indexOf("function plainSnapshotShape");
		const end = block.indexOf("const granted");
		if (start < 0 || end < start) {
			throw new Error("published canonicalizer shape changed");
		}
		const compiled = ts.transpileModule(block.slice(start, end), {
			compilerOptions: {
				module: ts.ModuleKind.None,
				target: ts.ScriptTarget.ES2022,
			},
		}).outputText;
		const canonicalCall = new Function(
			`${compiled}\nreturn canonicalCall;`,
		)() as (name: string, input: unknown) => string;

		const boundaryContainers = 33;
		const leaf = fc.oneof(
			fc.integer({ min: -30, max: 30 }),
			fc.stringMatching(/^[a-z0-9]{0,4}$/),
			fc.boolean(),
			fc.constant(null),
		);
		const innerKind = fc.constantFrom("object" as const, "array" as const);
		const manifest = buildManifest(
			defineToolSchema({
				act: {
					description: "Nested payload.",
					input: { type: "object", properties: { hold: {} } },
					consequential: true,
				},
			}),
			() => true,
		);

		function bury(
			value: unknown,
			kinds: ReadonlyArray<"object" | "array">,
			key: string,
		): unknown {
			let current = value;
			for (let index = kinds.length - 1; index >= 0; index -= 1) {
				current = kinds[index] === "array" ? [current] : { [key]: current };
			}
			return current;
		}

		await fc.assert(
			fc.asyncProperty(
				leaf,
				leaf,
				fc.array(innerKind, {
					minLength: boundaryContainers - 1,
					maxLength: boundaryContainers - 1,
				}),
				fc.stringMatching(/^[a-z]$/),
				async (leftLeaf, rightLeaf, inner, key) => {
					fc.pre(JSON.stringify(leftLeaf) !== JSON.stringify(rightLeaf));
					const kinds = ["object" as const, ...inner];
					const left = resolveCall(
						manifest,
						"act",
						bury(leftLeaf, kinds, key),
						() => true,
					);
					const right = resolveCall(
						manifest,
						"act",
						bury(rightLeaf, kinds, key),
						() => true,
					);
					expect(left.ok).toBe(true);
					expect(right.ok).toBe(true);
					if (!left.ok || !right.ok) return false;
					expect(canonicalCall("act", left.value.input)).not.toBe(
						canonicalCall("act", right.value.input),
					);
					return true;
				},
			),
			{ seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS, endOnFailure: true },
		);
	}, 60_000);
});

describe(`toStringTag getters stay unread (seed ${PROPERTY_SEED}, runs ${PROPERTY_RUNS})`, () => {
	it("does not invoke a Symbol.toStringTag getter while rejecting the input", async () => {
		// A Symbol.toStringTag getter must not be invoked while snapshotting
		// or validating an input that is rejected. That includes a getter that
		// rewrites a field and deletes itself.
		const objectSchema = {
			type: "object" as const,
			properties: {
				a: { type: "number" as const },
				n: { type: "number" as const },
			},
		};
		const nestedSchema = {
			type: "object" as const,
			properties: { hold: objectSchema },
		};
		const mutation = fc.oneof(
			{
				weight: 2,
				arbitrary: fc.constant({
					field: "a" as const,
					from: 1,
					to: 999,
					where: "top" as const,
				}),
			},
			{
				weight: 3,
				arbitrary: fc.record({
					field: fc.constantFrom("a" as const, "n" as const),
					from: fc.integer({ min: -30, max: 30 }),
					to: fc.integer({ min: 100, max: 999 }),
					where: fc.constantFrom("top" as const, "nested" as const),
				}),
			},
		);
		const side = fc.constantFrom(
			"observe" as const,
			"throw" as const,
			"none" as const,
		);

		await fc.assert(
			fc.asyncProperty(
				mutation,
				side,
				fc.oneof(fc.constant("Object"), fc.string({ maxLength: 8 })),
				async (sample, sideKind, brand) => {
					fc.pre(sample.from !== sample.to);
					const attempt = async (
						kind: "rewrite-and-delete" | "observe" | "throw",
						field: "a" | "n",
						from: number,
						to: number,
						where: "top" | "nested",
					) => {
						let reads = 0;
						const host: {
							a?: number;
							n?: number;
							[Symbol.toStringTag]?: unknown;
						} = { [field]: from };
						Object.defineProperty(host, Symbol.toStringTag, {
							configurable: true,
							enumerable: false,
							get() {
								reads += 1;
								if (kind === "throw") throw new Error("toStringTag");
								if (kind === "rewrite-and-delete") {
									host[field] = to;
									delete host[Symbol.toStringTag];
									return "Object";
								}
								return brand;
							},
						});
						const input = where === "top" ? host : { hold: host };
						const schema = where === "top" ? objectSchema : nestedSchema;
						const manifest = buildManifest(
							defineToolSchema({
								act: {
									description: "Payload.",
									input: schema,
									consequential: true,
								},
							}),
							() => true,
						);
						const snap = snapshotPlainJson(input, "input", schema);
						validateToolInputValue(schema, input, "input");
						const routed = resolveCall(manifest, "act", input, () => true);
						const runtime = createRuntime();
						const tools = igniteTools({
							core: runtime as unknown as IgniteToolsRuntime,
							schema: defineToolSchema({
								act: {
									description: "Payload.",
									input: schema,
									consequential: true,
								},
							}),
							canExecute: () => true,
						});
						const ran = await tools.run({ name: "act", input });
						expect(snap.ok).toBe(false);
						expect(routed.ok).toBe(false);
						expect(ran.ok).toBe(false);
						expect(runtime.calls).toEqual([]);
						expect(host[field]).toBe(from);
						expect(reads).toBe(0);
						expect(
							typeof Object.getOwnPropertyDescriptor(host, Symbol.toStringTag)
								?.get,
						).toBe("function");
					};
					await attempt(
						"rewrite-and-delete",
						sample.field,
						sample.from,
						sample.to,
						sample.where,
					);
					if (sideKind !== "none") {
						await attempt(
							sideKind,
							sample.field,
							sample.from,
							sample.to,
							sample.where,
						);
					}
					return true;
				},
			),
			{ seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS, endOnFailure: true },
		);
	}, 60_000);
});

type HostilePlant = { a: number } | number[];

type HostileInput = {
	input: object;
	planted: HostilePlant;
	mutated: HostilePlant;
	getReads: () => number;
	ctorReads: () => number;
	restore: () => void;
};

type ApprovalAuthority = {
	grant(approval: {
		actor: string;
		name: string;
		input: unknown;
		target: object;
		id: string;
		expiresAt: number;
	}): void;
	canExecute(
		name: string,
		input?: unknown,
		context?: { core: object; execute?: boolean },
	): boolean;
};

function loadCommandApprovalSource(): string {
	let dir = path.dirname(publishedToolsGuide());
	let source: string | undefined;
	for (let hop = 0; hop < 8; hop += 1) {
		const candidate = path.join(
			dir,
			"examples/agents/smart-home/src/commandApproval.ts",
		);
		if (existsSync(candidate)) {
			source = readFileSync(candidate, "utf8");
			break;
		}
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	if (!source) throw new Error("command approval canonicalizer missing");
	return ts.transpileModule(source.replace(/^export /gm, ""), {
		compilerOptions: {
			module: ts.ModuleKind.None,
			target: ts.ScriptTarget.ES2022,
		},
	}).outputText;
}

function loadAuthorityCanonical(): (name: string, input: unknown) => string {
	const compiled = loadCommandApprovalSource();
	return new Function(`${compiled}\nreturn canonicalCall;`)() as (
		name: string,
		input: unknown,
	) => string;
}

function loadAuthorityModule(): {
	canonicalCall: (name: string, input: unknown) => string;
	createCommandApprovalAuthority: (
		actor: string,
		now?: () => number,
	) => ApprovalAuthority;
} {
	const compiled = loadCommandApprovalSource();
	return new Function(
		`${compiled}\nreturn { canonicalCall, createCommandApprovalAuthority };`,
	)() as {
		canonicalCall: (name: string, input: unknown) => string;
		createCommandApprovalAuthority: (
			actor: string,
			now?: () => number,
		) => ApprovalAuthority;
	};
}

function loadGuideCanonical(): (name: string, input: unknown) => string {
	const source = readFileSync(publishedToolsGuide(), "utf8");
	const fence = [...source.matchAll(/```ts\n([\s\S]*?)```/g)].find((match) =>
		match[1]?.includes("function canonicalValue"),
	);
	const block = fence?.[1];
	if (!block) throw new Error("published canonicalizer missing");
	const start = block.indexOf("function plainSnapshotShape");
	const end = block.indexOf("const granted");
	if (start < 0 || end < start) {
		throw new Error("published canonicalizer shape changed");
	}
	const compiled = ts.transpileModule(block.slice(start, end), {
		compilerOptions: {
			module: ts.ModuleKind.None,
			target: ts.ScriptTarget.ES2022,
		},
	}).outputText;
	return new Function(`${compiled}\nreturn canonicalCall;`)() as (
		name: string,
		input: unknown,
	) => string;
}

function mutatePlant(target: { a?: number } | number[]): void {
	if (Array.isArray(target)) target[0] = 999;
	else target.a = 999;
}

function plantOf(array: boolean): HostilePlant {
	return array ? [1] : { a: 1 };
}

function mutatedOf(array: boolean): HostilePlant {
	return array ? [999] : { a: 999 };
}

function inheritedTag(array: boolean): HostileInput {
	let getReads = 0;
	const proto = array ? Array.prototype : Object.prototype;
	const previous = Object.getOwnPropertyDescriptor(proto, Symbol.toStringTag);
	const input = (array ? [1] : { a: 1 }) as { a?: number } | number[];
	Object.defineProperty(proto, Symbol.toStringTag, {
		configurable: true,
		get() {
			if (this !== input) return undefined;
			getReads += 1;
			mutatePlant(input);
			return array ? "Array" : "Object";
		},
	});
	return {
		input,
		planted: plantOf(array),
		mutated: mutatedOf(array),
		getReads: () => getReads,
		ctorReads: () => 0,
		restore() {
			if (previous) Object.defineProperty(proto, Symbol.toStringTag, previous);
			else Reflect.deleteProperty(proto, Symbol.toStringTag);
		},
	};
}

function ownTag(): HostileInput {
	let getReads = 0;
	const input: { a: number; [Symbol.toStringTag]?: unknown } = { a: 1 };
	Object.defineProperty(input, Symbol.toStringTag, {
		configurable: true,
		get() {
			getReads += 1;
			input.a = 999;
			delete input[Symbol.toStringTag];
			return "Object";
		},
	});
	return {
		input,
		planted: { a: 1 },
		mutated: { a: 999 },
		getReads: () => getReads,
		ctorReads: () => 0,
		restore() {},
	};
}

function proxyOn(
	array: boolean,
	traps: "get" | "prototype" | "every",
): HostileInput {
	let getReads = 0;
	const target = (array ? [1] : { a: 1 }) as { a?: number } | number[];
	const input = new Proxy(target, {
		get(current, key, receiver) {
			if (
				key === Symbol.toStringTag &&
				(traps === "get" || traps === "every")
			) {
				getReads += 1;
				mutatePlant(current as { a?: number } | number[]);
				return array ? "Array" : "Object";
			}
			return Reflect.get(current, key, receiver);
		},
		set(current, key, value, receiver) {
			if (traps === "every") mutatePlant(current as { a?: number } | number[]);
			return Reflect.set(current, key, value, receiver);
		},
		has(current, key) {
			if (traps === "every") mutatePlant(current as { a?: number } | number[]);
			return Reflect.has(current, key);
		},
		deleteProperty(current, key) {
			if (traps === "every") mutatePlant(current as { a?: number } | number[]);
			return Reflect.deleteProperty(current, key);
		},
		ownKeys(current) {
			return Reflect.ownKeys(current);
		},
		getOwnPropertyDescriptor(current, key) {
			return Reflect.getOwnPropertyDescriptor(current, key);
		},
		defineProperty(current, key, attributes) {
			if (traps === "every") mutatePlant(current as { a?: number } | number[]);
			return Reflect.defineProperty(current, key, attributes);
		},
		preventExtensions(current) {
			if (traps === "every") mutatePlant(current as { a?: number } | number[]);
			return Reflect.preventExtensions(current);
		},
		getPrototypeOf(current) {
			if (traps === "prototype" || traps === "every") {
				mutatePlant(current as { a?: number } | number[]);
			}
			return Reflect.getPrototypeOf(current);
		},
		setPrototypeOf(current, prototype) {
			if (traps === "every") mutatePlant(current as { a?: number } | number[]);
			return Reflect.setPrototypeOf(current, prototype);
		},
		isExtensible(current) {
			if (traps === "every") mutatePlant(current as { a?: number } | number[]);
			return Reflect.isExtensible(current);
		},
		apply() {
			return undefined;
		},
		construct() {
			return {};
		},
	});
	return {
		input,
		planted: plantOf(array),
		mutated: mutatedOf(array),
		getReads: () => getReads,
		ctorReads: () => 0,
		restore() {},
	};
}

function constructorAccessor(): HostileInput {
	let ctorReads = 0;
	const prototype = Object.create(null) as object;
	const input = Object.create(prototype) as { a: number };
	input.a = 1;
	Object.defineProperty(prototype, "constructor", {
		configurable: true,
		get() {
			ctorReads += 1;
			input.a = 999;
			function Ctor() {}
			Ctor.prototype = prototype;
			return Ctor;
		},
	});
	return {
		input,
		planted: { a: 1 },
		mutated: { a: 999 },
		getReads: () => 0,
		ctorReads: () => ctorReads,
		restore() {},
	};
}

function crossRealmConstructor(): HostileInput {
	let ctorReads = 0;
	const prototype = vm.runInNewContext("Object.create(null)") as object;
	const input = Object.create(prototype) as { a: number };
	input.a = 1;
	Object.defineProperty(prototype, "constructor", {
		configurable: true,
		get() {
			ctorReads += 1;
			input.a = 999;
			function Ctor() {}
			Ctor.prototype = prototype;
			return Ctor;
		},
	});
	return {
		input,
		planted: { a: 1 },
		mutated: { a: 999 },
		getReads: () => 0,
		ctorReads: () => ctorReads,
		restore() {},
	};
}

describe(`caller input is sealed before brand checks (seed ${PROPERTY_SEED}, runs ${PROPERTY_RUNS})`, () => {
	it("keeps the executed value equal to the own-data snapshot for every copy", async () => {
		// The same hostile object is shown to the library snapshot, the
		// application authority, and the published guide. A trap may try to
		// rewrite 1 into 999. The executed value is the sealed snapshot, or
		// the call is rejected. It is never the rewritten value.
		const authorityCanonical = loadAuthorityCanonical();
		const guideCanonical = loadGuideCanonical();
		const attack = fc.constantFrom(
			"inherited-tag" as const,
			"own-tag" as const,
			"proxy-get" as const,
			"proxy-prototype" as const,
			"proxy-traps" as const,
			"constructor-accessor" as const,
			"cross-realm-constructor" as const,
			"array-inherited-tag" as const,
			"array-proxy-get" as const,
			"array-proxy-prototype" as const,
			"array-proxy-traps" as const,
		);

		function makeHostile(
			sample:
				| "inherited-tag"
				| "own-tag"
				| "proxy-get"
				| "proxy-prototype"
				| "proxy-traps"
				| "constructor-accessor"
				| "cross-realm-constructor"
				| "array-inherited-tag"
				| "array-proxy-get"
				| "array-proxy-prototype"
				| "array-proxy-traps",
		) {
			if (sample === "inherited-tag") return inheritedTag(false);
			if (sample === "own-tag") return ownTag();
			if (sample === "proxy-get") return proxyOn(false, "get");
			if (sample === "proxy-prototype") return proxyOn(false, "prototype");
			if (sample === "proxy-traps") return proxyOn(false, "every");
			if (sample === "constructor-accessor") return constructorAccessor();
			if (sample === "cross-realm-constructor") return crossRealmConstructor();
			if (sample === "array-inherited-tag") return inheritedTag(true);
			if (sample === "array-proxy-get") return proxyOn(true, "get");
			if (sample === "array-proxy-prototype") return proxyOn(true, "prototype");
			return proxyOn(true, "every");
		}

		async function readHostile<T>(
			kind: Parameters<typeof makeHostile>[0],
			read: (host: HostileInput) => Promise<T> | T,
		): Promise<T> {
			const host = makeHostile(kind);
			try {
				const value = await read(host);
				expect(host.getReads()).toBe(0);
				expect(host.ctorReads()).toBe(0);
				return value;
			} finally {
				host.restore();
			}
		}

		await fc.assert(
			fc.asyncProperty(attack, async (kind) => {
				// A prototype trap can change the object after one read. Each
				// copy therefore sees its own input, and that read's result is
				// the own-data snapshot taken before the trap, or a rejection.
				const schema = kind.startsWith("array-")
					? {
							type: "array" as const,
							items: { type: "number" as const },
						}
					: {
							type: "object" as const,
							properties: { a: { type: "number" as const } },
						};
				const manifest = buildManifest(
					defineToolSchema({
						act: {
							description: "Payload.",
							input: schema,
							consequential: true,
						},
					}),
					() => true,
				);
				const snap = await readHostile(kind, (host) => {
					const result = snapshotPlainJson(host.input, "input", schema);
					return {
						ok: result.ok,
						value: result.ok ? result.value : undefined,
						planted: host.planted,
					};
				});
				const routed = await readHostile(kind, (host) => {
					const result = resolveCall(manifest, "act", host.input, () => true);
					return {
						ok: result.ok,
						input: result.ok ? result.value.input : undefined,
						planted: host.planted,
					};
				});
				const ran = await readHostile(kind, async (host) => {
					const runtime = createRuntime();
					const tools = igniteTools({
						core: runtime as unknown as IgniteToolsRuntime,
						schema: defineToolSchema({
							act: {
								description: "Payload.",
								input: schema,
								consequential: true,
							},
						}),
						canExecute: () => true,
					});
					const result = await tools.run({ name: "act", input: host.input });
					return {
						ok: result.ok,
						executed: runtime.calls.map((call) => call.input),
						planted: host.planted,
					};
				});
				const authorityKey = await readHostile(kind, (host) =>
					authorityCanonical("act", host.input),
				);
				const guideKey = await readHostile(kind, (host) =>
					guideCanonical("act", host.input),
				);
				const plantedKey = authorityCanonical(
					"act",
					kind.startsWith("array-") ? [1] : { a: 1 },
				);
				const mutatedKey = authorityCanonical(
					"act",
					kind.startsWith("array-") ? [999] : { a: 999 },
				);
				expect(authorityKey).toBe(guideKey);
				expect(authorityKey).not.toBe(mutatedKey);
				if (routed.ok) {
					expect(snap.ok).toBe(true);
					expect(routed.input).toEqual(routed.planted);
					expect(snap.value).toEqual(snap.planted);
					expect(ran.ok).toBe(true);
					expect(ran.executed).toEqual([ran.planted]);
					expect(authorityKey).toBe(authorityCanonical("act", routed.input));
				} else {
					expect(snap.ok).toBe(false);
					expect(ran.ok).toBe(false);
					expect(ran.executed).toEqual([]);
					expect(authorityKey).not.toBe(plantedKey);
				}
				let scalarReads = 0;
				const envelope: { value?: number } = {};
				Object.defineProperty(envelope, "value", {
					enumerable: true,
					configurable: true,
					get() {
						scalarReads += 1;
						return 999;
					},
				});
				expect(fromProviderInput(envelope, { type: "number" })).toBe(envelope);
				expect(scalarReads).toBe(0);
				return true;
			}),
			{ seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS, endOnFailure: true },
		);
	}, 60_000);
});

describe(`non-enumerable array indexes are not granted calls (seed ${PROPERTY_SEED}, runs ${PROPERTY_RUNS})`, () => {
	it("rejects a non-enumerable index in the library, the authority, and the guide", async () => {
		// An array element whose data descriptor is not enumerable is not a
		// plain-JSON snapshot. The library already rejects it. The application
		// authority and the published guide must reject that same shape, so a
		// grant of the exotic array cannot authorize the ordinary array.
		const authorityCanonical = loadAuthorityCanonical();
		const guideCanonical = loadGuideCanonical();
		const schema = {
			type: "array" as const,
			items: { type: "number" as const },
		};

		await fc.assert(
			fc.asyncProperty(
				fc.integer({ min: -30, max: 30 }),
				async (element) => {
					const exotic: number[] = [];
					Object.defineProperty(exotic, "0", {
						value: element,
						writable: true,
						configurable: true,
						enumerable: false,
					});
					const plain = [element];
					const snap = snapshotPlainJson(exotic, "input", schema);
					const authorityExotic = authorityCanonical("act", exotic);
					const guideExotic = guideCanonical("act", exotic);
					const authorityPlain = authorityCanonical("act", plain);
					const guidePlain = guideCanonical("act", plain);
					expect(snap.ok).toBe(false);
					expect(authorityExotic).toBe(guideExotic);
					expect(authorityPlain).toBe(guidePlain);
					expect(authorityExotic).not.toBe(authorityPlain);
					expect(guideExotic).not.toBe(guidePlain);
					expect(authorityExotic.includes("invalid:")).toBe(true);
					expect(guideExotic.includes("invalid:")).toBe(true);
					return true;
				},
			),
			{ seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS, endOnFailure: true },
		);
	}, 60_000);
});

describe(`unreadable tool-call fields resolve to InvalidInput (seed ${PROPERTY_SEED}, runs ${PROPERTY_RUNS})`, () => {
	it("does not reject the promise when the call input getter throws", async () => {
		// The call envelope is read before resolveCall's snapshot. A throwing
		// getter on input must become InvalidInput. The promise must resolve.
		const schema = defineToolSchema({
			act: {
				description: "Submit a payload.",
				input: { type: "number" },
				consequential: true,
			},
		});

		await fc.assert(
			fc.asyncProperty(
				fc.string({ minLength: 1, maxLength: 12 }),
				async (message) => {
					const runtime = createRuntime();
					const tools = igniteTools({
						core: runtime as unknown as IgniteToolsRuntime,
						schema,
						canExecute: () => true,
					});
					const call: NeutralToolCall = {
						name: "act",
						get input() {
							throw new Error(message);
						},
					};
					const result = await tools.run(call);
					expect(result).toEqual({
						ok: false,
						error: {
							kind: "InvalidInput",
							name: "act",
							issues: ["input: unable to read value"],
						},
					});
					expect(runtime.calls).toEqual([]);
					return true;
				},
			),
			{ seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS, endOnFailure: true },
		);
	}, 60_000);
});

describe(`a grant never authorizes a non-plain input (seed ${PROPERTY_SEED}, runs ${PROPERTY_RUNS})`, () => {
	it("rejects Date, Map, Set, and class instances in every copy", async () => {
		// A non-plain prototype is not a plain-JSON snapshot. An empty Date,
		// Map, or Set is not {}. A class instance does not share a plain
		// object's approval key. The library, the application authority, and
		// the published guide see the same input.
		const authorityCanonical = loadAuthorityCanonical();
		const guideCanonical = loadGuideCanonical();
		const schema = defineToolSchema({
			act: {
				description: "Payload.",
				input: { type: "object", properties: { a: {}, k: {} } },
				consequential: true,
			},
		});
		const kind = fc.constantFrom(
			"date" as const,
			"date-valued" as const,
			"map" as const,
			"map-entry" as const,
			"set" as const,
			"set-entry" as const,
			"class" as const,
			"class-empty" as const,
			"cross-date" as const,
			"cross-map" as const,
			"cross-set" as const,
			"cross-class" as const,
		);

		function crossRealm(source: string): unknown {
			return vm.runInNewContext(source);
		}

		await fc.assert(
			fc.asyncProperty(kind, async (sampleKind) => {
				class Box {
					a = 1;
				}
				class Empty {}
				const table = {
					date: { input: new Date(0), plain: {} },
					"date-valued": { input: new Date(1), plain: {} },
					map: { input: new Map(), plain: {} },
					"map-entry": { input: new Map([["k", 1]]), plain: {} },
					set: { input: new Set(), plain: {} },
					"set-entry": { input: new Set([1]), plain: {} },
					class: { input: new Box(), plain: { a: 1 } },
					"class-empty": { input: new Empty(), plain: {} },
					"cross-date": { input: crossRealm("new Date(1)"), plain: {} },
					"cross-map": {
						input: crossRealm("new Map([['k', 1]])"),
						plain: {},
					},
					"cross-set": { input: crossRealm("new Set([1])"), plain: {} },
					"cross-class": {
						input: crossRealm(
							"class C { constructor() { this.a = 1 } }; new C()",
						),
						plain: { a: 1 },
					},
				} as const;
				const sample = table[sampleKind];
				const snap = snapshotPlainJson(sample.input, "input", {
					type: "object",
					properties: { a: {}, k: {} },
				});
				const authorityInput = authorityCanonical("act", sample.input);
				const authorityPlain = authorityCanonical("act", sample.plain);
				const guideInput = guideCanonical("act", sample.input);
				const guidePlain = guideCanonical("act", sample.plain);
				expect(snap.ok).toBe(false);
				expect(authorityInput).toBe(guideInput);
				expect(authorityPlain).toBe(guidePlain);
				expect(authorityInput).not.toBe(authorityPlain);
				expect(guideInput).not.toBe(guidePlain);
				expect(authorityInput.includes("invalid:")).toBe(true);
				expect(guideInput.includes("invalid:")).toBe(true);

				const runtime = createRuntime();
				let allowed = false;
				const tools = igniteTools({
					core: runtime as unknown as IgniteToolsRuntime,
					schema,
					canExecute: (_name, input) => {
						allowed =
							authorityCanonical("act", input) ===
							authorityCanonical("act", sample.plain);
						return allowed;
					},
				});
				const ran = await tools.run({ name: "act", input: sample.input });
				expect(ran.ok).toBe(false);
				expect(allowed).toBe(false);
				expect(runtime.calls).toEqual([]);
				return true;
			}),
			{ seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS, endOnFailure: true },
		);
	}, 60_000);
});

function loadGuideApproval(): {
	canExecute: (
		name: string,
		input?: unknown,
		context?: { core: object; execute?: boolean },
	) => boolean;
	granted: {
		actor: string;
		id: string;
		expiresAt: number;
		target: object;
		input: unknown;
	};
	session: { actor: string };
	spent: Map<string, number>;
	component: object;
} {
	const source = readFileSync(publishedToolsGuide(), "utf8");
	const fence = [...source.matchAll(/```ts\n([\s\S]*?)```/g)].find((match) =>
		match[1]?.includes("function canExecute"),
	);
	const block = fence?.[1];
	if (!block) throw new Error("published approval predicate missing");
	const start = block.indexOf("const session");
	const end = block.indexOf("const { resolveCall, run }");
	if (start < 0 || end < start) {
		throw new Error("published approval predicate shape changed");
	}
	const compiled = ts.transpileModule(
		`const component = {};\n${block.slice(start, end)}`,
		{
			compilerOptions: {
				module: ts.ModuleKind.None,
				target: ts.ScriptTarget.ES2022,
			},
		},
	).outputText;
	return new Function(
		`${compiled}\nreturn { canExecute, granted, session, spent, component };`,
	)() as ReturnType<typeof loadGuideApproval>;
}

describe("listing checks grant liveness before advertising the command", () => {
	it("does not advertise setLimit when the grant is expired, spent, or for another actor", () => {
		// Rebinding the provider list calls canExecute(name) with no context.
		// Actor, lifetime, and the spent tombstone decide that listing. The
		// exact input is compared only when a call supplies context.
		const reason = fc.constantFrom(
			"expired" as const,
			"spent" as const,
			"previous-actor" as const,
			"too-long" as const,
		);
		fc.assert(
			fc.property(reason, (kind) => {
				const approval = loadGuideApproval();
				expect(approval.canExecute("setLimit")).toBe(true);
				if (kind === "expired") approval.granted.expiresAt = Date.now() - 1;
				if (kind === "spent") {
					approval.spent.set(approval.granted.id, Date.now() + 60_000);
				}
				if (kind === "previous-actor") approval.session.actor = "bob";
				if (kind === "too-long") {
					approval.granted.expiresAt = Date.now() + 24 * 60 * 60 * 1000 + 1;
				}
				expect(approval.canExecute("setLimit")).toBe(false);
				expect(
					approval.canExecute("setLimit", approval.granted.input, {
						core: approval.component,
					}),
				).toBe(false);
				const live = loadGuideApproval();
				expect(live.canExecute("setLimit")).toBe(true);
				expect(
					live.canExecute("setLimit", 7, { core: live.component }),
				).toBe(false);
				expect(
					live.canExecute("setLimit", live.granted.input, {
						core: live.component,
					}),
				).toBe(true);
				return true;
			}),
			{ seed: PROPERTY_SEED, numRuns: 4, endOnFailure: true },
		);
	});
});

type ShiftMode = "stable" | "keys" | "proto" | "both";

type ShiftEvent =
	| { readonly type: "ownKeys"; readonly shape: unknown }
	| { readonly type: "proto"; readonly plain: boolean };

const exoticObjectPrototype = (() => {
	class ExoticApprovalProbe {}
	return ExoticApprovalProbe.prototype;
})();

function shiftingProxy(
	left: unknown,
	right: unknown,
	mode: ShiftMode,
	array: boolean,
): { proxy: object; events: ShiftEvent[] } {
	const events: ShiftEvent[] = [];
	let ownReads = 0;
	let protoReads = 0;
	const plainProto = array ? Array.prototype : Object.prototype;
	const exoticProto = array ? Object.prototype : exoticObjectPrototype;
	const target = array ? [] : {};
	const proxy = new Proxy(target, {
		ownKeys() {
			const useLeft =
				mode === "stable" || mode === "proto" || ownReads % 2 === 0;
			const shape = useLeft ? left : right;
			ownReads += 1;
			events.push({ type: "ownKeys", shape });
			if (Array.isArray(shape)) {
				return [...shape.map((_, index) => String(index)), "length"];
			}
			return Object.keys(shape as object);
		},
		getOwnPropertyDescriptor(_current, key) {
			let latest: ShiftEvent | undefined;
			for (let index = events.length - 1; index >= 0; index -= 1) {
				const event = events[index];
				if (event?.type === "ownKeys") {
					latest = event;
					break;
				}
			}
			if (!latest || latest.type !== "ownKeys" || typeof key === "symbol") {
				return undefined;
			}
			if (Array.isArray(latest.shape)) {
				if (key === "length") {
					return {
						value: latest.shape.length,
						writable: true,
						enumerable: false,
						configurable: false,
					};
				}
				if (typeof key !== "string" || !/^(?:0|[1-9]\d*)$/.test(key)) {
					return undefined;
				}
				const index = Number(key);
				if (index >= latest.shape.length) return undefined;
				return {
					value: latest.shape[index],
					writable: true,
					enumerable: true,
					configurable: true,
				};
			}
			const record = latest.shape as Record<string, unknown>;
			if (typeof key !== "string" || !Object.keys(record).includes(key)) {
				return undefined;
			}
			return {
				value: record[key],
				writable: true,
				enumerable: true,
				configurable: true,
			};
		},
		getPrototypeOf() {
			const plain =
				mode === "stable" || mode === "keys" || protoReads % 2 === 0;
			protoReads += 1;
			events.push({ type: "proto", plain });
			return plain ? plainProto : exoticProto;
		},
	});
	return { proxy, events };
}

function readSince(
	events: readonly ShiftEvent[],
	start: number,
): { shape: unknown; plain: boolean } {
	const slice = events.slice(start);
	const own = slice.filter((event) => event.type === "ownKeys");
	const proto = slice.filter((event) => event.type === "proto");
	expect(own).toHaveLength(1);
	expect(proto).toHaveLength(1);
	const ownEvent = own[0];
	const protoEvent = proto[0];
	if (
		!ownEvent ||
		ownEvent.type !== "ownKeys" ||
		!protoEvent ||
		protoEvent.type !== "proto"
	) {
		throw new Error("missing trap read");
	}
	return { shape: ownEvent.shape, plain: protoEvent.plain };
}

describe(`approval key stays on the snapshot that executes (seed ${PROPERTY_SEED}, runs ${PROPERTY_RUNS})`, () => {
	it("does not let one proxy read authorize a different read", async () => {
		// getPrototypeOf and ownKeys may change on every read. The key that
		// authorizes a call is the canonical key of the snapshot run passes
		// to canExecute and execute. A key from any other read does not
		// authorize that snapshot. The library, the application authority,
		// and the published guide each bind the key to the read they just took.
		const authorityCanonical = loadAuthorityCanonical();
		const { createCommandApprovalAuthority } = loadAuthorityModule();
		const guideCanonical = loadGuideCanonical();
		const clock = 1_700_000_000_000;
		const modeArb = fc.constantFrom(
			"stable" as const,
			"keys" as const,
			"proto" as const,
			"both" as const,
		);
		const kindArb = fc.constantFrom("object" as const, "array" as const);
		const objectShape = fc.dictionary(jsonKey, plainJson(1), {
			maxKeys: 3,
			noNullPrototype: true,
		});
		const arrayShape = fc.array(plainJson(1), { maxLength: 3 });

		await fc.assert(
			fc.asyncProperty(
				modeArb,
				kindArb,
				objectShape,
				objectShape,
				arrayShape,
				arrayShape,
				async (mode, kind, objectLeft, objectRight, arrayLeft, arrayRight) => {
					const array = kind === "array";
					const left = cloneJson(array ? arrayLeft : objectLeft);
					let right = cloneJson(array ? arrayRight : objectRight);
					if (mode === "stable") right = cloneJson(left);
					if ((mode === "keys" || mode === "both") && sameJson(left, right)) {
						right = array ? [left, "shift"] : { ...left, zz: "shift" };
					}
					const schema = array
						? { type: "array" as const }
						: { type: "object" as const, properties: { v: {} } };

					const grantedProbe = shiftingProxy(left, right, mode, array);
					const grantedStart = grantedProbe.events.length;
					const grantedSnap = snapshotPlainJson(
						grantedProbe.proxy,
						"input",
						schema,
					);
					const grantedRead = readSince(grantedProbe.events, grantedStart);
					expect(grantedRead.plain).toBe(true);
					expect(grantedSnap.ok).toBe(true);
					if (!grantedSnap.ok) return true;
					expect(sameJson(grantedSnap.value, grantedRead.shape)).toBe(true);
					const grantKey = authorityCanonical("act", grantedSnap.value);
					expect(grantKey).toBe(guideCanonical("act", grantedSnap.value));
					expect(grantKey).toBe(authorityCanonical("act", grantedRead.shape));
					expect(grantKey).toBe(guideCanonical("act", grantedRead.shape));

					const authorityProbe = shiftingProxy(left, right, mode, array);
					const authorityStart = authorityProbe.events.length;
					const authorityKey = authorityCanonical("act", authorityProbe.proxy);
					const authorityRead = readSince(
						authorityProbe.events,
						authorityStart,
					);
					const authorityNext = authorityProbe.events.length;
					const authorityKeyNext = authorityCanonical(
						"act",
						authorityProbe.proxy,
					);
					const authorityReadNext = readSince(
						authorityProbe.events,
						authorityNext,
					);
					if (authorityRead.plain) {
						expect(authorityKey).toBe(
							authorityCanonical("act", authorityRead.shape),
						);
					} else {
						expect(authorityKey.includes("invalid:")).toBe(true);
						expect(authorityKey).not.toBe(
							authorityCanonical("act", authorityRead.shape),
						);
					}
					if (authorityReadNext.plain) {
						expect(authorityKeyNext).toBe(
							guideCanonical("act", authorityReadNext.shape),
						);
					} else {
						expect(authorityKeyNext.includes("invalid:")).toBe(true);
						expect(authorityKeyNext).not.toBe(
							guideCanonical("act", authorityReadNext.shape),
						);
					}
					if (
						!authorityReadNext.plain ||
						!sameJson(authorityRead.shape, authorityReadNext.shape)
					) {
						expect(authorityKeyNext).not.toBe(authorityKey);
					} else {
						expect(authorityKeyNext).toBe(authorityKey);
					}

					const guideProbe = shiftingProxy(left, right, mode, array);
					const guideStart = guideProbe.events.length;
					const guideKey = guideCanonical("act", guideProbe.proxy);
					const guideRead = readSince(guideProbe.events, guideStart);
					const guideNext = guideProbe.events.length;
					const guideKeyNext = guideCanonical("act", guideProbe.proxy);
					const guideReadNext = readSince(guideProbe.events, guideNext);
					expect(guideKey).toBe(authorityKey);
					expect(sameJson(guideRead.shape, authorityRead.shape)).toBe(true);
					if (guideReadNext.plain) {
						expect(guideKeyNext).toBe(
							authorityCanonical("act", guideReadNext.shape),
						);
					} else {
						expect(guideKeyNext.includes("invalid:")).toBe(true);
						expect(guideKeyNext).not.toBe(
							authorityCanonical("act", guideReadNext.shape),
						);
					}
					if (
						!guideReadNext.plain ||
						!sameJson(guideRead.shape, guideReadNext.shape)
					) {
						expect(guideKeyNext).not.toBe(guideKey);
					}

					const runtime = createRuntime();
					const gate = createCommandApprovalAuthority("ada", () => clock);
					gate.grant({
						actor: "ada",
						name: "act",
						input: grantedSnap.value,
						target: runtime,
						id: "shift",
						expiresAt: clock + 60_000,
					});
					let approvedInput: unknown;
					const tools = igniteTools({
						core: runtime as unknown as IgniteToolsRuntime,
						schema: defineToolSchema({
							act: {
								description: "Payload.",
								input: schema,
								consequential: true,
							},
						}),
						canExecute: (name, input, context) => {
							if (context?.execute === true) approvedInput = input;
							return gate.canExecute(name, input, context);
						},
					});
					const runStart = grantedProbe.events.length;
					const ran = await tools.run({
						name: "act",
						input: grantedProbe.proxy,
					});
					const runRead = readSince(grantedProbe.events, runStart);
					const sameAsGrant =
						runRead.plain && sameJson(runRead.shape, grantedSnap.value);
					if (!sameAsGrant) {
						expect(ran.ok).toBe(false);
						expect(runtime.calls).toEqual([]);
						if (approvedInput !== undefined) {
							expect(approvedInput).not.toBe(grantedProbe.proxy);
							expect(isDeepFrozenPlainJson(approvedInput)).toBe(true);
							expect(sameJson(approvedInput, runRead.shape)).toBe(true);
							expect(authorityCanonical("act", approvedInput)).not.toBe(
								grantKey,
							);
							expect(guideCanonical("act", approvedInput)).not.toBe(grantKey);
						}
						return true;
					}
					expect(ran.ok).toBe(true);
					expect(runtime.calls).toHaveLength(1);
					const executed = runtime.calls[0]?.input;
					expect(approvedInput).toBe(executed);
					expect(approvedInput).not.toBe(grantedProbe.proxy);
					expect(isDeepFrozenPlainJson(executed)).toBe(true);
					expect(sameJson(executed, runRead.shape)).toBe(true);
					expect(sameJson(executed, grantedSnap.value)).toBe(true);
					expect(authorityCanonical("act", executed)).toBe(grantKey);
					expect(guideCanonical("act", executed)).toBe(grantKey);
					expect(gate.canExecute("act", executed, { core: runtime })).toBe(
						false,
					);
					return true;
				},
			),
			{ seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS, endOnFailure: true },
		);
	}, 60_000);
});

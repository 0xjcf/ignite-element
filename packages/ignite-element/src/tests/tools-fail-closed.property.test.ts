/**
 * Fail-closed properties for igniteTools.
 * The CI seed and run count are fixed so a failure replays the same sequence.
 * Seed: 20261011. Runs: 100 per case.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { IgniteToolsRuntime, ToolInputSchema } from "../tools";
import {
	buildManifest,
	defineToolSchema,
	igniteTools,
	resolveCall,
} from "../tools";

const PROPERTY_SEED = 20261011;
const PROPERTY_RUNS = 100;

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

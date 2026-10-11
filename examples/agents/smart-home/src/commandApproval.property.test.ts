/**
 * Single-use approval properties for the application gate in front of igniteTools.
 * The CI seed and run count are fixed so a failure replays the same sequence.
 * Seed: 20261011. Runs: 100 per property.
 */
import fc from "fast-check";
import {
	defineToolSchema,
	type IgniteToolsRuntime,
	igniteTools,
} from "ignite-element/tools";
import { describe, expect, it } from "vitest";
import {
	canonicalCall,
	createCommandApprovalAuthority,
} from "./commandApproval";

const PROPERTY_SEED = 20261011;
const PROPERTY_RUNS = 100;
const CLOCK = 1_700_000_000_000;

const schema = defineToolSchema({
	act: {
		description: "Act on a payload.",
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

function cloneJson<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function mutateJson(value: unknown): unknown {
	if (typeof value === "number") return value + 1;
	if (typeof value === "string") return `${value}!`;
	if (typeof value === "boolean") return !value;
	if (value === null) return 0;
	if (Array.isArray(value)) {
		if (value.length === 0) return [0];
		return value.map((item, index) =>
			index === value.length - 1 ? mutateJson(item) : cloneJson(item),
		);
	}
	if (value && typeof value === "object") {
		const record = value as Record<string, unknown>;
		const keys = Object.keys(record);
		if (keys.length === 0) return { k: 1 };
		const key = keys[keys.length - 1] ?? "k";
		const next: Record<string, unknown> = {};
		for (const current of keys) {
			next[current] =
				current === key
					? mutateJson(record[current])
					: cloneJson(record[current]);
		}
		return next;
	}
	return { mutated: true };
}

function reorderKeys(value: unknown): unknown {
	if (Array.isArray(value)) return value.map((item) => reorderKeys(item));
	if (!value || typeof value !== "object") return value;
	const record = value as Record<string, unknown>;
	const keys = Object.keys(record);
	const ordered = keys.length > 1 ? [...keys].reverse() : keys;
	const next: Record<string, unknown> = {};
	for (const key of ordered) next[key] = reorderKeys(record[key]);
	return next;
}

function createRuntime() {
	const calls: Array<{ command: string; input?: unknown }> = [];
	return {
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
		async execute(call: { command: string; input?: unknown }) {
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
}

describe(`command approval properties (seed ${PROPERTY_SEED}, runs ${PROPERTY_RUNS})`, () => {
	it("spends an approval once, and only for the exact args", async () => {
		await fc.assert(
			fc.asyncProperty(jsonValue, async (original) => {
				const pristine = cloneJson(original);
				const mutated = mutateJson(pristine);
				expect(canonicalCall("act", { v: mutated })).not.toBe(
					canonicalCall("act", { v: pristine }),
				);
				expect(canonicalCall("act", { v: reorderKeys(pristine) })).toBe(
					canonicalCall("act", { v: pristine }),
				);

				const runtime = createRuntime();
				const authority = createCommandApprovalAuthority("ada", () => CLOCK);
				const granted = { v: cloneJson(pristine) };
				authority.grant({
					actor: "ada",
					name: "act",
					input: granted,
					target: runtime,
					id: "once",
					expiresAt: CLOCK + 60_000,
				});
				granted.v = mutated;

				let preflight: unknown;
				const { run } = igniteTools({
					core: runtime as unknown as IgniteToolsRuntime,
					schema,
					canExecute: (name, input, context) => {
						if (context?.execute === true) preflight = input;
						return authority.canExecute(name, input, context);
					},
				});

				const denied = await run({ name: "act", input: granted });
				expect(denied).toMatchObject({
					ok: false,
					error: { kind: "Unavailable", name: "act" },
				});
				expect(runtime.calls).toEqual([]);

				const allowed = await run({
					name: "act",
					input: { v: reorderKeys(pristine) },
				});
				expect(allowed.ok).toBe(true);
				expect(runtime.calls).toHaveLength(1);
				expect(preflight).toBe(runtime.calls[0]?.input);
				expect(Object.isFrozen(preflight)).toBe(true);
				expect(runtime.calls[0]?.input).toEqual({ v: pristine });

				const replay = await run({
					name: "act",
					input: { v: cloneJson(pristine) },
				});
				expect(replay).toMatchObject({
					ok: false,
					error: { kind: "Unavailable", name: "act" },
				});
				expect(runtime.calls).toHaveLength(1);
				return true;
			}),
			{ seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS, endOnFailure: true },
		);
	}, 60_000);

	it("treats signed zero as the same args and still spends the approval once", async () => {
		await fc.assert(
			fc.asyncProperty(jsonValue, async (extra) => {
				const approved = { v: 0, extra: cloneJson(extra) };
				const signed = { v: -0, extra: cloneJson(extra) };
				expect(canonicalCall("act", approved)).toBe(
					canonicalCall("act", signed),
				);

				const runtime = createRuntime();
				const authority = createCommandApprovalAuthority("ada", () => CLOCK);
				authority.grant({
					actor: "ada",
					name: "act",
					input: approved,
					target: runtime,
					id: "zero",
					expiresAt: CLOCK + 60_000,
				});
				const { run } = igniteTools({
					core: runtime as unknown as IgniteToolsRuntime,
					schema,
					canExecute: authority.canExecute,
				});

				const allowed = await run({ name: "act", input: signed });
				expect(allowed.ok).toBe(true);
				const executed = runtime.calls[0]?.input as { v: number };
				expect(Object.is(executed.v, 0)).toBe(true);
				expect(Object.is(executed.v, -0)).toBe(false);

				const replay = await run({ name: "act", input: approved });
				expect(replay).toMatchObject({
					ok: false,
					error: { kind: "Unavailable", name: "act" },
				});
				expect(runtime.calls).toHaveLength(1);
				return true;
			}),
			{ seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS, endOnFailure: true },
		);
	}, 60_000);
});

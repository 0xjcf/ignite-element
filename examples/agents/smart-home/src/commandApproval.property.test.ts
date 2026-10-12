/**
 * Single-use approval properties for the application gate in front of igniteTools.
 * The CI seed and run count are fixed so a failure replays the same sequence.
 * Seed: 20261011. Runs: 200 per property.
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
const PROPERTY_RUNS = 200;
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

	it("keeps a single-use approval exact under shuffled grants, uses, and mutations", async () => {
		// An approval is single-use and bound to the exact args. Grants, uses,
		// and mutations are generated and shuffled. A hostile use does not spend.
		const approvalId = fc.stringMatching(/^[a-z]{1,3}$/);
		const hostile = fc.constantFrom(
			"date" as const,
			"cycle" as const,
			"nan" as const,
			"proxy" as const,
		);
		const program = fc
			.uniqueArray(approvalId, { minLength: 1, maxLength: 3 })
			.chain((ids) => {
				const ops = [
					...ids.map((id) => ({ kind: "grant" as const, id })),
					...ids.map((id) => ({ kind: "mutate" as const, id })),
					...ids.flatMap((id) =>
						(["exact", "reorder", "mutated", "hostile"] as const).map(
							(use) => ({ kind: "use" as const, id, use }),
						),
					),
				];
				return fc.record({
					ids: fc.constant(ids),
					ops: fc.shuffledSubarray(ops, {
						minLength: ops.length,
						maxLength: ops.length,
					}),
					values: fc.array(plainJson(1), {
						minLength: ids.length,
						maxLength: ids.length,
					}),
					hostile,
				});
			});

		function hostileInput(kind: "date" | "cycle" | "nan" | "proxy"): unknown {
			if (kind === "date") return new Date(0);
			if (kind === "nan") return Number.NaN;
			if (kind === "cycle") {
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

		await fc.assert(
			fc.asyncProperty(program, async (sample) => {
				const boxes = new Map<
					string,
					{ current: unknown; granted: unknown | undefined }
				>();
				sample.ids.forEach((id, index) => {
					boxes.set(id, {
						current: cloneJson(sample.values[index]),
						granted: undefined,
					});
				});
				const spent = new Set<string>();
				const pending: Array<{ id: string; canonical: string }> = [];
				const runtime = createRuntime();
				const authority = createCommandApprovalAuthority("ada", () => CLOCK);
				let tools: ReturnType<typeof igniteTools> | undefined;
				let manifestHasAct: boolean | undefined;

				function bind() {
					if (!tools) {
						manifestHasAct = authority.canExecute("act");
						tools = igniteTools({
							core: runtime as unknown as IgniteToolsRuntime,
							schema,
							canExecute: (name, input, context) =>
								authority.canExecute(name, input, context),
						});
						expect(tools.manifest.some((tool) => tool.name === "act")).toBe(
							manifestHasAct,
						);
					}
					return tools;
				}

				function inputFor(
					op: { id: string; use: "exact" | "reorder" | "mutated" | "hostile" },
					box: { current: unknown; granted: unknown | undefined },
				): unknown {
					if (op.use === "hostile") return hostileInput(sample.hostile);
					if (box.granted === undefined) return { v: { missingGrant: true } };
					if (op.use === "exact") return { v: cloneJson(box.granted) };
					if (op.use === "reorder") {
						return { v: reorderKeys(cloneJson(box.granted)) };
					}
					return { v: cloneJson(box.current) };
				}

				for (const op of sample.ops) {
					const box = boxes.get(op.id);
					if (!box) throw new Error(`missing ${op.id}`);
					if (op.kind === "grant") {
						const input = { v: cloneJson(box.current) };
						authority.grant({
							actor: "ada",
							name: "act",
							input,
							target: runtime,
							id: op.id,
							expiresAt: CLOCK + 60_000,
						});
						if (!spent.has(op.id)) {
							const canonical = canonicalCall("act", input);
							const existing = pending.findIndex((item) => item.id === op.id);
							if (existing >= 0) pending.splice(existing, 1);
							pending.push({ id: op.id, canonical });
							box.granted = cloneJson(box.current);
						}
						continue;
					}
					if (op.kind === "mutate") {
						box.current = mutateJson(box.current);
						continue;
					}
					const input = inputFor(op, box);
					const listed = manifestHasAct ?? authority.canExecute("act");
					const before = authority.ledger();
					const callsBefore = runtime.calls.length;
					let ran: Awaited<ReturnType<ReturnType<typeof bind>["run"]>>;
					let runThrew = false;
					try {
						ran = await bind().run({ name: "act", input });
					} catch {
						runThrew = true;
						ran = {
							ok: false,
							error: {
								kind: "ExecuteFailed",
								name: "act",
								message: "unreachable",
							},
						};
					}
					expect(runThrew).toBe(false);
					const after = authority.ledger();
					const canonical = canonicalCall("act", input);
					const match = pending.findIndex(
						(item) => item.canonical === canonical,
					);
					const shouldRun = listed && op.use !== "hostile" && match >= 0;
					if (shouldRun) {
						expect(ran.ok).toBe(true);
						expect(runtime.calls).toHaveLength(callsBefore + 1);
						expect(after.spent).toBe(before.spent + 1);
						expect(after.pending).toBe(before.pending - 1);
						const matched = pending[match];
						if (!matched) throw new Error("missing match");
						pending.splice(match, 1);
						spent.add(matched.id);
						expect(Object.isFrozen(runtime.calls[callsBefore]?.input)).toBe(
							true,
						);
					} else {
						expect(ran.ok).toBe(false);
						expect(runtime.calls).toHaveLength(callsBefore);
						expect(after).toEqual(before);
					}
				}
				return true;
			}),
			{ seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS, endOnFailure: true },
		);
	}, 60_000);
});

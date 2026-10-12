import { describe, expect, it, vi } from "vitest";
import { assign, emit, setup } from "xstate";
import type { EventDescriptor, EventMember } from "../RenderArgs";
import type { IgniteToolsRuntime } from "../tools";
import { defineToolSchema, igniteTools } from "../tools";
import { anthropic } from "../tools/anthropic";
import { openai } from "../tools/openai";
import type { IgniteAgentSchema } from "../types/schema";
import { igniteCore } from "../xstate";

const options = {
	schema: defineToolSchema({
		run: { input: { type: "object", properties: {} } },
	}),
};
const call = { name: "run", input: {} };
type ObservationRuntime = IgniteToolsRuntime<
	unknown,
	Record<string, () => unknown>,
	Record<string, EventDescriptor<void>>,
	unknown,
	{ count: number }
>;

function fixture(fail?: "setup" | "command" | "read", cleanupFails = false) {
	const failure = { primary: fail };
	const cleanups: string[] = [];
	const handlers = new Map<string, Set<(event: { type: string }) => void>>();
	let catalogue: IgniteAgentSchema = {
		schemaVersion: 1,
		states: { schema: null },
		commands: { run: { input: null } },
		events: [
			{ type: "first", payload: null },
			{ type: "second", payload: null },
		],
	};
	function get(key: "states"): { count: number };
	function get(key: "schema"): IgniteAgentSchema;
	function get(key: "commands"): IgniteAgentSchema["commands"];
	function get(key: "events"): IgniteAgentSchema["events"];
	function get(
		this: typeof runtime,
		key: "states" | "schema" | "commands" | "events",
	) {
		expect(this).toBe(runtime);
		if (key === "states") {
			if (fail === "read") throw failure;
			return { count: 1 };
		}
		return key === "schema" ? catalogue : catalogue[key];
	}
	const runtime = {
		get,
		async execute() {
			expect(this).toBe(runtime);
			if (fail === "command") throw failure;
			for (const h of handlers.get("first") ?? []) h({ type: "first" });
			return { id: "created" };
		},
		on<Name extends string>(
			name: Name,
			handler: (
				event: EventMember<Record<string, EventDescriptor<void>>, Name>,
			) => void,
		) {
			expect(this).toBe(runtime);
			if (fail === "setup" && name === "second") throw failure;
			const bucket = handlers.get(name) ?? new Set();
			handlers.set(name, bucket);
			const deliver = () =>
				handler({ type: name } as EventMember<
					Record<string, EventDescriptor<void>>,
					Name
				>);
			bucket.add(deliver);
			return {
				unsubscribe() {
					cleanups.push(name);
					bucket.delete(deliver);
					if (cleanupFails) throw Error("cleanup");
				},
			};
		},
		watch() {
			return { unsubscribe() {} };
		},
	};
	return {
		runtime,
		failure,
		cleanups,
		handlers,
		setEvents(events: IgniteAgentSchema["events"]) {
			catalogue = { ...catalogue, events };
		},
	};
}

describe("tools public observation window", () => {
	it.each(["setup", "command", "read"] as const)(
		"drains all acquired handles after %s failure and preserves its identity",
		async (phase) => {
			const f = fixture(phase, true);
			const report = vi.spyOn(console, "error").mockImplementation(() => {});
			try {
				const tools = igniteTools({
					core: f.runtime as ObservationRuntime,
					schema: options.schema,
					canExecute: () => true,
				});
				const outcome = await tools.run(call);
				expect(outcome).toMatchObject({
					ok: false,
					error: { kind: "ExecuteFailed", cause: f.failure },
				});
				if (!outcome.ok)
					expect(
						outcome.error.kind === "ExecuteFailed" && outcome.error.cause,
					).toBe(f.failure);
				expect(f.cleanups).toEqual(
					phase === "setup" ? ["first"] : ["first", "second"],
				);
				expect([...f.handlers.values()].every((h) => h.size === 0)).toBe(true);
			} finally {
				report.mockRestore();
			}
		},
	);
	it("validates before subscribing and reads the current catalogue on each run", async () => {
		const f = fixture();
		const tools = igniteTools({
			core: f.runtime as ObservationRuntime,
			schema: options.schema,
			canExecute: () => true,
		});
		expect((await tools.run({ name: "missing", input: {} })).ok).toBe(false);
		expect(f.handlers.size).toBe(0);
		f.setEvents([{ type: "first", payload: null }]);
		expect(await tools.run(call)).toEqual({
			ok: true,
			value: {
				result: { id: "created" },
				states: { count: 1 },
				events: [{ type: "first" }],
			},
		});
		expect(f.cleanups).toEqual(["first"]);
	});
	it("captures declared native events only and serializes void without a native snapshot", async () => {
		const machine = setup({
			types: {
				context: {} as { count: number },
				events: {} as { type: "RUN" },
				emitted: {} as { type: "public" } | { type: "private" },
			},
		}).createMachine({
			context: { count: 0 },
			on: {
				RUN: {
					actions: [
						assign({ count: ({ context }) => context.count + 1 }),
						emit({ type: "public" }),
						emit({ type: "private" }),
					],
				},
			},
		});
		const core = igniteCore({
			source: machine,
			states: (s) => ({ count: s.context.count }),
			events: (e) => ({ public: e() }),
			commands: ({ source }) => ({
				run() {
					source.send({ type: "RUN" });
				},
			}),
		});
		const native: unknown[] = [];
		const handle = core.on("private", (event) => native.push(event));
		try {
			const tools = igniteTools({
				core,
				schema: options.schema,
				canExecute: () => true,
			});
			const outcome = await tools.run(call);
			expect(outcome).toEqual({
				ok: true,
				value: {
					result: undefined,
					states: { count: 1 },
					events: [{ type: "public" }],
				},
			});
			expect(native).toEqual([{ type: "private" }]);
			for (const dialect of [openai, anthropic]) {
				const wire = dialect.toolResult({
					id: "one",
					name: "run",
					result: outcome,
				});
				expect(JSON.stringify(wire)).not.toContain("snapshot");
				expect(JSON.stringify(wire)).toContain("count");
			}
		} finally {
			handle.unsubscribe();
			core.dispose();
		}
	});
	it("allows overlapping windows to observe the same public event", async () => {
		const f = fixture();
		const release: Array<() => void> = [];
		f.runtime.execute = async () => {
			await new Promise<void>((resolve) => release.push(resolve));
			for (const h of f.handlers.get("first") ?? []) h({ type: "first" });
			return { id: "created" };
		};
		const tools = igniteTools({
			core: f.runtime as ObservationRuntime,
			schema: options.schema,
			canExecute: () => true,
		});
		const first = tools.run(call),
			second = tools.run(call);
		release[0]();
		release[1]();
		const results = await Promise.all([first, second]);
		for (const r of results) {
			expect(r.ok).toBe(true);
			if (r.ok)
				expect(r.value.events).toEqual([{ type: "first" }, { type: "first" }]);
		}
		expect([...f.handlers.values()].every((h) => h.size === 0)).toBe(true);
	});
});

it("releases temporary handles when a pending core is disposed", async () => {
	let finish: () => void = () => {
		throw Error("command not entered");
	};
	const pending = new Promise<void>((resolve) => {
		finish = resolve;
	});
	const core = igniteCore({
		source: setup({}).createMachine({}),
		events: (e) => ({ done: e() }),
		commands: () => ({ run: () => pending }),
	});
	const subscribe = vi.spyOn(core, "on");
	const tools = igniteTools({
		core,
		schema: options.schema,
		canExecute: () => true,
	});
	const outcome = tools.run(call);
	const releases = subscribe.mock.results.map((entry) =>
		vi.spyOn(entry.value, "unsubscribe"),
	);
	expect(releases).toHaveLength(1);
	core.dispose();
	finish();
	expect(await outcome).toMatchObject({
		ok: false,
		error: {
			kind: "ExecuteFailed",
			message: expect.stringMatching(/disposed/i),
		},
	});
	for (const release of releases) expect(release).toHaveBeenCalledOnce();
	core.dispose();
});

it("until resolves from current states after run without a later transition", async () => {
	const machine = setup({
		types: {
			context: {} as { count: number },
			events: {} as { type: "SET"; count: number },
		},
	}).createMachine({
		context: { count: 0 },
		on: {
			SET: {
				actions: assign({ count: ({ event }) => event.count }),
			},
		},
	});
	const core = igniteCore({
		source: machine,
		states: (snapshot) => ({ count: snapshot.context.count }),
		commands: ({ source }) => ({
			setCount(count: number) {
				source.send({ type: "SET", count });
			},
		}),
	});
	try {
		const { run, until } = igniteTools({
			core,
			schema: defineToolSchema({
				setCount: { input: { type: "number" } },
			}),
			canExecute: () => true,
		});
		const result = await run({ name: "setCount", input: 2 });
		expect(result.ok).toBe(true);
		const states = await until((observation) =>
			observation.type === "states" && observation.states.count === 2
				? observation.states
				: undefined,
		);
		expect(states).toEqual({ count: 2 });
	} finally {
		core.dispose();
	}
});

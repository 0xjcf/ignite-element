import { describe, expect, it } from "vitest";
import { createMachine } from "xstate";
import { igniteTools } from "../tools";
import { igniteCore } from "../xstate";

describe("command-defined execution results", () => {
	const makeCore = () =>
		igniteCore({
			source: createMachine({}),
			states: () => ({ ready: true }),
			commands: () => ({
				noop() {},
				async create(input: { id: string }) {
					return { id: input.id };
				},
			}),
		});
	it("resolves void without an implicit receipt", async () => {
		const core = makeCore();
		try {
			expect(await core.execute({ command: "noop" })).toBeUndefined();
			expect(core.get("states")).toEqual({ ready: true });
		} finally {
			core.dispose();
		}
	});
	it("returns only the awaited authored DTO", async () => {
		const core = makeCore();
		try {
			expect(
				await core.execute({ command: "create", input: { id: "todo-1" } }),
			).toEqual({ id: "todo-1" });
		} finally {
			core.dispose();
		}
	});
	it("tools explicitly observes states alongside the authored result", async () => {
		const core = makeCore();
		const tools = igniteTools({
			core,
			schema: {
				noop: { input: { type: "object", properties: {} } },
			},
		});
		try {
			expect(await tools.run({ name: "noop", input: {} })).toEqual({
				ok: true,
				value: { result: undefined, states: { ready: true }, events: [] },
			});
		} finally {
			core.dispose();
		}
	});
});

function deferred<T>() {
	let resolve: (value: T | PromiseLike<T>) => void = () => {
		throw Error("uninitialized deferred");
	};
	let reject: (reason: unknown) => void = () => {
		throw Error("uninitialized deferred");
	};
	const promise = new Promise<T>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
}

it("gates on returned work, preserves rejection identity, and rejects late fulfillment after disposal", async () => {
	const work = deferred<{ id: string }>();
	const failure = { code: "application" };
	const core = igniteCore({
		source: createMachine({}),
		commands: () => ({
			run: () => work.promise,
			fail: () => Promise.reject(failure),
		}),
	});
	await expect(core.execute({ command: "fail" })).rejects.toBe(failure);
	let settled = false;
	const pending = core.execute({ command: "run" });
	void pending.then(
		() => {
			settled = true;
		},
		() => {},
	);
	await Promise.resolve();
	expect(settled).toBe(false);
	core.dispose();
	work.resolve({ id: "finished-business-work" });
	await expect(pending).rejects.toThrow(/disposed/i);
	expect(await work.promise).toEqual({ id: "finished-business-work" });
});

it("returns an authored thenable value after its mutation is published", async () => {
	const { configureStore, createSlice } = await import("@reduxjs/toolkit");
	const { igniteCore: reduxCore } = await import("../redux");
	const slice = createSlice({
		name: "count",
		initialState: { count: 0 },
		reducers: {
			add(s) {
				s.count++;
			},
		},
	});
	const store = configureStore({ reducer: slice.reducer });
	const work = deferred<void>();
	const core = reduxCore({
		source: store,
		states: (s) => ({ count: s.count }),
		commands: ({ source }) => ({
			async add() {
				await work.promise;
				source.dispatch(slice.actions.add());
				return { id: "one" };
			},
			noop() {},
		}),
	});
	try {
		const pending = core.execute({ command: "add" });
		expect(core.get("states").count).toBe(0);
		work.resolve();
		expect(await pending).toEqual({ id: "one" });
		expect(core.get("states").count).toBe(1);
		expect(await core.execute({ command: "noop" })).toBeUndefined();
	} finally {
		core.dispose();
	}
});

it("preserves MobX DTO/void values and leaves application reactions alive", async () => {
	const { makeAutoObservable, autorun } = await import("mobx");
	const { igniteCore: mobxCore } = await import("../mobx");
	const source = makeAutoObservable({
		count: 0,
		add() {
			this.count++;
		},
	});
	const counts: number[] = [];
	const release = autorun(() => counts.push(source.count));
	const core = mobxCore({
		source,
		states: (s) => ({ count: s.count }),
		commands: ({ source }) => ({
			add() {
				source.add();
				return { id: source.count };
			},
			noop() {},
		}),
	});
	try {
		expect(await core.execute({ command: "add" })).toEqual({ id: 1 });
		expect(core.get("states")).toEqual({ count: 1 });
		expect(await core.execute({ command: "noop" })).toBeUndefined();
		core.dispose();
		source.add();
		expect(counts).toEqual([0, 1, 2]);
	} finally {
		core.dispose();
		release();
	}
});

it("does not await detached work or an Actor-Web acknowledgement's later publication", async () => {
	const { igniteCore: actorCore } = await import("../actor-web");
	let count = 0;
	const listeners = new Set<(value: ReturnType<typeof snapshot>) => void>();
	const snapshot = () => ({
		address: "counter",
		context: { count },
		phase: "active",
		toJSON: () => ({ count }),
	});
	const publication = deferred<void>();
	const source = {
		address: "counter",
		snapshot,
		subscribe(listener: (value: ReturnType<typeof snapshot>) => void) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		async send(_event: { type: "ADD" }) {
			return { accepted: true };
		},
	};
	const core = actorCore({
		source,
		states: (s) => ({ count: s.context.count }),
		commands: ({ source }) => ({
			async add() {
				await source.send({ type: "ADD" });
				return { accepted: true };
			},
			detached() {
				void publication.promise.then(() => {
					count++;
					for (const listener of listeners) listener(snapshot());
				});
			},
		}),
	});
	try {
		expect(await core.execute({ command: "add" })).toEqual({ accepted: true });
		expect(core.get("states").count).toBe(0);
		expect(await core.execute({ command: "detached" })).toBeUndefined();
		expect(core.get("states").count).toBe(0);
		publication.resolve();
		await publication.promise;
		expect(core.get("states").count).toBe(1);
	} finally {
		core.dispose();
	}
	expect(listeners.size).toBe(0);
});

it("retains projected completed results until explicit owner disposal", async () => {
	const core = igniteCore({
		source: createMachine({
			initial: "working",
			states: { working: { on: { FINISH: "done" } }, done: { type: "final" } },
		}),
		states: (s) => ({ complete: s.status === "done" }),
		commands: ({ source }) => ({
			finish() {
				source.send({ type: "FINISH" });
				return { id: "completed" };
			},
		}),
	});
	expect(await core.execute({ command: "finish" })).toEqual({
		id: "completed",
	});
	expect(core.get("states")).toEqual({ complete: true });
	core.dispose();
	expect(() => core.get("states")).toThrow(/disposed/i);
});

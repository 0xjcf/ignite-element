import type { IgniteAdapter } from "@ignite-element/core";
import { configureStore, createSlice } from "@reduxjs/toolkit";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMachine, fromCallback } from "xstate";
import { igniteCore as reduxCore } from "../redux";
import { createAgentRuntime } from "../runtime/agent";
import { createLifetime } from "../runtime/lifetime";
import { igniteCore } from "../xstate";

const slice = createSlice({
	name: "counter",
	initialState: { count: 0 },
	reducers: {},
});

function invokingMachine() {
	const invoked = vi.fn();
	const released = vi.fn();
	const machine = createMachine({
		context: { count: 0 },
		invoke: {
			src: fromCallback(() => {
				invoked();
				return () => released();
			}),
		},
	});
	return { machine, invoked, released };
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("independent core first-use failures", () => {
	it("stops the first actor when first-execute preparation fails", async () => {
		const { machine, invoked, released } = invokingMachine();
		const core = igniteCore({
			source: machine,
			// Plain during command wiring; the subscribe-time cache rejects it.
			states: () => ({ value: new (class Opaque {})() }),
			commands: () => ({ noop: () => undefined }),
		});
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		await expect(core.execute({ command: "noop" })).rejects.toThrow();
		expect(invoked).toHaveBeenCalled();
		expect(released).toHaveBeenCalled();
		error.mockRestore();
		core.dispose();
	});

	it.each([
		["undefined", undefined],
		["null", null],
		["0", 0],
		["empty string", ""],
		["false", false],
	])(
		"rejects execute when the first projection throws %s",
		async (_, value) => {
			const { machine } = invokingMachine();
			const command = vi.fn();
			let reads = 0;
			const core = igniteCore({
				source: machine,
				// Command wiring reads once; the subscribe-time delivery throws.
				states: () => {
					reads += 1;
					if (reads > 1) throw value;
					return { count: 0 };
				},
				commands: () => ({ noop: command }),
			});
			let rejected = false;
			let reason: unknown = Symbol("unset");
			await core.execute({ command: "noop" }).catch((caught: unknown) => {
				rejected = true;
				reason = caught;
			});
			expect(rejected).toBe(true);
			expect(reason).toBe(value);
			expect(command).not.toHaveBeenCalled();
			core.dispose();
		},
	);

	it("keeps the command rejection when the quiet lease cleanup throws", async () => {
		const store = configureStore({ reducer: slice.reducer });
		const subscribe = store.subscribe;
		let subscriptions = 0;
		store.subscribe = (listener) => {
			const unsubscribe = subscribe(listener);
			subscriptions += 1;
			if (subscriptions !== 2) return unsubscribe;
			return () => {
				unsubscribe();
				throw new Error("cleanup failed");
			};
		};
		const core = reduxCore({
			source: () => store,
			states: (state) => ({ count: state.count }),
			commands: () => ({
				fail: async () => {
					throw new Error("command failed");
				},
			}),
		});
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const watch = core.watch(() => undefined);
		await expect(core.execute({ command: "fail" })).rejects.toThrow(
			"command failed",
		);
		watch.unsubscribe();
		error.mockRestore();
		core.dispose();
	});

	it("releases the runtime when execute names an unknown command", async () => {
		const { machine, invoked, released } = invokingMachine();
		const core = igniteCore({
			source: machine,
			states: (snapshot) => ({ count: snapshot.context.count }),
			commands: () => ({ noop: () => undefined }),
		});
		await expect(
			core.execute({ command: "missing" as "noop" }),
		).rejects.toThrow(/unknown command/i);
		expect(invoked.mock.calls.length).toBe(released.mock.calls.length);
		core.dispose();
	});

	it("keeps the unknown-command error when the runtime rollback throws", async () => {
		const adapter: IgniteAdapter<null, never> = {
			getSnapshot: () => null,
			send: () => {},
			stop: () => {},
			subscribeSnapshots: () => ({ unsubscribe() {} }),
		};
		const lifetime = createLifetime();
		const { runtime } = createAgentRuntime({
			lifetime,
			dispose: () => lifetime.dispose(),
			eventTypes: [],
			resolveStates: () => ({}),
			resolveRuntime: () => ({
				adapter,
				host: new EventTarget(),
				additionalArgs: { noop: () => undefined },
				rollback: () => {
					throw new Error("cleanup failed");
				},
			}),
		});
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		await expect(
			runtime.execute({ command: "missing" as "noop" }),
		).rejects.toThrow(/unknown command/i);
		expect(error).toHaveBeenCalled();
		error.mockRestore();
		runtime.dispose();
	});
});

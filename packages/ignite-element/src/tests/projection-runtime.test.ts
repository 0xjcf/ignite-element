// @vitest-environment node
import { type IgniteAdapter, StateScope } from "@ignite-element/core";
import { describe, expect, it, vi } from "vitest";
import { createComponentFactory } from "../createComponentFactory";
import { createAgentRuntime } from "../runtime/agent";
import { createLifetime } from "../runtime/lifetime";

type InspectionEvent = { type: "NOOP" };
describe("headless observation contracts", () => {
	it("keeps discovery and execution free of implicit inspection", async () => {
		const adapter: IgniteAdapter<{ sequence: number }, InspectionEvent> = {
			scope: StateScope.Isolated,
			subscribeSnapshots: () => ({ unsubscribe: () => undefined }),
			send: () => undefined,
			getSnapshot: vi.fn(() => ({ sequence: 99 })),
			stop: vi.fn(),
		};
		const resolveStates = vi.fn(() => ({ sequence: 99 }));
		const lifetime = createLifetime();
		const { runtime } = createAgentRuntime({
			lifetime,
			dispose: () => lifetime.dispose(),
			eventTypes: [],
			resolveRuntime: () => ({
				adapter,
				additionalArgs: { inspect: () => undefined },
				host: new EventTarget(),
			}),
			resolveStates,
		});
		expect(runtime.get("schema")).toMatchObject({ states: { schema: null } });
		expect(adapter.getSnapshot).not.toHaveBeenCalled();
		expect(resolveStates).not.toHaveBeenCalled();
		const result = await runtime.execute({ command: "inspect" });
		expect(result).toBeUndefined();
		expect(adapter.getSnapshot).not.toHaveBeenCalled();
		expect(resolveStates).not.toHaveBeenCalled();
		runtime.dispose();
	});
	it("skips enumerable command accessors in headless schema discovery", async () => {
		const snapshot = { value: 1 };
		const adapter: IgniteAdapter<typeof snapshot, InspectionEvent> = {
			scope: StateScope.Isolated,
			subscribeSnapshots: () => ({ unsubscribe: () => undefined }),
			send: () => undefined,
			getSnapshot: () => snapshot,
			stop: vi.fn(),
		};
		const createAdapter = Object.assign(() => adapter, {
			scope: StateScope.Isolated,
			resolveStateSnapshot: (
				current: IgniteAdapter<typeof snapshot, InspectionEvent>,
			) => current.getSnapshot(),
			resolveCommandActor: (
				current: IgniteAdapter<typeof snapshot, InspectionEvent>,
			) => ({
				send: (event: InspectionEvent) => current.send(event),
				getState: () => current.getSnapshot(),
			}),
		});
		const getter = vi.fn(() => {
			throw new Error("command accessor invoked");
		});
		const additionalArgs = {};
		Object.defineProperty(additionalArgs, "accessorCommand", {
			enumerable: true,
			get: getter,
		});
		const core = createComponentFactory(createAdapter, {
			states: () => ({}),
			commands: () => ({}),
			createAdditionalArgs: () => additionalArgs,
			createRenderStrategy: () => ({
				attach: () => undefined,
				render: () => undefined,
			}),
		});

		const get = Reflect.get(core, "get");
		expect(typeof get).toBe("function");
		if (typeof get !== "function") {
			throw new Error("component factory is missing get");
		}
		Reflect.apply(get, core, ["states"]);
		const schema = Reflect.apply(get, core, ["schema"]);
		if (typeof schema !== "object" || schema === null) {
			throw new Error("component factory returned an invalid schema");
		}
		expect(Reflect.get(schema, "commands")).toEqual({});
		expect(getter).not.toHaveBeenCalled();

		Reflect.get(core, "dispose")();
	});
	it("delivers the first post-install watcher update after synchronous seeds", () => {
		type Snapshot = { value: number };

		for (const synchronousSeeds of [
			[],
			[{ value: 1 }],
			[{ value: 1 }, { value: 2 }, { value: 3 }],
		]) {
			let current: Snapshot = { value: 0 };
			let notify: (() => void) | undefined;
			const unsubscribe = vi.fn();
			const adapter: IgniteAdapter<Snapshot, InspectionEvent> = {
				scope: StateScope.Isolated,
				subscribeSnapshots: (listener) => {
					notify = () => listener(current);
					for (const seed of synchronousSeeds) {
						current = seed;
						listener(current);
					}
					return { unsubscribe };
				},
				send: () => undefined,
				getSnapshot: () => current,
				stop: vi.fn(),
			};
			const handler = vi.fn(
				(_snapshot: Snapshot, _previous: Snapshot): void => undefined,
			);
			const lifetime = createLifetime();
			const runtime = createAgentRuntime({
				lifetime,
				dispose: () => lifetime.dispose(),
				eventTypes: [],
				resolveRuntime: () => ({
					adapter,
					additionalArgs: {},
					host: new EventTarget(),
				}),
				resolveStates: () => ({}),
			});

			const subscription = runtime.watchSnapshot(handler);
			const lastSeed = current;
			expect(handler).not.toHaveBeenCalled();

			current = { value: 10 };
			notify?.();
			current = { value: 11 };
			notify?.();

			expect(handler).toHaveBeenNthCalledWith(1, { value: 10 }, lastSeed);
			expect(handler).toHaveBeenNthCalledWith(2, { value: 11 }, { value: 10 });

			subscription.unsubscribe();
			expect(unsubscribe).toHaveBeenCalledOnce();
		}
	});
	it("delivers current derived states once when subscribe replays synchronously", () => {
		type Snapshot = { value: number };
		let current: Snapshot = { value: 0 };
		let notify: (value: Snapshot) => void = () => undefined;
		const unsubscribe = vi.fn();
		const adapter: IgniteAdapter<Snapshot, InspectionEvent> = {
			scope: StateScope.Isolated,
			subscribeSnapshots: (listener) => {
				notify = listener;
				listener({ value: 1 });
				listener({ value: 1 });
				return { unsubscribe };
			},
			send: () => undefined,
			getSnapshot: () => current,
			stop: vi.fn(),
		};
		const handler = vi.fn();
		const lifetime = createLifetime();
		const owned = createAgentRuntime({
			lifetime,
			dispose: () => lifetime.dispose(),
			eventTypes: [],
			resolveRuntime: () => ({
				adapter,
				additionalArgs: {},
				host: new EventTarget(),
			}),
			resolveStates: () => ({ count: current.value }),
			resolveDeliveredStates: (snapshot: Snapshot) => ({
				count: snapshot.value,
			}),
		});

		const subscription = owned.runtime.watch(handler);
		expect(handler).toHaveBeenCalledTimes(1);
		expect(handler).toHaveBeenCalledWith({ count: 1 }, undefined);

		current = { value: 4 };
		notify(current);
		expect(handler).toHaveBeenCalledTimes(2);
		expect(handler).toHaveBeenLastCalledWith({ count: 4 }, { count: 1 });

		const quiet = vi.fn();
		owned.runtime.watch(quiet, { emitCurrent: false });
		expect(quiet).not.toHaveBeenCalled();

		subscription.unsubscribe();
		lifetime.dispose();
	});
});

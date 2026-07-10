import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assign, createActor, createMachine, emit, setup } from "xstate";
import createXStateAdapter from "../../adapters/XStateAdapter";
import counterMachine from "../fixtures/xstateCounterMachine";
import { StateScope } from "../../IgniteAdapter";

describe("XStateAdapter", () => {
	let adapterFactory: ReturnType<typeof createXStateAdapter>;
	let adapter: ReturnType<typeof adapterFactory>;

	beforeEach(() => {
		adapterFactory = createXStateAdapter(counterMachine);
		adapter = adapterFactory();
	});

	afterEach(() => {
		adapter.stop();
		vi.clearAllMocks();
	});

	it("should initialize and return the current state", () => {
		expect(adapter).toBeDefined();
		expect(adapter.getSnapshot().value).toBe("idle");
		expect(adapter.getSnapshot().context.count).toBe(0);
	});

	it("should dispatch events and update state", () => {
		adapter.send({ type: "START" });
		expect(adapter.getSnapshot().value).toBe("active");

		adapter.send({ type: "INC" });
		expect(adapter.getSnapshot().context.count).toBe(1);

		adapter.send({ type: "DEC" });
		expect(adapter.getSnapshot().context.count).toBe(0);
	});

	it("should handle multiple subscriptions and notify listeners", () => {
		const listener1 = vi.fn();
		const listener2 = vi.fn();

		const subscription1 = adapter.subscribeSnapshots(listener1);
		const subscription2 = adapter.subscribeSnapshots(listener2);

		adapter.send({ type: "START" });

		expect(listener1).toHaveBeenCalledTimes(2);
		expect(listener1).toHaveBeenCalledWith(
			expect.objectContaining({ value: "idle" }), // Initial state
		);
		expect(listener1).toHaveBeenCalledWith(
			expect.objectContaining({ value: "active" }), // After START
		);

		expect(listener2).toHaveBeenCalledTimes(2);
		expect(listener2).toHaveBeenCalledWith(
			expect.objectContaining({ value: "idle" }), // Initial state
		);
		expect(listener2).toHaveBeenCalledWith(
			expect.objectContaining({ value: "active" }), // After START
		);

		subscription1.unsubscribe();
		subscription2.unsubscribe();
	});

	it("allows individual subscriptions to unsubscribe without affecting others", () => {
		const listener1 = vi.fn();
		const listener2 = vi.fn();

		const subscription1 = adapter.subscribeSnapshots(listener1);
		const subscription2 = adapter.subscribeSnapshots(listener2);

		subscription1.unsubscribe();

		adapter.send({ type: "START" });

		expect(listener1).toHaveBeenCalledTimes(1);
		expect(listener2).toHaveBeenCalledTimes(2);

		subscription2.unsubscribe();
	});

	it("should clean up subscriptions when stopped", () => {
		const consoleErrorMock = vi
			.spyOn(console, "warn")
			.mockImplementation(() => {});

		const listener = vi.fn();
		adapter.subscribeSnapshots(listener);
		adapter.stop();
		adapter.send({ type: "INC" });

		// Listener should only have been called once (for the initial state)
		expect(listener).toHaveBeenCalledTimes(1);
		expect(listener).toHaveBeenCalledWith(
			expect.objectContaining({ value: "idle" }), // Ensure correct initial state
		);
		expect(consoleErrorMock).toHaveBeenCalledWith(
			expect.stringContaining("Cannot send events when adapter is stopped"),
		);

		consoleErrorMock.mockRestore(); // Restore original console.error
	});

	it("should log a warning when sending events after stop", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		adapter.stop();
		adapter.send({ type: "INC" });

		expect(warnSpy).toHaveBeenCalledWith(
			"[XStateAdapter] Cannot send events when adapter is stopped.",
		);

		warnSpy.mockRestore();
	});

	it("should return the last known state after stop", () => {
		adapter.send({ type: "START" });
		adapter.stop();

		expect(adapter.getSnapshot().value).toBe("active");
		expect(adapter.getSnapshot().context.count).toBe(0);
	});

	it("should prevent new subscriptions after stop", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		adapter.stop();
		expect(() => adapter.subscribeSnapshots(vi.fn())).not.toThrow();
		expect(warnSpy).toHaveBeenCalledWith(
			"[XStateAdapter] Cannot subscribe when adapter is stopped.",
		);
		warnSpy.mockRestore();
	});

	it("should allow multiple calls to stop without error", () => {
		adapter.stop();
		expect(() => adapter.stop()).not.toThrow();
	});

	it("should allow unsubscribe calls before and after stop without errors", () => {
		const listener = vi.fn();
		const subscription = adapter.subscribeSnapshots(listener);

		expect(() => subscription.unsubscribe()).not.toThrow();

		adapter.stop();
		expect(() => subscription.unsubscribe()).not.toThrow();
	});

	it("should return the current state by using state directly", () => {
		adapter.send({ type: "START" });
		expect(adapter.getSnapshot().value).toBe("active");
		expect(adapter.getSnapshot().count).toBe(0);
	});

	it("should return the last known state after stop using state directly", () => {
		adapter.send({ type: "START" });
		adapter.send({ type: "INC" });
		adapter.stop();

		expect(adapter.getSnapshot().value).toBe("active");
		expect(adapter.getSnapshot().count).toBe(1);
	});

	it("marks isolated adapter scope", () => {
		expect(adapterFactory.scope).toBe(StateScope.Isolated);
		expect(adapter.scope).toBe(StateScope.Isolated);
	});

	it("exposes facade metadata for isolated adapters", () => {
		const snapshot = adapterFactory.resolveStateSnapshot(adapter);
		expect(snapshot.value).toBe("idle");
		const commandActor = adapterFactory.resolveCommandActor(adapter);
		commandActor.send({ type: "START" });
		expect(adapter.getSnapshot().value).toBe("active");
		commandActor.send({ type: "INC" });
		expect(adapter.getSnapshot().context.count).toBe(1);
		// The command actor exposes xstate-native getSnapshot() (not an invented
		// `.state` accessor) for reading current state inside commands/effects.
		expect(commandActor.getSnapshot().value).toBe("active");
		expect(commandActor.getSnapshot().context.count).toBe(1);
	});

	it("reuses actor instances for shared adapters", () => {
		const actor = createActor(counterMachine);
		actor.start();

		const sharedFactory = createXStateAdapter(actor);
		expect(sharedFactory.scope).toBe(StateScope.Shared);

		const adapterA = sharedFactory();
		const adapterB = sharedFactory();

		expect(adapterA.scope).toBe(StateScope.Shared);
		expect(adapterB.scope).toBe(StateScope.Shared);

		adapterA.send({ type: "START" });

		expect(adapterB.getSnapshot().value).toBe("active");
		adapterA.stop();
		adapterB.stop();
		actor.stop();
	});

	it("does not stop a consumer-owned (shared) actor when the adapter stops", () => {
		const actor = createActor(counterMachine);
		actor.start();
		const stopSpy = vi.spyOn(actor, "stop");

		const sharedFactory = createXStateAdapter(actor);
		const sharedAdapter = sharedFactory();
		expect(sharedAdapter.scope).toBe(StateScope.Shared);

		sharedAdapter.subscribeSnapshots(vi.fn());
		sharedAdapter.stop();

		// ownsSource === false for a consumer-passed started actor: the adapter
		// stops, but the actor it did not create keeps running.
		expect(stopSpy).not.toHaveBeenCalled();

		actor.stop();
	});

	it("exposes facade metadata for shared adapters", () => {
		const actor = createActor(counterMachine);
		actor.start();
		const sharedFactory = createXStateAdapter(actor);
		const sharedAdapter = sharedFactory();
		const snapshot = sharedFactory.resolveStateSnapshot(sharedAdapter);
		expect(snapshot.value).toBe("idle");
		const commandActor = sharedFactory.resolveCommandActor(sharedAdapter);
		commandActor.send({ type: "START" });
		expect(sharedAdapter.getSnapshot().value).toBe("active");
		sharedAdapter.stop();
		actor.stop();
	});

	it("preserves snapshot and context descriptors across reads and delivery", () => {
		const contextAccessor = vi.fn(() => "context accessor value");
		const snapshotAccessor = vi.fn(() => "snapshot accessor value");
		const contextSymbol = Symbol("context");
		const snapshotSymbol = Symbol("snapshot");
		const context = {
			context: "context collision",
			value: "context value",
			visibleContext: "visible context",
		};
		Object.defineProperty(context, "contextAccessor", {
			enumerable: true,
			get: contextAccessor,
		});
		Object.defineProperty(context, "hiddenContext", {
			value: "hidden context",
			enumerable: false,
		});
		Object.defineProperty(context, contextSymbol, {
			value: "context symbol",
			enumerable: true,
		});
		const machine = createMachine({
			context,
			initial: "idle",
			states: { idle: {} },
		});
		const actor = createActor(machine);
		actor.start();
		const snapshot = actor.getSnapshot();
		Object.defineProperty(snapshot, "snapshotAccessor", {
			enumerable: true,
			get: snapshotAccessor,
		});
		Object.defineProperty(snapshot, "hiddenSnapshot", {
			value: "hidden snapshot",
			enumerable: false,
		});
		Object.defineProperty(snapshot, snapshotSymbol, {
			value: "snapshot symbol",
			enumerable: true,
		});
		const sharedFactory = createXStateAdapter(actor);
		const sharedAdapter = sharedFactory();
		const listener = vi.fn();
		const subscription = sharedAdapter.subscribeSnapshots(listener);
		const current = sharedAdapter.getSnapshot();
		const delivered: unknown = listener.mock.calls[0]?.[0];

		const verifyDescriptors = (state: unknown) => {
			expect(state).toBeTypeOf("object");
			if (typeof state !== "object" || state === null) {
				return;
			}
			expect(Object.getOwnPropertyDescriptor(state, "value")?.value).toBe(
				"context value",
			);
			expect(
				Object.getOwnPropertyDescriptor(state, "visibleContext")?.value,
			).toBe("visible context");
			expect(Object.getOwnPropertyDescriptor(state, "context")?.value).toBe(
				context,
			);
			expect(Object.getOwnPropertyDescriptor(state, "context")).toMatchObject({
				enumerable: true,
				writable: true,
				configurable: true,
			});
			expect(
				Object.getOwnPropertyDescriptor(state, "contextAccessor")?.get,
			).toBe(contextAccessor);
			expect(
				Object.getOwnPropertyDescriptor(state, "snapshotAccessor")?.get,
			).toBe(snapshotAccessor);
			expect(Object.getOwnPropertyDescriptor(state, contextSymbol)?.value).toBe(
				"context symbol",
			);
			expect(
				Object.getOwnPropertyDescriptor(state, snapshotSymbol)?.value,
			).toBe("snapshot symbol");
			expect(
				Object.getOwnPropertyDescriptor(state, "hiddenContext"),
			).toBeUndefined();
			expect(
				Object.getOwnPropertyDescriptor(state, "hiddenSnapshot"),
			).toBeUndefined();
		};

		verifyDescriptors(current);
		verifyDescriptors(delivered);
		expect(contextAccessor).not.toHaveBeenCalled();
		expect(snapshotAccessor).not.toHaveBeenCalled();

		subscription.unsubscribe();
		sharedAdapter.stop();
		actor.stop();
	});

	it("fails safely when snapshot context is absent or accessor-backed", () => {
		const absentActor = createActor(
			createMachine({
				context: { count: 0 },
				initial: "idle",
				states: { idle: {} },
			}),
		);
		absentActor.start();
		Reflect.deleteProperty(absentActor.getSnapshot(), "context");
		const absentAdapter = createXStateAdapter(absentActor)();

		expect(() => absentAdapter.getSnapshot()).toThrow(
			"[XStateAdapter] Snapshot context must be an own data property.",
		);

		absentAdapter.stop();
		absentActor.stop();

		const contextGetter = vi.fn(() => ({ count: 0 }));
		const accessorActor = createActor(
			createMachine({
				context: { count: 0 },
				initial: "idle",
				states: { idle: {} },
			}),
		);
		accessorActor.start();
		Object.defineProperty(accessorActor.getSnapshot(), "context", {
			enumerable: true,
			configurable: true,
			get: contextGetter,
		});
		const accessorAdapter = createXStateAdapter(accessorActor)();
		const listener = vi.fn();

		expect(() => accessorAdapter.subscribeSnapshots(listener)).toThrow(
			"[XStateAdapter] Snapshot context must be an own data property.",
		);
		expect(contextGetter).not.toHaveBeenCalled();
		expect(listener).not.toHaveBeenCalled();

		accessorAdapter.stop();
		accessorActor.stop();
	});
});

// The optional subscribeEvents() seam bridges XState v5 emitted events (emit(...) /
// actor.on('*')) into the headless runtime's event surface, mirroring the
// ActorWebAdapter subscribeEvents() coverage.
describe("XStateAdapter subscribeEvents() emitted-event seam", () => {
	const emittingMachine = setup({
		types: {
			context: {} as { count: number },
			events: {} as { type: "INC" },
			emitted: {} as { type: "count-changed"; count: number },
		},
	}).createMachine({
		context: { count: 0 },
		on: {
			INC: {
				actions: [
					assign({ count: ({ context }) => context.count + 1 }),
					emit(({ context }) => ({
						type: "count-changed" as const,
						count: context.count,
					})),
				],
			},
		},
	});

	it("bridges actor emits into subscribeEvents() and cleans up on unsubscribe", () => {
		const factory = createXStateAdapter(emittingMachine);
		const streamingAdapter = factory();

		const received: Array<{ type: string; count?: number }> = [];
		const subscription = streamingAdapter.subscribeEvents?.((event) =>
			received.push(event as { type: string; count?: number }),
		);

		streamingAdapter.send({ type: "INC" });
		expect(received).toEqual([{ type: "count-changed", count: 1 }]);

		subscription?.unsubscribe();
		streamingAdapter.send({ type: "INC" });
		expect(received).toHaveLength(1);

		streamingAdapter.stop();
	});

	it("no-ops subscribeEvents() on a stopped adapter (with a warning)", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const factory = createXStateAdapter(emittingMachine);
		const stoppedAdapter = factory();
		stoppedAdapter.stop();

		const listener = vi.fn();
		const subscription = stoppedAdapter.subscribeEvents?.(listener);

		expect(warn).toHaveBeenCalledWith(
			"[XStateAdapter] Cannot subscribe to emitted events when adapter is stopped.",
		);
		expect(listener).not.toHaveBeenCalled();
		expect(() => subscription?.unsubscribe()).not.toThrow();
	});
});

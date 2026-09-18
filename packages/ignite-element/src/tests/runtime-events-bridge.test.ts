import {
	type ActorWebSourceSnapshot,
	createActorWebAdapter,
} from "@ignite-element/adapters/actor-web";
import type { IgniteAdapter } from "@ignite-element/core";
import { describe, expect, it, vi } from "vitest";
import { createAgentRuntime as createOwnedAgentRuntime } from "../runtime/agent";
import { createLifetime } from "../runtime/lifetime";

// Unit coverage intentionally includes the private raw-observation seam. It is
// not assigned to the public core; public removed-method controls live separately.
function createAgentRuntime<
	State,
	Event,
	States extends Record<string, unknown>,
	Args extends Record<string, unknown>,
>(
	options: Omit<
		Parameters<typeof createOwnedAgentRuntime<State, Event, States, Args>>[0],
		"lifetime" | "dispose"
	>,
) {
	const lifetime = createLifetime();
	const owned = createOwnedAgentRuntime({
		...options,
		lifetime,
		dispose: () => lifetime.dispose(),
	});
	return { ...owned.runtime, watchSnapshot: owned.watchSnapshot };
}

describe("Actor-Web observation rollback", () => {
	function sourceFixture() {
		const listeners = new Set<
			(snapshot: ActorWebSourceSnapshot<{ count: number }>) => void
		>();
		const snapshot = () => ({
			address: "counter",
			context: { count: 0 },
			phase: "ready",
			toJSON: () => ({ count: 0 }),
		});
		const releaseSource = vi.fn();
		const releaseTransport = vi.fn();
		const close = vi.fn();
		const source = {
			address: "counter",
			snapshot,
			close,
			subscribe(
				listener: (value: ActorWebSourceSnapshot<{ count: number }>) => void,
			) {
				listeners.add(listener);
				return () => {
					listeners.delete(listener);
					releaseSource();
				};
			},
			subscribeTransportStatus: vi.fn(() => () => releaseTransport()),
		};
		return { source, listeners, releaseSource, releaseTransport, close };
	}
	for (const firstFailure of [undefined, null]) {
		it(`preserves thrown ${String(firstFailure)} while attempting both cleanup handles once`, () => {
			const h = sourceFixture();
			h.releaseSource.mockImplementationOnce(() => {
				throw firstFailure;
			});
			if (firstFailure === null) {
				h.releaseTransport.mockImplementationOnce(() => {
					throw new Error("secondary cleanup failure");
				});
			}
			const adapter = createActorWebAdapter(h.source)();
			const subscription = adapter.subscribeSnapshots(() => {});
			let caught = false;
			let received: unknown;
			try {
				subscription.unsubscribe();
			} catch (error) {
				caught = true;
				received = error;
			}
			expect(h.releaseSource).toHaveBeenCalledTimes(1);
			expect(h.releaseTransport).toHaveBeenCalledTimes(1);
			expect(h.listeners.size).toBe(0);
			expect(() => subscription.unsubscribe()).not.toThrow();
			expect(h.releaseSource).toHaveBeenCalledTimes(1);
			expect(h.releaseTransport).toHaveBeenCalledTimes(1);
			expect(h.close).not.toHaveBeenCalled();
			expect(caught).toBe(true);
			expect(received).toBe(firstFailure);
		});
	}
	it("rolls back a source observation when transport setup fails and later recovers", () => {
		const h = sourceFixture();
		const failure = new Error("transport setup failed");
		h.source.subscribeTransportStatus.mockImplementationOnce(() => {
			throw failure;
		});
		const adapter = createActorWebAdapter(h.source)();
		expect(() => adapter.subscribeSnapshots(() => {})).toThrow(failure);
		expect(h.listeners.size).toBe(0);
		expect(h.releaseSource).toHaveBeenCalledTimes(1);
		const received = vi.fn();
		const subscription = adapter.subscribeSnapshots(received);
		expect(received).toHaveBeenCalled();
		subscription.unsubscribe();
		subscription.unsubscribe();
		expect(h.listeners.size).toBe(0);
		expect(h.releaseSource).toHaveBeenCalledTimes(2);
		expect(h.releaseTransport).toHaveBeenCalledTimes(1);
		expect(h.close).not.toHaveBeenCalled();
	});
	it("tries both cleanup handles, preserves the first failure and permits a later subscription", () => {
		const h = sourceFixture();
		const first = new Error("source cleanup failed");
		h.releaseSource.mockImplementationOnce(() => {
			throw first;
		});
		h.releaseTransport.mockImplementationOnce(() => {
			throw new Error("transport cleanup failed");
		});
		const adapter = createActorWebAdapter(h.source)();
		const subscription = adapter.subscribeSnapshots(() => {});
		expect(() => subscription.unsubscribe()).toThrow(first);
		expect(h.releaseTransport).toHaveBeenCalledTimes(1);
		expect(() => subscription.unsubscribe()).not.toThrow();
		const next = adapter.subscribeSnapshots(() => {});
		next.unsubscribe();
		expect(h.releaseSource).toHaveBeenCalledTimes(2);
		expect(h.close).not.toHaveBeenCalled();
	});
});

describe("runtime handle custody", () => {
	function handles() {
		const host = new EventTarget();
		const listeners = new Set<(state: number) => void>();
		const getSnapshot = vi.fn(() => 0);
		const unsubscribe = vi.fn();
		const adapter: IgniteAdapter<number, never> = {
			getSnapshot,
			send() {},
			stop() {},
			subscribeSnapshots(listener) {
				listeners.add(listener);
				return {
					unsubscribe() {
						listeners.delete(listener);
						unsubscribe();
					},
				};
			},
		};
		const runtime = createAgentRuntime({
			eventTypes: [],
			resolveRuntime: () => ({
				adapter,
				additionalArgs: {},
				host,
			}),
			resolveStates: () => ({}),
		});
		return {
			runtime,
			getSnapshot,
			unsubscribe,
			host,
			activeSubscriptions: () => listeners.size,
			deliver: () => {
				for (const listener of listeners) listener(1);
			},
		};
	}
	it("a second unsubscribe never releases another consumer's subscription", () => {
		const h = handles();
		const received = vi.fn();
		const first = h.runtime.watchSnapshot(() => {});
		const second = h.runtime.watchSnapshot(received);
		first.unsubscribe();
		first.unsubscribe();
		expect(h.activeSubscriptions()).toBe(1);
		h.deliver();
		expect(received).toHaveBeenCalledWith(1, 0);
		second.unsubscribe();
		expect(h.activeSubscriptions()).toBe(0);
		expect(h.unsubscribe).toHaveBeenCalledTimes(2);
	});
	it("setup failure leaves existing subscriptions intact and permits later observation", () => {
		const h = handles();
		const failure = new Error("initial read failed");
		h.getSnapshot.mockImplementationOnce(() => {
			throw failure;
		});
		const states = h.runtime.watch(() => {});
		// watchStates does not read the native snapshot in this fixture.
		const baseline = h.activeSubscriptions();
		expect(() => h.runtime.watchSnapshot(() => {})).toThrow(failure);
		expect(h.activeSubscriptions()).toBe(baseline);
		const next = h.runtime.watchSnapshot(() => {});
		next.unsubscribe();
		expect(h.activeSubscriptions()).toBe(baseline);
		states.unsubscribe();
		expect(h.activeSubscriptions()).toBe(0);
	});
	it("unsubscribe failure preserves the primary error and still releases once", () => {
		const h = handles();
		const failure = new Error("unsubscribe failed");
		h.unsubscribe.mockImplementation(() => {
			throw failure;
		});
		const handle = h.runtime.watchSnapshot(() => {});
		expect(() => handle.unsubscribe()).toThrow(failure);
		expect(h.activeSubscriptions()).toBe(0);
		expect(() => handle.unsubscribe()).not.toThrow();
		expect(h.unsubscribe).toHaveBeenCalledTimes(1);
	});
	it("event unsubscribe is idempotent with two live consumers", () => {
		const h = handles();
		const received = vi.fn();
		const a = h.runtime.on("fact", () => {});
		const b = h.runtime.on("fact", received);
		a.unsubscribe();
		a.unsubscribe();
		h.host.dispatchEvent(new Event("fact"));
		expect(received).toHaveBeenCalledOnce();
		b.unsubscribe();
		h.host.dispatchEvent(new Event("fact"));
		expect(received).toHaveBeenCalledOnce();
	});
});

/**
 * E2 — runtime bridge for the adapter `subscribeEvents()` emitted-event seam.
 * Exercised with a controllable fake adapter (actor-web end-to-end is E4).
 */

type Emitted = { type: string; [key: string]: unknown };

function makeHarness(commands: Record<string, () => void> = {}) {
	const streamListeners = new Set<(event: Emitted) => void>();
	const host = document.createElement("div");
	let state = { count: 0 };

	const adapter: IgniteAdapter<typeof state, { type: string }, Emitted> = {
		subscribeSnapshots: () => ({ unsubscribe() {} }),
		subscribeEvents: (listener) => {
			streamListeners.add(listener);
			return {
				unsubscribe: () => {
					streamListeners.delete(listener);
				},
			};
		},
		send: () => {},
		getSnapshot: () => state,
		stop: () => {},
	};

	const runtime = createAgentRuntime<
		typeof state,
		{ type: string },
		Record<string, never>,
		Record<string, unknown>
	>({
		eventTypes: ["ui-event"],
		resolveRuntime: () => ({
			// E2 keeps the runtime adapter typed at Emitted=never; the Emitted->Events
			// static thread lands in E3 (actor-web). The runtime reads subscribeEvents()
			// structurally, so a test-only cast is sufficient here.
			adapter: adapter as unknown as IgniteAdapter<
				typeof state,
				{ type: string }
			>,
			additionalArgs: commands,
			host,
		}),
		resolveStates: () => ({}),
	});

	return {
		runtime,
		host,
		setState: (next: typeof state) => {
			state = next;
		},
		// Simulate a source emitting a domain event.
		emit: (event: Emitted) => {
			for (const listener of streamListeners) {
				listener(event);
			}
		},
		activeStreamSubscriptions: () => streamListeners.size,
	};
}

describe("runtime bridge for adapter.subscribeEvents() emitted events", () => {
	it("on(type) receives source emits and stops after unsubscribe", () => {
		const { runtime, emit, activeStreamSubscriptions } = makeHarness();
		const received: unknown[] = [];

		const subscription = runtime.on("OUTCOME_RESOLVED", (event) => {
			received.push(event);
		});
		emit({ type: "OUTCOME_RESOLVED", outcome: "accepted-fork" });
		emit({ type: "OTHER", n: 1 }); // different type — ignored by this listener

		expect(received).toEqual([
			{ type: "OUTCOME_RESOLVED", outcome: "accepted-fork" },
		]);

		subscription.unsubscribe();
		expect(activeStreamSubscriptions()).toBe(0); // event sub cleaned up
		emit({ type: "OUTCOME_RESOLVED", outcome: "again" });
		expect(received).toHaveLength(1); // no longer listening
	});

	it("ignores source emits without a string type", () => {
		const { runtime, emit } = makeHarness();
		const received: unknown[] = [];

		const subscription = runtime.on("123", (event) => {
			received.push(event);
		});
		emit({ type: 123, outcome: "coerced" } as unknown as Emitted);

		expect(received).toEqual([]);
		subscription.unsubscribe();
	});

	it("execute().events captures source emits (uniform shape) alongside declared/effects events", async () => {
		// The command emits both a declared/effects event (host bus) and a source
		// event (subscribeEvents seam) during the command window.
		const h = makeHarness({
			acceptFork() {
				h.host.dispatchEvent(
					new CustomEvent("ui-event", { detail: { clicked: true } }),
				);
				h.emit({ type: "OUTCOME_RESOLVED", outcome: "accepted-fork" });
			},
		});

		const result = await h.runtime.execute({ command: "acceptFork" });

		expect(result.events).toContainEqual({
			type: "OUTCOME_RESOLVED",
			outcome: "accepted-fork",
		});
		expect(result.events).toContainEqual({
			type: "ui-event",
			clicked: true,
		});
		// no double-count of the source event
		expect(
			result.events.filter((e) => e.type === "OUTCOME_RESOLVED"),
		).toHaveLength(1);
		// transient capture sub cleaned up after the command
		expect(h.activeStreamSubscriptions()).toBe(0);
	});

	it("preserves non-plain CustomEvent detail instead of flattening it", async () => {
		const detail = new Date("2026-07-07T16:00:00.000Z");
		const h = makeHarness({
			emitDate() {
				h.host.dispatchEvent(new CustomEvent("ui-event", { detail }));
			},
		});

		const result = await h.runtime.execute({ command: "emitDate" });

		expect(result.events).toEqual([
			{
				type: "ui-event",
				detail,
			},
		]);
	});

	it("cleans execute listeners when source event subscription setup throws", async () => {
		const host = document.createElement("div");
		const removeEventListener = vi.spyOn(host, "removeEventListener");
		const setupError = new Error("subscribe failed");
		const state = { count: 0 };
		const adapter: IgniteAdapter<typeof state, { type: string }> = {
			subscribeSnapshots: () => ({ unsubscribe() {} }),
			subscribeEvents: () => {
				throw setupError;
			},
			send: () => {},
			getSnapshot: () => state,
			stop: () => {},
		};
		const runtime = createAgentRuntime<
			typeof state,
			{ type: string },
			Record<string, never>,
			Record<string, unknown>
		>({
			eventTypes: ["ui-event"],
			resolveRuntime: () => ({
				adapter,
				additionalArgs: {
					noop() {},
				},
				host,
			}),
			resolveStates: () => ({}),
		});

		await expect(runtime.execute({ command: "noop" })).rejects.toThrow(
			setupError,
		);
		expect(removeEventListener).toHaveBeenCalledWith(
			"ui-event",
			expect.any(Function),
		);
	});

	it("cleans on() listeners when source event subscription setup throws", () => {
		const host = document.createElement("div");
		const removeEventListener = vi.spyOn(host, "removeEventListener");
		const setupError = new Error("subscribe failed");
		const state = { count: 0 };
		const adapter: IgniteAdapter<typeof state, { type: string }> = {
			subscribeSnapshots: () => ({ unsubscribe() {} }),
			subscribeEvents: () => {
				throw setupError;
			},
			send: () => {},
			getSnapshot: () => state,
			stop: () => {},
		};
		const runtime = createAgentRuntime<
			typeof state,
			{ type: string },
			Record<string, never>,
			Record<string, unknown>
		>({
			eventTypes: [],
			resolveRuntime: () => ({
				adapter,
				additionalArgs: {},
				host,
			}),
			resolveStates: () => ({}),
		});

		expect(() => runtime.on("ui-event", () => {})).toThrow(setupError);
		expect(removeEventListener).toHaveBeenCalledWith(
			"ui-event",
			expect.any(Function),
		);
	});

	it("does not let command source cleanup failures mask successful execution", async () => {
		const cleanupError = new Error("unsubscribe failed");
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});
		const host = document.createElement("div");
		const state = { count: 1 };
		const adapter: IgniteAdapter<typeof state, { type: string }> = {
			subscribeSnapshots: () => ({ unsubscribe() {} }),
			subscribeEvents: () => ({
				unsubscribe() {
					throw cleanupError;
				},
			}),
			send: () => {},
			getSnapshot: () => state,
			stop: () => {},
		};
		const runtime = createAgentRuntime<
			typeof state,
			{ type: string },
			Record<string, never>,
			Record<string, unknown>
		>({
			eventTypes: [],
			resolveRuntime: () => ({
				adapter,
				additionalArgs: {
					noop() {},
				},
				host,
			}),
			resolveStates: () => ({}),
		});

		try {
			await expect(runtime.execute({ command: "noop" })).resolves.toMatchObject(
				{
					snapshot: state,
					events: [],
				},
			);
			expect(consoleError).toHaveBeenCalledWith(
				"[igniteCore] Source event subscription cleanup failed after command execution.",
				cleanupError,
			);
		} finally {
			consoleError.mockRestore();
		}
	});

	it("logs on() source cleanup failures without throwing", () => {
		const cleanupError = new Error("unsubscribe failed");
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});
		const host = document.createElement("div");
		const state = { count: 1 };
		const adapter: IgniteAdapter<typeof state, { type: string }> = {
			subscribeSnapshots: () => ({ unsubscribe() {} }),
			subscribeEvents: () => ({
				unsubscribe() {
					throw cleanupError;
				},
			}),
			send: () => {},
			getSnapshot: () => state,
			stop: () => {},
		};
		const runtime = createAgentRuntime<
			typeof state,
			{ type: string },
			Record<string, never>,
			Record<string, unknown>
		>({
			eventTypes: [],
			resolveRuntime: () => ({
				adapter,
				additionalArgs: {},
				host,
			}),
			resolveStates: () => ({}),
		});

		try {
			const subscription = runtime.on("ui-event", () => {});
			expect(() => subscription.unsubscribe()).not.toThrow();
			expect(consoleError).toHaveBeenCalledWith(
				"[igniteCore] Source event subscription cleanup failed.",
				cleanupError,
			);
		} finally {
			consoleError.mockRestore();
		}
	});

	it("adapters without subscribeEvents() are unaffected", async () => {
		const host = document.createElement("div");
		let state = { count: 0 };
		const adapter: IgniteAdapter<typeof state, { type: string }> = {
			subscribeSnapshots: () => ({ unsubscribe() {} }),
			send: () => {},
			getSnapshot: () => state,
			stop: () => {},
		};
		const runtime = createAgentRuntime<
			typeof state,
			{ type: string },
			Record<string, never>,
			Record<string, unknown>
		>({
			eventTypes: [],
			resolveRuntime: () => ({
				adapter,
				additionalArgs: {
					noop() {
						state = { count: 1 };
					},
				},
				host,
			}),
			resolveStates: () => ({}),
		});

		const result = await runtime.execute({ command: "noop" });
		expect(result.events).toEqual([]);
		// on() still works (host path) without throwing
		const sub = runtime.on("whatever", () => {});
		sub.unsubscribe();
	});
});

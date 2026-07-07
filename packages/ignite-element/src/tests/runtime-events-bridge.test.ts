import type { IgniteAdapter } from "@ignite-element/core";
import { describe, expect, it, vi } from "vitest";
import { createAgentRuntime } from "../runtime/agent";

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
		resolveView: () => ({}),
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

		const result = await h.runtime.execute("acceptFork");

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

		const result = await h.runtime.execute("emitDate");

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
			resolveView: () => ({}),
		});

		await expect(runtime.execute("noop")).rejects.toThrow(setupError);
		expect(removeEventListener).toHaveBeenCalledWith(
			"ui-event",
			expect.any(Function),
		);
	});

	it("cleans on() listeners and runtime access when source event subscription setup throws", () => {
		const host = document.createElement("div");
		const removeEventListener = vi.spyOn(host, "removeEventListener");
		const setupError = new Error("subscribe failed");
		const state = { count: 0 };
		let releaseCount = 0;
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
			releaseRuntimeAccess: () => {
				releaseCount += 1;
			},
			resolveRuntime: () => ({
				adapter,
				additionalArgs: {},
				host,
			}),
			resolveView: () => ({}),
		});

		expect(() => runtime.on("ui-event", () => {})).toThrow(setupError);
		expect(removeEventListener).toHaveBeenCalledWith(
			"ui-event",
			expect.any(Function),
		);
		expect(releaseCount).toBe(1);
	});

	it("record() trace + summary include source emits", async () => {
		const h = makeHarness({
			acceptFork() {
				h.emit({ type: "OUTCOME_RESOLVED", outcome: "accepted-fork" });
			},
		});

		const story = h.runtime.record("compare");
		await story.execute("acceptFork");

		expect(story.summary().events).toContainEqual({
			type: "OUTCOME_RESOLVED",
			outcome: "accepted-fork",
		});
		story.stop();
	});

	it("deep-clones retained story events before returning summaries", async () => {
		const h = makeHarness({
			acceptFork() {
				h.emit({
					type: "OUTCOME_RESOLVED",
					nested: { count: 1 },
				});
			},
		});
		const story = h.runtime.record("compare");

		await story.execute("acceptFork");
		const firstSummary = story.summary();
		const firstNested = firstSummary.events[0]?.nested;
		if (
			typeof firstNested !== "object" ||
			firstNested === null ||
			!("count" in firstNested)
		) {
			throw new Error("expected first summary event to include nested count");
		}
		firstNested.count = 99;

		const secondNested = story.summary().events[0]?.nested;
		expect(secondNested).toMatchObject({ count: 1 });
		story.stop();
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
			resolveView: () => ({}),
		});

		const result = await runtime.execute("noop");
		expect(result.events).toEqual([]);
		// on() still works (host path) without throwing
		const sub = runtime.on("whatever", () => {});
		sub.unsubscribe();
	});
});

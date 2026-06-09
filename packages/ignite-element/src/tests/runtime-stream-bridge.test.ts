import type { IgniteAdapter } from "@ignite-element/core";
import { describe, expect, it } from "vitest";
import { createAgentRuntime } from "../runtime/agent";

/**
 * E2 — runtime bridge for the adapter `stream()` emitted-event seam.
 * Exercised with a controllable fake adapter (actor-web end-to-end is E4).
 */

type Emitted = { type: string; [key: string]: unknown };

function makeHarness(commands: Record<string, () => void> = {}) {
	const streamListeners = new Set<(event: Emitted) => void>();
	const host = document.createElement("div");
	let state = { count: 0 };

	const adapter: IgniteAdapter<typeof state, { type: string }, Emitted> = {
		subscribe: () => ({ unsubscribe() {} }),
		stream: (listener) => {
			streamListeners.add(listener);
			return {
				unsubscribe: () => {
					streamListeners.delete(listener);
				},
			};
		},
		send: () => {},
		getState: () => state,
		stop: () => {},
	};

	const runtime = createAgentRuntime<
		typeof state,
		{ type: string },
		Record<string, never>,
		Record<string, unknown>
	>({
		eventTypes: ["ui-event"],
		resolveRuntime: () => ({ adapter, additionalArgs: commands, host }),
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

describe("runtime bridge for adapter.stream() emitted events", () => {
	it("on(type) receives source emits and stops after unsubscribe", () => {
		const { runtime, emit, activeStreamSubscriptions } = makeHarness();
		const received: unknown[] = [];

		const subscription = runtime.on("OUTCOME_RESOLVED", (event) =>
			received.push(event.detail),
		);
		emit({ type: "OUTCOME_RESOLVED", outcome: "accepted-fork" });
		emit({ type: "OTHER", n: 1 }); // different type — ignored by this listener

		expect(received).toEqual([
			{ type: "OUTCOME_RESOLVED", outcome: "accepted-fork" },
		]);

		subscription.unsubscribe();
		expect(activeStreamSubscriptions()).toBe(0); // stream sub cleaned up
		emit({ type: "OUTCOME_RESOLVED", outcome: "again" });
		expect(received).toHaveLength(1); // no longer listening
	});

	it("execute().events captures source emits (uniform shape) alongside declared/effects events", async () => {
		// The command emits both a declared/effects event (host bus) and a source
		// event (stream seam) during the command window.
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
			payload: { type: "OUTCOME_RESOLVED", outcome: "accepted-fork" },
		});
		expect(result.events).toContainEqual({
			type: "ui-event",
			payload: { clicked: true },
		});
		// no double-count of the source event
		expect(
			result.events.filter((e) => e.type === "OUTCOME_RESOLVED"),
		).toHaveLength(1);
		// transient capture sub cleaned up after the command
		expect(h.activeStreamSubscriptions()).toBe(0);
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
			payload: { type: "OUTCOME_RESOLVED", outcome: "accepted-fork" },
		});
		story.stop();
	});

	it("adapters without stream() are unaffected", async () => {
		const host = document.createElement("div");
		let state = { count: 0 };
		const adapter: IgniteAdapter<typeof state, { type: string }> = {
			subscribe: () => ({ unsubscribe() {} }),
			send: () => {},
			getState: () => state,
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

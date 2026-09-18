import { type IgniteAdapter, StateScope } from "@ignite-element/core";
import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { assign, createActor, setup } from "xstate";
import { createIgniteComponentFactory } from "../igniteCore/createIgniteComponentFactory";
import { useIgnite } from "../react";
import { igniteCore } from "../xstate";

const machine = setup({
	types: { context: {} as { count: number }, events: {} as { type: "INC" } },
}).createMachine({
	context: { count: 0 },
	on: {
		INC: { actions: assign({ count: ({ context }) => context.count + 1 }) },
	},
});
let sequence = 0;
const cleanup: (() => void)[] = [];
afterEach(() => {
	for (const release of cleanup.splice(0)) release();
	document.body.replaceChildren();
	vi.restoreAllMocks();
});
const flush = async () => {
	await Promise.resolve();
	await Promise.resolve();
};
function fixture() {
	const actor = createActor(machine).start(),
		evaluated = vi.fn();
	const core = igniteCore({
		source: actor,
		states: (s) => ({ count: s.context.count }),
		commands: ({ source: actor }) => ({
			increment: () => actor.send({ type: "INC" }),
		}),
		events: (e) => ({ changed: e<{ count: number }>() }),
		effects: ({ select, emit }) => {
			const count = select((s) => s.context.count);
			evaluated(count.previous, count.current);
			if (count.changed) emit({ type: "changed", count: count.current });
		},
	});
	const tag = `core-owned-${sequence++}`;
	core(tag, (ctx) => String(ctx.count));
	cleanup.push(() => {
		core.dispose();
		actor.stop();
	});
	return { core, actor, evaluated, element: () => document.createElement(tag) };
}
it("evaluates once for two DOM hosts and mixed headless recipients", async () => {
	const f = fixture(),
		a = f.element(),
		b = f.element(),
		dom = vi.fn(),
		head = vi.fn();
	document.body.addEventListener("changed", dom);
	cleanup.push(() => document.body.removeEventListener("changed", dom));
	document.body.append(a, b);
	f.core.on("changed", head);
	f.core.on("changed", head);
	f.actor.send({ type: "INC" });
	await flush();
	expect(f.evaluated.mock.calls).toEqual([[0, 1]]);
	expect(dom).toHaveBeenCalledTimes(2);
	expect(head).toHaveBeenCalledTimes(2);
});
it("keeps the shared baseline through a zero-view gap without replay", async () => {
	const f = fixture(),
		a = f.element(),
		received = vi.fn();
	a.addEventListener("changed", received);
	f.actor.send({ type: "INC" });
	await flush();
	expect(f.evaluated).not.toHaveBeenCalled();
	document.body.append(a);
	await flush();
	expect(f.evaluated).not.toHaveBeenCalled();
	f.actor.send({ type: "INC" });
	await flush();
	a.remove();
	await flush();
	f.actor.send({ type: "INC" });
	await flush();
	document.body.append(a);
	await flush();
	f.actor.send({ type: "INC" });
	await flush();
	expect(f.evaluated.mock.calls).toEqual([
		[1, 2],
		[2, 3],
		[3, 4],
	]);
	expect(received).toHaveBeenCalledTimes(2);
});
it("does not collapse rapid notifications and uses eligibility at future emission", async () => {
	const f = fixture(),
		a = f.element(),
		received = vi.fn();
	document.body.append(a);
	f.actor.send({ type: "INC" });
	f.actor.send({ type: "INC" });
	const sub = f.core.on("changed", received);
	await flush();
	expect(f.evaluated.mock.calls).toEqual([
		[0, 1],
		[1, 2],
	]);
	expect(received).toHaveBeenCalledTimes(2);
	sub.unsubscribe();
	f.core.on("changed", received);
	await flush();
	expect(received).toHaveBeenCalledTimes(2);
});
it("shares one runner across Strict Mode hooks, DOM, remount and unsubscribe", async () => {
	const f = fixture(),
		stop = vi.spyOn(f.actor, "stop"),
		a = f.element();
	expect(f.evaluated).not.toHaveBeenCalled();
	const hooks = renderHook(() => [useIgnite(f.core), useIgnite(f.core)], {
		wrapper: StrictMode,
	});
	document.body.append(a);
	await act(async () => f.actor.send({ type: "INC" }));
	expect(hooks.result.current[0].count).toBe(1);
	hooks.unmount();
	a.remove();
	await flush();
	f.actor.send({ type: "INC" });
	await flush();
	const remount = renderHook(() => useIgnite(f.core), { wrapper: StrictMode });
	expect(remount.result.current.count).toBe(2);
	expect(f.evaluated.mock.calls).toEqual([
		[0, 1],
		[1, 2],
	]);
	remount.unmount();
	expect(stop).not.toHaveBeenCalled();
});
it("keeps independent core owners over the same borrowed actor", async () => {
	const f = fixture(),
		otherEffect = vi.fn();
	const other = igniteCore({ source: f.actor, effects: otherEffect });
	cleanup.push(() => other.dispose());
	other.watch(() => {});
	f.core.watch(() => {});
	f.actor.send({ type: "INC" });
	await flush();
	expect(f.evaluated).toHaveBeenCalledTimes(1);
	expect(otherEffect).toHaveBeenCalledTimes(1);
});
it("retains separate isolated baselines and recreates only the disconnected instance", async () => {
	const evaluations = vi.fn();
	const core = igniteCore({
		source: machine,
		commands: ({ source: actor }) => ({
			increment: () => actor.send({ type: "INC" }),
		}),
		effects: ({ select }) => {
			const count = select((s) => s.context.count);
			evaluations(count.previous, count.current);
		},
	});
	cleanup.push(() => core.dispose());
	const tag = `isolated-effects-${sequence++}`;
	core(tag, () => null);
	const a = document.createElement(tag),
		b = document.createElement(tag);
	document.body.append(a, b);
	const increment = (element: HTMLElement) => {
		const command = Reflect.get(element, "increment");
		if (typeof command !== "function") throw Error("command missing");
		command();
	};
	increment(a);
	increment(a);
	increment(b);
	await flush();
	expect(evaluations.mock.calls).toEqual([
		[0, 1],
		[1, 2],
		[0, 1],
	]);
	a.remove();
	await flush();
	document.body.append(a);
	increment(a);
	increment(b);
	await flush();
	expect(evaluations.mock.calls.slice(3)).toEqual([
		[0, 1],
		[1, 2],
	]);
});
it("retires queued work and later emissions when a listener disposes the core", async () => {
	const actor = createActor(machine).start(),
		evaluated = vi.fn(),
		first = vi.fn(() => core.dispose()),
		second = vi.fn();
	const core = igniteCore({
		source: actor,
		events: (e) => ({ changed: e<{ count: number }>() }),
		effects: ({ emit }) => {
			evaluated();
			emit({ type: "changed", count: 1 });
			emit({ type: "changed", count: 2 });
		},
	});
	cleanup.push(() => {
		core.dispose();
		actor.stop();
	});
	core.on("changed", first);
	core.on("changed", second);
	actor.send({ type: "INC" });
	actor.send({ type: "INC" });
	await flush();
	expect(evaluated).toHaveBeenCalledTimes(1);
	expect(first).toHaveBeenCalledTimes(1);
	expect(second).not.toHaveBeenCalled();
	expect(actor.getSnapshot().status).toBe("active");
});
it.each(["selection", "payload"] as const)(
	"makes emission inert after disposal during %s",
	async (stage) => {
		const actor = createActor(machine).start(),
			received = vi.fn();
		const core = igniteCore({
			source: actor,
			events: (e) => ({ changed: e<{ count: number }>() }),
			effects: ({ select, emit }) => {
				if (stage === "selection")
					select((s) => {
						core.dispose();
						return s.context.count;
					});
				emit({
					type: "changed",
					get count() {
						if (stage === "payload") core.dispose();
						return 1;
					},
				});
			},
		});
		cleanup.push(() => {
			core.dispose();
			actor.stop();
		});
		core.on("changed", received);
		actor.send({ type: "INC" });
		await flush();
		expect(received).not.toHaveBeenCalled();
	},
);
it("releases a late effect handle after acquisition-time disposal and drains other cleanup", async () => {
	let acquiringEffect = false;
	const late = vi.fn(),
		preparedRelease = vi.fn(),
		stop = vi.fn(),
		evaluated = vi.fn();
	const adapter: IgniteAdapter<number, never> = {
		scope: StateScope.Shared,
		getSnapshot: () => 0,
		send: () => {},
		stop,
		subscribeSnapshots(next) {
			if (!acquiringEffect) {
				next(0);
				return { unsubscribe: preparedRelease };
			}
			core.dispose();
			next(0);
			return { unsubscribe: late };
		},
	};
	const factory = Object.assign(() => adapter, {
		scope: StateScope.Shared,
		resolveStateSnapshot: () => 0,
		resolveCommandActor: () => ({}),
	});
	const core = createIgniteComponentFactory(factory, {
		effects: evaluated,
		events: (e) => ({ unused: e<{ value: number }>() }),
	});
	acquiringEffect = true;
	cleanup.push(() => core.dispose());
	expect(() => core.on("unused", () => {})).toThrow(/disposed/);
	await flush();
	expect(late).toHaveBeenCalledTimes(1);
	expect(preparedRelease).toHaveBeenCalledTimes(1);
	expect(stop).toHaveBeenCalledTimes(1);
	expect(evaluated).not.toHaveBeenCalled();
});
it("drains adapter cleanup when effect observation release fails", () => {
	let acquiringEffect = false;
	const reason = new Error("effect release"),
		release = vi.fn(() => {
			throw reason;
		}),
		stop = vi.fn();
	const adapter: IgniteAdapter<number, never> = {
		scope: StateScope.Shared,
		getSnapshot: () => 0,
		send: () => {},
		stop,
		subscribeSnapshots(next) {
			next(0);
			return { unsubscribe: acquiringEffect ? release : () => {} };
		},
	};
	const factory = Object.assign(() => adapter, {
		scope: StateScope.Shared,
		resolveStateSnapshot: () => 0,
		resolveCommandActor: () => ({}),
	});
	const core = createIgniteComponentFactory(factory, {
		effects: () => {},
		events: (e) => ({ unused: e<{ value: number }>() }),
	});
	acquiringEffect = true;
	core.on("unused", () => {});
	expect(() => core.dispose()).toThrow(reason);
	expect(release).toHaveBeenCalledTimes(1);
	expect(stop).toHaveBeenCalledTimes(1);
	expect(() => core.dispose()).not.toThrow();
});

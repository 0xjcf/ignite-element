import { act, cleanup, renderHook } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assign, createActor, createMachine } from "xstate";
import { useIgnite } from "../../react";
import { requireBindingStore } from "../../runtime/bindings";
import { igniteCore } from "../../xstate";

afterEach(cleanup);
const machine = createMachine({
	context: { count: 0 },
	on: {
		ADD: { actions: assign({ count: ({ context }) => context.count + 1 }) },
	},
});
function makeCore() {
	return igniteCore({
		source: machine,
		states: (snapshot) => ({
			count: snapshot.context.count,
			nested: { count: snapshot.context.count },
			functionState: () => "state",
		}),
		commands: ({ actor }) => ({ add: () => actor.send({ type: "ADD" }) }),
	});
}
describe("prepared useIgnite binding", () => {
	it("catches an update between render and subscribe without acquiring in a read", () => {
		const core = makeCore();
		core.get("states");
		const store = requireBindingStore(core);
		const subscribe = store.subscribe.bind(store);
		const add = store.read().add;
		if (typeof add !== "function") throw Error("missing command");
		const prepare = vi.spyOn(core, "get");
		let race = true;
		vi.spyOn(store, "subscribe").mockImplementation((listener) => {
			if (race) {
				race = false;
				add();
			}
			return subscribe(listener);
		});
		const hook = renderHook(() => useIgnite(core));
		expect(hook.result.current.count).toBe(1);
		expect(prepare).not.toHaveBeenCalled();
		const cached = store.read();
		expect(store.read()).toBe(cached);
		hook.unmount();
		core.dispose();
	});
	it("rejects mutable class and accessor projections without freezing the source", () => {
		const date = new Date(0);
		const core = igniteCore({ source: machine, states: () => ({ date }) });
		expect(() => core.get("states")).toThrow(/plain records/);
		expect(Object.isFrozen(date)).toBe(false);
		core.dispose();
		const getter = vi.fn(() => 1);
		const value = Object.defineProperty({}, "value", {
			enumerable: true,
			get: getter,
		});
		const accessors = igniteCore({ source: machine, states: () => value });
		expect(() => accessors.get("states")).toThrow(/accessors/);
		expect(getter).not.toHaveBeenCalled();
		accessors.dispose();
	});
	it("fails unprepared without constructing a runtime", () => {
		const commands = vi.fn(() => ({}));
		const core = igniteCore({ source: machine, commands });
		expect(() => renderHook(() => useIgnite(core))).toThrow(/unprepared/i);
		expect(commands).not.toHaveBeenCalled();
		core.dispose();
	});
	it("borrows through StrictMode and multiple consumers without disposing the owner", () => {
		const core = makeCore();
		core.get("states");
		const dispose = vi.spyOn(core, "dispose");
		const first = renderHook(() => useIgnite(core), {
			wrapper: ({ children }) =>
				React.createElement(React.StrictMode, null, children),
		});
		const second = renderHook(() => useIgnite(core));
		const command = first.result.current.add;
		const old = first.result.current;
		act(() => command());
		expect(first.result.current.count).toBe(1);
		expect(second.result.current.count).toBe(1);
		expect(first.result.current.add).toBe(command);
		expect(old.nested.count).toBe(0);
		expect(first.result.current.functionState()).toBe("state");
		first.unmount();
		second.unmount();
		expect(dispose).not.toHaveBeenCalled();
		core.dispose();
		expect(() => command()).toThrow(/disposed/i);
	});
	it("keeps the owner cache current across a gap with no React subscriptions", () => {
		const core = makeCore();
		core.get("states");
		const hook = renderHook(() => useIgnite(core));
		const add = hook.result.current.add;
		hook.unmount();
		add();
		const later = renderHook(() => useIgnite(core));
		expect(later.result.current.count).toBe(1);
		later.unmount();
		core.dispose();
	});
	it("replaces cores without retargeting retained old commands", () => {
		const oldCore = makeCore(),
			nextCore = makeCore();
		oldCore.get("states");
		nextCore.get("states");
		const hook = renderHook(({ core }) => useIgnite(core), {
			initialProps: { core: oldCore },
		});
		const oldCommand = hook.result.current.add;
		hook.rerender({ core: nextCore });
		act(() => oldCommand());
		expect(oldCore.get("states").count).toBe(1);
		expect(hook.result.current.count).toBe(0);
		oldCore.dispose();
		expect(() => oldCommand()).toThrow(/disposed/i);
		hook.unmount();
		nextCore.dispose();
	});
	it("detaches nested mutable plain data without freezing the caller", () => {
		const source = { nested: { value: 1 } };
		const actor = createActor(machine).start();
		const core = igniteCore({ source: actor, states: () => source });
		core.get("states");
		const store = requireBindingStore(core);
		const old = store.read();
		source.nested.value = 2;
		actor.send({ type: "ADD" });
		expect(old).toEqual({ nested: { value: 1 } });
		expect(store.read()).toEqual({ nested: { value: 2 } });
		expect(Object.isFrozen(source.nested)).toBe(false);
		core.dispose();
		actor.stop();
	});
	it("keeps direct return, throw, receiver, arity and promise identity", async () => {
		const promise = Promise.resolve(7);
		const reason = {};
		const core = igniteCore({
			source: machine,
			commands: () => ({
				setLabel(value: string) {
					return [this, value, arguments.length];
				},
				asyncValue: () => promise,
				fail: () => {
					throw reason;
				},
				multiple: (...values: number[]) => values,
			}),
		});
		core.get("states");
		const commands = requireBindingStore(core).read();
		const setLabel = commands.setLabel;
		if (
			typeof setLabel !== "function" ||
			typeof commands.asyncValue !== "function" ||
			typeof commands.fail !== "function" ||
			typeof commands.multiple !== "function"
		)
			throw Error("missing commands");
		const receiver = {};
		expect(setLabel.length).toBe(1);
		expect(setLabel.call(receiver, "x")).toEqual([receiver, "x", 1]);
		expect(commands.asyncValue()).toBe(promise);
		expect(commands.multiple(1, 2, 3)).toEqual([1, 2, 3]);
		try {
			commands.fail();
			throw Error("missing throw");
		} catch (error) {
			expect(error).toBe(reason);
		}
		core.dispose();
		expect(await promise).toBe(7);
	});
});

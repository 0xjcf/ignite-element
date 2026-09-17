import { act, cleanup, render, renderHook } from "@testing-library/react";
import * as React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { assign, createActor, createMachine } from "xstate";
import { useIgnite } from "../react";
import { requireBindingStore } from "../runtime/bindings";
import { igniteCore } from "../xstate";

afterEach(() => {
	cleanup();
	document.body.replaceChildren();
});
const machine = createMachine({
	context: { count: 0 },
	on: {
		INC: { actions: assign({ count: ({ context }) => context.count + 1 }) },
	},
});
function session() {
	const actor = createActor(machine).start();
	const subscribe = vi.spyOn(actor, "subscribe");
	const stop = vi.spyOn(actor, "stop");
	const core = igniteCore({
		source: actor,
		states: (snapshot) => ({ count: snapshot.context.count }),
		commands: ({ source: actor }) => ({
			increment: () => actor.send({ type: "INC" }),
		}),
	});
	return { core, actor, subscribe, stop };
}
it("prepares an existing source at construction, not during two React borrowers", () => {
	const s = session();
	try {
		const subscriptions = s.subscribe.mock.calls.length;
		expect(subscriptions).toBeGreaterThan(0);
		const first = renderHook(() => useIgnite(s.core), {
			wrapper: ({ children }) =>
				React.createElement(React.StrictMode, null, children),
		});
		const second = renderHook(() => useIgnite(s.core));
		const increment = first.result.current.increment;
		act(() => increment());
		expect(first.result.current.count).toBe(1);
		expect(second.result.current.count).toBe(1);
		expect(second.result.current.increment).toBe(increment);
		expect(s.subscribe).toHaveBeenCalledTimes(subscriptions);
		first.unmount();
		second.unmount();
		s.core.dispose();
		expect(s.stop).not.toHaveBeenCalled();
		expect(() => increment()).toThrow(/disposed/);
	} finally {
		s.core.dispose();
		s.actor.stop();
	}
});
it("keeps isolated machine construction lazy and explicit preparation compatible", () => {
	const commands = vi.fn(() => ({ increment() {} }));
	const core = igniteCore({ source: machine, commands });
	expect(commands).not.toHaveBeenCalled();
	expect(() => requireBindingStore(core).read()).toThrow(/unprepared/);
	core.get("states");
	expect(commands).toHaveBeenCalledOnce();
	core.dispose();
});

it("abandoned shared rendering installs no source observation or effect surface", async () => {
	const actor = createActor(machine).start();
	const subscribe = vi.spyOn(actor, "subscribe");
	const effects = vi.fn();
	const core = igniteCore({
		source: actor,
		states: (snapshot) => ({ count: snapshot.context.count }),
		effects,
	});
	const subscriptions = subscribe.mock.calls.length;
	const pending = new Promise<void>(() => {});
	function Abandoned(): never {
		useIgnite(core);
		throw pending;
	}
	try {
		const view = render(
			React.createElement(
				React.Suspense,
				{ fallback: "waiting" },
				React.createElement(Abandoned),
			),
		);
		act(() => actor.send({ type: "INC" }));
		await act(async () => {
			await Promise.resolve();
		});
		expect(view.container.textContent).toBe("waiting");
		expect(subscribe).toHaveBeenCalledTimes(subscriptions);
		expect(effects).not.toHaveBeenCalled();
		view.unmount();
	} finally {
		core.dispose();
		actor.stop();
	}
});

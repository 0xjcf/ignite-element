import { act } from "@testing-library/react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { createActor, emit, setup } from "xstate";
import { igniteCore as actorCore } from "../actor-web";
import { igniteCore as hostCore } from "../actor-web/web";
import { igniteReact } from "../react/web";
import { igniteCore as xstateCore } from "../xstate";

type Reset = { type: "reset"; count: number };

it("infers a real Actor-Web channel shared with command types and releases it", async () => {
	const listeners = new Set<(event: Reset) => void>();
	const snapshot = () => ({
		address: "contract",
		context: { count: 0 },
		phase: "ready",
		toJSON: () => ({}),
	});
	const source = {
		address: "contract",
		snapshot,
		subscribe:
			(_listener: (value: ReturnType<typeof snapshot>) => void) => () => {},
		subscribeEvent: (listener: (event: Reset) => void) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		send: async (event: Reset) => {
			for (const listener of listeners) listener(event);
		},
	};
	const core = actorCore({
		source,
		commands: ({ source: actor }) => ({
			reset: () => actor.send({ type: "reset", count: 0 }),
		}),
	});
	const received: Reset[] = [];
	try {
		core.on("reset", (event) => received.push(event));
		const result = await core.execute({ command: "reset" });
		expect(received).toEqual([{ type: "reset", count: 0 }]);
		expect(result.events).toEqual([{ type: "reset", count: 0 }]);
	} finally {
		core.dispose();
	}
	expect(listeners.size).toBe(0);
	const hostOnly = hostCore({
		source: (_context: { host?: HTMLElement }) => source,
	});
	try {
		expect(() => hostOnly.on("reset", () => {})).toThrow("require an element");
	} finally {
		hostOnly.dispose();
	}
});

it("keeps native headless access distinct from declared React DOM events", async () => {
	const machine = setup({
		types: { events: {} as Reset, emitted: {} as Reset },
	}).createMachine({
		on: { reset: { actions: emit(({ event }) => event) } },
	});
	const source = createActor(machine).start();
	const undeclared = xstateCore({ source });
	const declared = xstateCore({
		source,
		events: (e) => ({ reset: e<{ count: number }>() }),
	});
	const privateHandle = undeclared("contract-hidden-event", () => null);
	const publicHandle = declared("contract-public-event", () => null);
	const Private = igniteReact(privateHandle),
		Public = igniteReact(publicHandle);
	let hidden = 0,
		visible = 0,
		headless = 0;
	undeclared.on("reset", () => {
		headless++;
	});
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	try {
		expect(privateHandle.get("schema").events).toEqual([]);
		expect(publicHandle.get("schema").events.map((e) => e.type)).toEqual([
			"reset",
		]);
		await act(async () =>
			root.render(
				createElement(
					"div",
					null,
					createElement(Private, {
						// @ts-expect-error Runtime adversarial control: undeclared props are not a public callback.
						onReset: () => {
							hidden++;
						},
					}),
					createElement(Public, {
						onReset: (detail) => {
							expect(detail.count).toBe(0);
							visible++;
						},
					}),
				),
			),
		);
		await act(async () => source.send({ type: "reset", count: 0 }));
		expect({ hidden, visible, headless }).toEqual({
			hidden: 0,
			visible: 1,
			headless: 1,
		});
	} finally {
		await act(async () => root.unmount());
		undeclared.dispose();
		declared.dispose();
		source.stop();
		container.remove();
	}
});

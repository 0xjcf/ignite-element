import { act } from "@testing-library/react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assign, createActor, emit, setup } from "xstate";
import { igniteReact } from "../react/web";
import { igniteCore } from "../xstate";

const counter = setup({
	types: {
		context: {} as { count: number },
		events: {} as
			| { type: "INCREMENT" }
			| { type: "RESET" }
			| { type: "PRIVATE" },
		emitted: {} as
			| { type: "counterReset"; count: number }
			| { type: "private" },
	},
}).createMachine({
	context: { count: 0 },
	on: {
		INCREMENT: {
			actions: assign({ count: ({ context }) => context.count + 1 }),
		},
		RESET: {
			actions: [
				assign({ count: 0 }),
				emit(({ context }) => ({ type: "counterReset", count: context.count })),
			],
		},
		PRIVATE: { actions: emit({ type: "private" }) },
	},
});
let sequence = 0;
const releases: (() => void)[] = [];
afterEach(() => {
	for (const release of releases.splice(0)) release();
	document.body.replaceChildren();
	vi.restoreAllMocks();
});
function fixture() {
	const actor = createActor(counter).start();
	const core = igniteCore({
		source: actor,
		states: (s) => ({ count: s.context.count }),
		commands: ({ source: actor }) => ({
			increment: () => actor.send({ type: "INCREMENT" }),
			reset: () => actor.send({ type: "RESET" }),
		}),
		events: (e) => ({
			countChanged: e<{ count: number }>(),
			counterReset: e<{ count: number }>(),
		}),
		effects: ({ select, emit }) => {
			const count = select((s) => s.context.count);
			if (count.changed) emit({ type: "countChanged", count: count.current });
		},
	});
	const tag = `native-counter-${sequence++}`;
	core(tag, ({ count }) => String(count));
	releases.push(() => {
		try {
			core.dispose();
		} finally {
			actor.stop();
		}
	});
	return { actor, core, element: () => document.createElement(tag) };
}
const flush = async () => {
	await Promise.resolve();
	await Promise.resolve();
};
describe("native element event forwarding", () => {
	it("delivers inferred React wrapper callback payloads for both producers", async () => {
		const { actor, core } = fixture();
		const handle = core(`native-react-${sequence++}`, (ctx) =>
			String(ctx.count),
		);
		const Counter = igniteReact(handle);
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container),
			changed = vi.fn(),
			reset = vi.fn();
		releases.unshift(() => act(() => root.unmount()));
		await act(async () =>
			root.render(
				createElement(Counter, {
					onCountChanged: (detail) => {
						const count: number = detail.count;
						changed(count);
					},
					onCounterReset: (detail) => reset(detail),
				}),
			),
		);
		await act(async () => actor.send({ type: "INCREMENT" }));
		await act(async () => actor.send({ type: "RESET" }));
		await act(async () => actor.send({ type: "RESET" }));
		expect(changed.mock.calls).toEqual([[1], [0]]);
		expect(reset.mock.calls).toEqual([[{ count: 0 }], [{ count: 0 }]]);
	});
	it("keeps repeated reset occurrences, payloads and recipient counts without echo", async () => {
		const { core, actor, element } = fixture();
		const a = element(),
			b = element();
		const dom: CustomEvent[] = [],
			head: unknown[] = [],
			changed: unknown[] = [];
		document.body.addEventListener(
			"counterReset",
			(e) => dom.push(e as CustomEvent),
			{
				signal: (() => {
					const c = new AbortController();
					releases.push(() => c.abort());
					return c.signal;
				})(),
			},
		);
		core.on("counterReset", (e) => head.push(e));
		core.on("countChanged", (e) => changed.push(e));
		document.body.append(a, b);
		expect(dom).toHaveLength(0);
		await core.execute({ command: "increment" });
		expect(changed).toHaveLength(1);
		const first = await core.execute({ command: "reset" });
		expect(first.events.map((e) => e.type).sort()).toEqual([
			"countChanged",
			"counterReset",
		]);
		const second = await core.execute({ command: "reset" });
		expect(second.events.map((e) => e.type)).toEqual(["counterReset"]);
		expect(head).toHaveLength(2);
		expect(changed).toHaveLength(2);
		expect(dom).toHaveLength(4);
		for (const e of dom) {
			expect(e.detail).toEqual({ count: 0 });
			expect(e.bubbles && e.composed).toBe(true);
		}
		const hidden = vi.fn(),
			native = vi.fn();
		a.addEventListener("private", hidden);
		core.on("private", native);
		actor.send({ type: "PRIVATE" });
		expect(hidden).not.toHaveBeenCalled();
		expect(native).toHaveBeenCalledTimes(1);
	});
	it("owns forwarding through moves, true disconnect, reconnect and final disposal", async () => {
		const { actor, core, element } = fixture();
		const a = element(),
			event = vi.fn();
		a.addEventListener("counterReset", event);
		actor.send({ type: "RESET" });
		document.body.append(a);
		expect(event).not.toHaveBeenCalled();
		actor.send({ type: "RESET" });
		expect(event).toHaveBeenCalledTimes(1);
		a.remove();
		document.body.append(a);
		actor.send({ type: "RESET" });
		expect(event).toHaveBeenCalledTimes(2);
		a.remove();
		await flush();
		actor.send({ type: "RESET" });
		expect(event).toHaveBeenCalledTimes(2);
		document.body.append(a);
		expect(event).toHaveBeenCalledTimes(2);
		actor.send({ type: "RESET" });
		expect(event).toHaveBeenCalledTimes(3);
		core.dispose();
		actor.send({ type: "RESET" });
		expect(event).toHaveBeenCalledTimes(3);
		expect(actor.getSnapshot().status).toBe("active");
	});
	it("does not create headless effects merely to forward native events", async () => {
		const { actor, element } = fixture();
		const a = element(),
			changed = vi.fn(),
			reset = vi.fn();
		a.addEventListener("countChanged", changed);
		a.addEventListener("counterReset", reset);
		document.body.append(a);
		actor.send({ type: "INCREMENT" });
		await flush();
		actor.send({ type: "RESET" });
		await flush();
		expect(changed).toHaveBeenCalledTimes(2);
		expect(reset).toHaveBeenCalledTimes(1);
	});
});

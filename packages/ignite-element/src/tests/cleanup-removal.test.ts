import { configureStore, createSlice } from "@reduxjs/toolkit";
import { makeAutoObservable } from "mobx";
import { expect, it, vi } from "vitest";
import { assign, createActor, createMachine } from "xstate";
import { igniteCore as actorWebCore } from "../actor-web";
import { igniteCore as webCore } from "../actor-web/web";
import { jsx } from "../jsx/jsx-runtime";
import { igniteCore as mobxCore } from "../mobx";
import { igniteCore as reduxCore } from "../redux";
import { igniteCore as xstateCore } from "../xstate";

const machine = createMachine({
	context: { count: 0 },
	on: {
		INC: { actions: assign({ count: ({ context }) => context.count + 1 }) },
	},
});
const slice = createSlice({
	name: "counter",
	initialState: { count: 0 },
	reducers: {
		increment(state) {
			state.count++;
		},
	},
});
function actorWebSource() {
	let count = 0;
	const snapshot = () => ({
		address: "counter",
		context: { count },
		phase: "active",
		toJSON: () => ({ count }),
	});
	const listeners = new Set<(value: ReturnType<typeof snapshot>) => void>();
	return {
		address: "counter",
		snapshot,
		transportStatus: () => ({ state: "disconnected" as const, updatedAt: 0 }),
		subscribe: (listener: (value: ReturnType<typeof snapshot>) => void) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		send: async () => {},
		close: vi.fn(),
		increment() {
			count++;
			for (const listener of listeners) listener(snapshot());
		},
	};
}
it.each([false, true, undefined])(
	"rejects explicit cleanup=%s before acquiring any source",
	(cleanup) => {
		const factory = vi.fn(() => makeAutoObservable({ count: 0 }));
		const store = configureStore({ reducer: slice.reducer });
		const reduxFactory = vi.fn(() => store);
		const observable = makeAutoObservable({ count: 0 });
		const actor = createActor(machine).start(),
			start = vi.spyOn(actor, "start"),
			external = actorWebSource(),
			options = { cleanup };
		const actorWebFactory = vi.fn(() => external);
		const cases = [
			() => xstateCore({ source: actor, ...options }),
			() => xstateCore({ source: machine, ...options }),
			() => reduxCore({ source: slice, ...options }),
			() => reduxCore({ source: store, ...options }),
			() => reduxCore({ source: reduxFactory, ...options }),
			() => mobxCore({ source: observable, ...options }),
			() => mobxCore({ source: factory, ...options }),
			() => actorWebCore({ source: external, ...options }),
			() => actorWebCore({ source: actorWebFactory, ...options }),
			() => webCore({ source: actorWebFactory, ...options }),
		];
		try {
			for (const create of cases) expect(create).toThrow(/cleanup.*removed/i);
			expect(factory).not.toHaveBeenCalled();
			expect(reduxFactory).not.toHaveBeenCalled();
			expect(actorWebFactory).not.toHaveBeenCalled();
			expect(start).not.toHaveBeenCalled();
			expect(external.close).not.toHaveBeenCalled();
		} finally {
			actor.stop();
		}
	},
);
let sequence = 0;
for (const kind of ["xstate", "redux", "mobx", "actor-web"]) {
	for (const withEffects of [false, true]) {
		it(`${kind} retains shared observation and ownership through moves and reconnect (effects=${withEffects})`, async () => {
			const xstate = createActor(machine).start(),
				stop = vi.spyOn(xstate, "stop"),
				redux = configureStore({ reducer: slice.reducer }),
				mobx = makeAutoObservable({
					count: 0,
					increment() {
						this.count++;
					},
				}),
				actorWeb = actorWebSource();
			const evaluated = vi.fn(),
				received = vi.fn();
			const makeCore = () =>
				kind === "xstate"
					? xstateCore({
							source: xstate,
							states: (s) => ({ count: s.context.count }),
							commands: ({ source }) => ({
								increment: () => source.send({ type: "INC" }),
							}),
							events: (e) => ({ changed: e<{ count: number }>() }),
							effects: withEffects
								? ({ select, emit }) => {
										const count = select((s) => s.context.count);
										evaluated(count.current);
										if (count.changed)
											emit({ type: "changed", count: count.current });
									}
								: undefined,
						})
					: kind === "redux"
						? reduxCore({
								source: redux,
								states: (s) => ({ count: s.count }),
								commands: ({ source: store }) => ({
									increment: () => store.dispatch(slice.actions.increment()),
								}),
								events: (e) => ({ changed: e<{ count: number }>() }),
								effects: withEffects
									? ({ select, emit }) => {
											const count = select((s) => s.count);
											evaluated(count.current);
											if (count.changed)
												emit({ type: "changed", count: count.current });
										}
									: undefined,
							})
						: kind === "mobx"
							? mobxCore({
									source: mobx,
									states: (s) => ({ count: s.count }),
									commands: ({ source: store }) => ({
										increment: () => store.increment(),
									}),
									events: (e) => ({ changed: e<{ count: number }>() }),
									effects: withEffects
										? ({ select, emit }) => {
												const count = select((s) => s.count);
												evaluated(count.current);
												if (count.changed)
													emit({ type: "changed", count: count.current });
											}
										: undefined,
								})
							: actorWebCore({
									source: actorWeb,
									states: (s) => ({ count: s.context.count }),
									commands: () => ({ increment: () => actorWeb.increment() }),
									events: (e) => ({ changed: e<{ count: number }>() }),
									effects: withEffects
										? ({ select, emit }) => {
												const count = select((s) => s.context.count);
												evaluated(count.current);
												if (count.changed)
													emit({ type: "changed", count: count.current });
											}
										: undefined,
								});
			const core = makeCore(),
				other = makeCore();
			const tag = `shared-retention-${sequence++}`;
			core(tag, (ctx) =>
				jsx("button", { children: ctx.count, onClick: () => ctx.increment() }),
			);
			const first = document.createElement(tag),
				second = document.createElement(tag),
				parent = document.createElement("section");
			first.addEventListener("changed", received);
			try {
				document.body.append(first, second, parent);
				first.shadowRoot?.querySelector("button")?.click();
				expect(second.shadowRoot?.textContent).toBe("1");
				parent.append(first);
				await Promise.resolve();
				expect(first.shadowRoot?.textContent).toBe("1");
				first.remove();
				second.remove();
				await Promise.resolve();
				await core.execute({ command: "increment" });
				expect(core.get("states").count).toBe(2);
				document.body.append(first);
				first.shadowRoot?.querySelector("button")?.click();
				expect(first.shadowRoot?.textContent).toBe("3");
				await Promise.resolve();
				expect(evaluated.mock.calls).toEqual(
					withEffects ? [[1], [2], [3]] : [],
				);
				expect(received).toHaveBeenCalledTimes(withEffects ? 2 : 0);
				const otherDelivery = vi.fn();
				other.watch(otherDelivery);
				const late = core.watch(() => {
					throw Error("late delivery");
				});
				core.dispose();
				core.dispose();
				expect(stop).not.toHaveBeenCalled();
				expect(actorWeb.close).not.toHaveBeenCalled();
				late.unsubscribe();
				await other.execute({ command: "increment" });
				expect(otherDelivery).toHaveBeenCalledOnce();
				expect(other.get("states").count).toBe(4);
				expect(received).toHaveBeenCalledTimes(withEffects ? 2 : 0);
			} finally {
				first.remove();
				second.remove();
				parent.remove();
				core.dispose();
				other.dispose();
				xstate.stop();
			}
		});
	}
}

it("rejects inherited or accessor cleanup keys without reading the value or source", () => {
	const source = vi.fn(() => makeAutoObservable({ count: 0 }));
	const read = vi.fn(() => false);
	const accessor = { source };
	Object.defineProperty(accessor, "cleanup", { get: read });
	const inherited = Object.assign(Object.create({ cleanup: undefined }), {
		source,
	});
	expect(() => mobxCore(accessor)).toThrow(/cleanup.*removed/);
	expect(() => mobxCore(inherited)).toThrow(/cleanup.*removed/);
	expect(source).not.toHaveBeenCalled();
	expect(read).not.toHaveBeenCalled();
});

/** @jsxImportSource react */
import {
	configureStore,
	createSlice,
	type Middleware,
	type StoreEnhancer,
} from "@reduxjs/toolkit";
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { igniteCore as mobxCore } from "ignite-element/mobx";
import { useIgnite } from "ignite-element/react";
import { igniteCore as reduxCore } from "ignite-element/redux";
import { igniteCore as xstateCore } from "ignite-element/xstate";
import { makeAutoObservable, onBecomeObserved, onBecomeUnobserved } from "mobx";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assign, createMachine, emit, fromCallback, setup } from "xstate";
import { jsx } from "../../jsx/jsx-runtime";
import { acquireBindingStore } from "../../runtime/bindings";

const slice = createSlice({
	name: "counter",
	initialState: { count: 0 },
	reducers: {
		add: (state) => {
			state.count++;
		},
	},
});
function fixture(kind: "xstate" | "redux" | "slice" | "mobx") {
	const counts = {
		constructed: 0,
		active: 0,
		released: 0,
		middleware: 0,
		enhancer: 0,
		dispatched: 0,
	};
	const effects = vi.fn();
	const sources: Array<{ add: () => void }> = [];
	if (kind === "xstate") {
		const machine = createMachine({
			types: {} as { context: { count: number }; events: { type: "ADD" } },
			context: () => {
				counts.constructed++;
				return { count: 0 };
			},
			invoke: {
				src: fromCallback(() => {
					counts.active++;
					return () => {
						counts.active--;
						counts.released++;
					};
				}),
			},
			on: {
				ADD: { actions: assign({ count: ({ context }) => context.count + 1 }) },
			},
		});
		return {
			counts,
			effects,
			sources,
			core: xstateCore({
				source: machine,
				states: (s) => ({ count: s.context.count }),
				commands: ({ source }) => ({ add: () => source.send({ type: "ADD" }) }),
				effects,
			}),
		};
	}
	if (kind === "redux" || kind === "slice") {
		const middleware: Middleware = () => {
			counts.middleware++;
			return (next) => (action) => {
				counts.dispatched++;
				return next(action);
			};
		};
		const enhancer: StoreEnhancer =
			(next) =>
			(...args) => {
				counts.enhancer++;
				return next(...args);
			};
		const factory = () => {
			counts.constructed++;
			const store = configureStore({
				reducer: slice.reducer,
				middleware: (g) => g().concat(middleware),
				enhancers: (g) => g().concat(enhancer),
			});
			const subscribe = store.subscribe;
			store.subscribe = (listener) => {
				counts.active++;
				const off = subscribe(listener);
				return () => {
					counts.active--;
					counts.released++;
					off();
				};
			};
			sources.push({ add: () => store.dispatch(slice.actions.add()) });
			return store;
		};
		const core =
			kind === "slice"
				? reduxCore({
						source: slice,
						states: (s) => ({ count: s.count }),
						commands: ({ source: store }) => ({
							add: () => store.dispatch(slice.actions.add()),
						}),
						effects,
					})
				: reduxCore({
						source: factory,
						states: (s) => ({ count: s.count }),
						commands: ({ source: store }) => ({
							add: () => store.dispatch(slice.actions.add()),
						}),
						effects,
					});
		return { counts, effects, sources, core };
	}
	const factory = () => {
		counts.constructed++;
		const store = makeAutoObservable({
			count: 0,
			add() {
				this.count++;
			},
		});
		onBecomeObserved(store, "count", () => {
			counts.active++;
		});
		onBecomeUnobserved(store, "count", () => {
			counts.active--;
			counts.released++;
		});
		sources.push({ add: () => store.add() });
		return store;
	};
	return {
		counts,
		effects,
		sources,
		core: mobxCore({
			source: factory,
			states: (s) => ({ count: s.count }),
			commands: ({ source }) => ({ add: () => source.add() }),
			effects,
		}),
	};
}
afterEach(cleanup);
for (const kind of ["xstate", "redux", "slice", "mobx"] as const) {
	describe(`independent ${kind} hook lifecycle`, () => {
		it("keeps a stable inert snapshot and reclaims synchronous subscription replay", async () => {
			const { core, counts } = fixture(kind);
			const binding = acquireBindingStore(core);
			const initial = binding.read();
			expect(binding.read()).toBe(initial);
			expect(counts.active).toBe(0);
			const add = initial.add;
			if (typeof add !== "function") throw Error("missing command");
			expect(() => add()).toThrow(/not committed/);
			const notify = vi.fn();
			const detach = binding.attach?.();
			const first = binding.subscribe(notify);
			const constructed = counts.constructed;
			add();
			expect(binding.read().count).toBe(1);
			const changed = binding.read();
			expect(binding.read()).toBe(changed);
			first();
			// Observation disconnection alone does not end component retention.
			const replay = binding.subscribe(notify);
			await Promise.resolve();
			expect(binding.read()).toBe(changed);
			expect(counts.constructed).toBe(constructed);
			add();
			expect(binding.read().count).toBe(2);
			replay();
			replay();
			detach?.();
			expect(() => add()).toThrow(/unmounted/);
			await Promise.resolve();
			expect(counts.active).toBe(0);
			expect(() => binding.read()).toThrow(/disposed/);
			expect(core.get("states").count).toBe(0);
			core.dispose();
		});
		it("isolates two hooks, keeps commands stable, and releases only the real unmount", async () => {
			const { core, counts, effects } = fixture(kind);
			const first = renderHook(() => useIgnite(core), {
				wrapper: ({ children }) =>
					React.createElement(React.StrictMode, null, children),
			});
			const second = renderHook(() => useIgnite(core));
			expect(first.result.current.count).toBe(0);
			const command = first.result.current.add;
			const old = first.result.current;
			await act(async () => {
				command();
			});
			expect(first.result.current.count).toBe(1);
			expect(second.result.current.count).toBe(0);
			expect(old.count).toBe(0);
			expect(first.result.current.add).toBe(command);
			expect(effects).toHaveBeenCalledTimes(1);
			if (kind !== "slice")
				expect(counts.active).toBe(kind === "redux" ? 4 : 2);
			await act(async () => {
				first.unmount();
			});
			expect(() => command()).toThrow(/disposed|unmounted/i);
			if (kind !== "slice")
				expect(counts.active).toBe(kind === "redux" ? 2 : 1);
			const fresh = renderHook(() => useIgnite(core));
			expect(fresh.result.current.count).toBe(0);
			await act(async () => {
				second.result.current.add();
			});
			expect(second.result.current.count).toBe(1);
			expect(fresh.result.current.count).toBe(0);
			await act(async () => {
				second.unmount();
				fresh.unmount();
			});
			expect(counts.active).toBe(0);
			core.dispose();
			core.dispose();
		});
		it("constructs synchronously but starts no resources or effects in abandoned renders", async () => {
			const { core, counts, effects } = fixture(kind);
			const seen: number[] = [];
			const never = new Promise<void>(() => {});
			function Suspended(): React.ReactNode {
				const ctx = useIgnite(core);
				seen.push(ctx.count);
				throw never;
			}
			const root = render(
				React.createElement(
					React.StrictMode,
					null,
					React.createElement(
						React.Suspense,
						{ fallback: "pending" },
						React.createElement(Suspended),
					),
				),
			);
			expect(seen.length).toBeGreaterThan(0);
			expect(seen.every((value) => value === 0)).toBe(true);
			if (kind !== "slice") expect(counts.constructed).toBeGreaterThan(0);
			expect(counts.active).toBe(0);
			expect(counts.released).toBe(0);
			expect(effects).not.toHaveBeenCalled();
			if (kind === "redux") {
				expect(counts.middleware).toBe(counts.constructed);
				expect(counts.enhancer).toBe(counts.constructed);
				expect(counts.dispatched).toBe(0);
			}
			await act(async () => {
				root.unmount();
			});
			core.dispose();
			expect(counts.released).toBe(0);
		});
		it("releases a replaced core's private binding without retargeting old commands", async () => {
			const first = fixture(kind),
				next = fixture(kind);
			const hook = renderHook(({ core }) => useIgnite(core), {
				initialProps: { core: first.core },
			});
			const old = hook.result.current.add;
			await act(async () => {
				old();
			});
			await act(async () => {
				hook.rerender({ core: next.core });
			});
			expect(hook.result.current.count).toBe(0);
			expect(() => old()).toThrow(/disposed|unmounted/i);
			expect(first.counts.active).toBe(0);
			expect(first.core.get("states").count).toBe(0);
			await act(async () => {
				hook.unmount();
			});
			first.core.dispose();
			next.core.dispose();
		});
		it("keeps an element and hook independent while discarding queued effects on unmount", async () => {
			const { core, effects } = fixture(kind);
			const name = `private-coexist-${kind}`;
			core(name, (ctx) => jsx("output", { children: String(ctx.count) }));
			const element = document.createElement(name);
			document.body.append(element);
			const hook = renderHook(() => useIgnite(core));
			await act(async () => hook.result.current.add());
			expect(element.shadowRoot?.querySelector("output")?.textContent).toBe(
				"0",
			);
			const before = effects.mock.calls.length;
			act(() => {
				hook.result.current.add();
				hook.unmount();
			});
			await Promise.resolve();
			expect(effects).toHaveBeenCalledTimes(before);
			element.remove();
			await Promise.resolve();
			core.dispose();
		});
		it("keeps the explicit headless runtime separate and drains all committed runtimes on disposal", async () => {
			const { core, counts, sources, effects } = fixture(kind);
			const first = renderHook(() => useIgnite(core));
			const second = renderHook(() => useIgnite(core));
			await act(async () => {
				first.result.current.add();
			});
			expect(core.get("states").count).toBe(0);
			await core.execute({ command: "add" });
			expect(core.get("states").count).toBe(1);
			expect(second.result.current.count).toBe(0);
			if (kind !== "slice")
				expect(counts.active).toBe(kind === "redux" ? 6 : 3);
			const old = first.result.current.add;
			core.dispose();
			core.dispose();
			expect(counts.active).toBe(0);
			expect(() => old()).toThrow(/disposed/i);
			expect(() => renderHook(() => useIgnite(core))).toThrow(/disposed/i);
			await act(async () => {
				first.unmount();
				second.unmount();
			});
			const delivered = effects.mock.calls.length;
			await act(async () => {
				for (const source of sources) source.add();
			});
			expect(effects).toHaveBeenCalledTimes(delivered);
		});
	});
}

it("catches a Redux update between render and committed subscription without losing enhanced dispatch", async () => {
	const { core, sources, counts } = fixture("redux");
	const hook = renderHook(() => {
		const ctx = useIgnite(core);
		React.useLayoutEffect(() => {
			sources[sources.length - 1]?.add();
		}, []);
		return ctx;
	});
	expect(hook.result.current.count).toBe(1);
	expect(counts.dispatched).toBe(1);
	await act(async () => hook.result.current.add());
	expect(counts.dispatched).toBe(2);
	expect(hook.result.current.count).toBe(2);
	await act(async () => hook.unmount());
	expect(counts.active).toBe(0);
	core.dispose();
});

it("attempts every private unsubscribe and headless release after one cleanup throws", async () => {
	const releases: number[] = [];
	const failure = Error("unsubscribe failed");
	let sequence = 0;
	const core = reduxCore({
		source: () => {
			const id = sequence++;
			const store = configureStore({ reducer: slice.reducer });
			const subscribe = store.subscribe;
			store.subscribe = (listener) => {
				const off = subscribe(listener);
				return () => {
					off();
					releases.push(id);
					if (id === 0) throw failure;
				};
			};
			return store;
		},
		states: (s) => ({ count: s.count }),
		commands: ({ source: store }) => ({
			add: () => store.dispatch(slice.actions.add()),
		}),
	});
	const first = renderHook(() => useIgnite(core));
	const second = renderHook(() => useIgnite(core));
	core.get("states");
	expect(() => core.dispose()).toThrow(failure);
	expect(releases.sort()).toEqual([0, 1, 2]);
	core.dispose();
	expect(() => second.result.current.add()).toThrow(/disposed/);
	await act(async () => {
		first.unmount();
		second.unmount();
	});
	expect(releases).toHaveLength(3);
});

it("rolls back a failed private activation and leaves the reusable core available", async () => {
	let active = 0;
	let attempt = 0;
	const failure = Error("first subscription fails");
	const core = reduxCore({
		source: () => {
			const id = attempt++;
			const store = configureStore({ reducer: slice.reducer });
			const subscribe = store.subscribe;
			store.subscribe = (listener) => {
				if (id === 0) throw failure;
				active++;
				const off = subscribe(listener);
				return () => {
					active--;
					off();
				};
			};
			return store;
		},
		states: (s) => ({ count: s.count }),
	});
	// React drains both layout and passive effects. The layout failure is kept
	// as the first cause; the passive subscription then observes terminal state.
	let caught: unknown;
	try {
		renderHook(() => useIgnite(core));
	} catch (error) {
		caught = error;
	}
	expect(caught).toMatchObject({
		name: "AggregateError",
		errors: [
			failure,
			expect.objectContaining({ message: expect.stringMatching(/disposed/) }),
		],
	});
	if (
		!(caught instanceof Error) ||
		!("errors" in caught) ||
		!Array.isArray(caught.errors)
	)
		throw Error("missing React error causes");
	expect(caught.errors[0]).toBe(failure);
	expect(active).toBe(0);
	const next = renderHook(() => useIgnite(core));
	expect(next.result.current.count).toBe(0);
	expect(active).toBe(1);
	await act(async () => next.unmount());
	expect(active).toBe(0);
	core.dispose();
});

for (const kind of ["redux", "mobx"] as const) {
	it(`existing ${kind} sources remain shared across hooks, cores and zero-consumer gaps`, async () => {
		const store = configureStore({ reducer: slice.reducer });
		const observable = makeAutoObservable({
			count: 0,
			add() {
				this.count++;
			},
		});
		const make = () =>
			kind === "redux"
				? reduxCore({
						source: store,
						states: (s) => ({ count: s.count }),
						commands: ({ source }) => ({
							add: () => source.dispatch(slice.actions.add()),
						}),
					})
				: mobxCore({
						source: observable,
						states: (s) => ({ count: s.count }),
						commands: ({ source }) => ({ add: () => source.add() }),
					});
		const core = make(),
			otherCore = make();
		const first = renderHook(() => useIgnite(core), {
			wrapper: ({ children }) =>
				React.createElement(React.StrictMode, null, children),
		});
		const second = renderHook(() => useIgnite(core));
		const other = renderHook(() => useIgnite(otherCore));
		const add = first.result.current.add;
		await act(async () => add());
		expect(second.result.current.count).toBe(1);
		expect(other.result.current.count).toBe(1);
		expect(second.result.current.add).toBe(add);
		await act(async () => {
			first.unmount();
			second.unmount();
			other.unmount();
		});
		add();
		const fresh = renderHook(() => useIgnite(core));
		expect(fresh.result.current.count).toBe(2);
		await act(async () => fresh.unmount());
		core.dispose();
		expect(() => add()).toThrow(/disposed/);
		await otherCore.execute({ command: "add" });
		expect(otherCore.get("states").count).toBe(3);
		otherCore.dispose();
		if (kind === "redux") {
			store.dispatch(slice.actions.add());
			expect(store.getState().count).toBe(4);
		} else {
			observable.add();
			expect(observable.count).toBe(4);
		}
	});
}

it("keeps private native and effect events out of the explicit headless event stream", async () => {
	const machine = setup({
		types: {
			context: {} as { count: number },
			events: {} as { type: "ADD" },
			emitted: {} as { type: "native"; count: number },
		},
	}).createMachine({
		context: { count: 0 },
		on: {
			ADD: {
				actions: [
					assign({ count: ({ context }) => context.count + 1 }),
					emit(({ context }) => ({ type: "native", count: context.count })),
				],
			},
		},
	});
	const evaluated = vi.fn();
	const core = xstateCore({
		source: machine,
		states: (s) => ({ count: s.context.count }),
		commands: ({ source }) => ({ add: () => source.send({ type: "ADD" }) }),
		events: (e) => ({ changed: e<{ count: number }>() }),
		effects: ({ snapshot, emit }) => {
			evaluated(snapshot.context.count);
			emit({ type: "changed", count: snapshot.context.count });
		},
	});
	const native = vi.fn(),
		effect = vi.fn(),
		watch = vi.fn();
	core.on("native", native);
	core.on("changed", effect);
	core.watch(watch);
	const hook = renderHook(() => useIgnite(core));
	await act(async () => hook.result.current.add());
	expect(evaluated).toHaveBeenCalledTimes(1);
	expect(native).not.toHaveBeenCalled();
	expect(effect).not.toHaveBeenCalled();
	expect(watch).not.toHaveBeenCalled();
	const result = await core.execute({ command: "add" });
	expect(result.states.count).toBe(1);
	expect(native).toHaveBeenCalledTimes(1);
	expect(effect).toHaveBeenCalledTimes(1);
	expect(watch).toHaveBeenCalledTimes(1);
	await act(async () => hook.unmount());
	await core.execute({ command: "add" });
	expect(evaluated).toHaveBeenCalledTimes(3);
	expect(effect).toHaveBeenCalledTimes(2);
	core.dispose();
});

it("allows source commands in committed layout effects without render-time activation", async () => {
	const { core, counts } = fixture("xstate");
	const hook = renderHook(() => {
		const ctx = useIgnite(core);
		React.useLayoutEffect(() => {
			ctx.add();
		}, [ctx.add]);
		return ctx;
	});
	expect(hook.result.current.count).toBe(1);
	expect(counts.active).toBe(1);
	await act(async () => hook.unmount());
	expect(counts.active).toBe(0);
	core.dispose();
});

for (const kind of ["xstate", "redux", "mobx"] as const) {
	it(`LC-01 ${kind}: retains state and commands through Activity hide/reveal`, async () => {
		const { core, counts, effects } = fixture(kind);
		let ctx: { count: number; add: () => void } | undefined;
		function Counter() {
			ctx = useIgnite(core);
			return React.createElement("output", null, ctx.count);
		}
		const view = (mode: "visible" | "hidden") => (
			<React.Activity mode={mode}>
				<Counter />
			</React.Activity>
		);
		const root = render(view("visible"));
		if (!ctx) throw Error("missing ctx");
		const retained = ctx;
		await act(async () => retained.add());
		expect(root.container.textContent).toBe("1");
		const constructed = counts.constructed;
		await act(async () => root.rerender(view("hidden")));
		await Promise.resolve();
		// Hiding retains the source, including owned actor invocations. Visible
		// recipients detach; no independent projection effect runs while hidden.
		expect(counts.active).toBe(kind === "redux" ? 2 : 1);
		expect(counts.released).toBe(0);
		const evaluated = effects.mock.calls.length;
		await act(async () => retained.add());
		expect(effects).toHaveBeenCalledTimes(evaluated);
		await act(async () => root.rerender(view("visible")));
		expect(root.container.textContent).toBe("2");
		expect(ctx.add).toBe(retained.add);
		expect(counts.constructed).toBe(constructed);
		await act(async () => ctx?.add());
		expect(root.container.textContent).toBe("3");
		await act(async () => root.unmount());
		expect(counts.active).toBe(0);
		expect(() => retained.add()).toThrow(/disposed|unmounted/);
		const fresh = render(view("visible"));
		expect(fresh.container.textContent).toBe("0");
		await act(async () => fresh.unmount());
		core.dispose();
	});
	it(`LC-01 ${kind}: initially hidden content is inert and hidden deletion releases the runtime`, async () => {
		const { core, counts } = fixture(kind);
		function Counter() {
			const ctx = useIgnite(core);
			return React.createElement("output", null, ctx.count);
		}
		const view = (mode: "visible" | "hidden") => (
			<React.Activity mode={mode}>
				<Counter />
			</React.Activity>
		);
		const root = render(view("hidden"));
		expect(counts.constructed).toBeGreaterThan(0);
		expect(counts.active).toBe(0);
		await act(async () => root.rerender(view("visible")));
		expect(root.container.textContent).toBe("0");
		await act(async () => root.rerender(view("hidden")));
		await act(async () => root.unmount());
		expect(counts.active).toBe(0);
		core.dispose();
	});
	for (const phase of ["descendant layout", "callback ref"] as const) {
		it(`LC-02 ${kind}: commands are ready in ${phase}`, async () => {
			const { core, counts } = fixture(kind);
			function Child({ add }: { add: () => void }) {
				React.useLayoutEffect(() => {
					if (phase === "descendant layout") add();
				}, [add]);
				const ref = React.useCallback(
					(node: HTMLSpanElement | null) => {
						if (node && phase === "callback ref") add();
					},
					[add],
				);
				return React.createElement("span", { ref });
			}
			function Counter() {
				const ctx = useIgnite(core);
				React.useInsertionEffect(() => {
					expect(counts.active).toBe(0);
				}, []);
				return React.createElement(
					"div",
					null,
					React.createElement("output", null, ctx.count),
					React.createElement(Child, { add: ctx.add }),
				);
			}
			const root = render(React.createElement(Counter));
			expect(root.container.querySelector("output")?.textContent).toBe("1");
			expect(counts.active).toBe(kind === "redux" ? 2 : 1);
			await act(async () => root.unmount());
			expect(counts.active).toBe(0);
			core.dispose();
		});
	}
}

for (const kind of ["xstate", "redux", "mobx"] as const) {
	it(`LC-01 ${kind}: replacement and terminal disposal release hidden retained bindings`, async () => {
		const first = fixture(kind),
			second = fixture(kind);
		let command: (() => void) | undefined;
		function Counter({ core }: { core: typeof first.core }) {
			const ctx = useIgnite(core);
			command = ctx.add;
			return React.createElement("output", null, ctx.count);
		}
		const view = (core: typeof first.core, mode: "visible" | "hidden") => (
			<React.Activity mode={mode}>
				<Counter core={core} />
			</React.Activity>
		);
		const root = render(view(first.core, "visible"));
		if (!command) throw Error("missing command");
		const old = command;
		await act(async () => old());
		await act(async () => root.rerender(view(first.core, "hidden")));
		await act(async () => root.rerender(view(second.core, "hidden")));
		expect(first.counts.active).toBe(0);
		expect(() => old()).toThrow(/disposed|unmounted/);
		expect(second.counts.active).toBe(0);
		await act(async () => root.rerender(view(second.core, "visible")));
		expect(root.container.textContent).toBe("0");
		await act(async () => root.rerender(view(second.core, "hidden")));
		const retained = command;
		second.core.dispose();
		second.core.dispose();
		expect(second.counts.active).toBe(0);
		expect(() => retained()).toThrow(/disposed/);
		expect(() => root.rerender(view(second.core, "visible"))).toThrow(
			/disposed/,
		);
		await act(async () => root.unmount());
		first.core.dispose();
	});
}

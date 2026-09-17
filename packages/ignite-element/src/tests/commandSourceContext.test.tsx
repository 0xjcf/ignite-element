/** @jsxImportSource ignite-element/jsx */
import {
	configureStore,
	createSlice,
	type PayloadAction,
} from "@reduxjs/toolkit";
import { makeAutoObservable } from "mobx";
import { describe, expect, it, vi } from "vitest";
import { assign, createActor, setup } from "xstate";
import {
	type ActorWebSourceSnapshot,
	igniteCore as actorWebCore,
} from "../actor-web";
import { igniteCore as mobxCore } from "../mobx";
import { igniteCore as reduxCore } from "../redux";
import { igniteCore as xstateCore } from "../xstate";

const machine = setup({
	types: {
		context: {} as { count: number },
		events: {} as { type: "ADD"; amount: number },
	},
}).createMachine({
	context: { count: 0 },
	on: {
		ADD: {
			actions: assign({
				count: ({ context, event }) => context.count + event.amount,
			}),
		},
	},
});
const slice = createSlice({
	name: "counter",
	initialState: { count: 0 },
	reducers: {
		add: (state, event: PayloadAction<number>) => {
			state.count += event.payload;
		},
	},
});
const storeFactory = () => configureStore({ reducer: slice.reducer });
const observableFactory = () =>
	makeAutoObservable({
		count: 0,
		add(amount: number) {
			this.count += amount;
			return this.count;
		},
	});
function actorWebFactory() {
	let count = 0;
	const listeners = new Set<
		(snapshot: ActorWebSourceSnapshot<{ count: number }>) => void
	>();
	const snapshot = () => ({
		address: "counter",
		phase: "active",
		context: { count },
		toJSON: () => ({ count }),
	});
	return {
		address: "counter",
		snapshot,
		subscribe(
			listener: (value: ActorWebSourceSnapshot<{ count: number }>) => void,
		) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		send: vi.fn(async (event: { type: "ADD"; amount: number }) => {
			count += event.amount;
			for (const listener of listeners) listener(snapshot());
		}),
		close: vi.fn(),
	};
}

const cases = [
	...[false, true].map((shared) => ({
		name: `XState ${shared ? "actor" : "machine"}`,
		shared,
		create() {
			const actor = createActor(machine).start();
			const stop = vi.spyOn(actor, "stop");
			const core = xstateCore({
				source: shared ? actor : machine,
				states: (s) => ({ count: s.context.count }),
				commands: ({ source }) => ({
					add: (amount: number) => source.send({ type: "ADD", amount }),
				}),
			});
			return {
				core,
				check: () => expect(stop).not.toHaveBeenCalled(),
				cleanup: () => actor.stop(),
			};
		},
	})),
	...["store", "factory", "slice"].map((form) => ({
		name: `Redux ${form}`,
		shared: form === "store",
		create() {
			const factory = vi.fn(storeFactory);
			const core =
				form === "slice"
					? reduxCore({
							source: slice,
							states: (s) => ({ count: s.count }),
							commands: ({ source: store }) => ({
								add: (amount: number) =>
									store.dispatch(slice.actions.add(amount)),
							}),
						})
					: form === "factory"
						? reduxCore({
								adapter: "redux",
								source: factory,
								states: (s) => ({ count: s.count }),
								commands: ({ source: store }) => ({
									add: (amount: number) =>
										store.dispatch(slice.actions.add(amount)),
								}),
							})
						: reduxCore({
								source: storeFactory(),
								states: (s) => ({ count: s.count }),
								commands: ({ source: store }) => ({
									add: (amount: number) =>
										store.dispatch(slice.actions.add(amount)),
								}),
							});
			return {
				core,
				check: () => {
					if (form === "factory") expect(factory).toHaveBeenCalledTimes(2);
				},
				cleanup: () => {},
			};
		},
	})),
	...[false, true].map((shared) => ({
		name: `MobX ${shared ? "observable" : "factory"}`,
		shared,
		create() {
			const factory = vi.fn(observableFactory);
			const core = shared
				? mobxCore({
						source: observableFactory(),
						states: (s) => ({ count: s.count }),
						commands: ({ source: store }) => ({
							add: (amount: number) => store.add(amount),
						}),
					})
				: mobxCore({
						adapter: "mobx",
						source: factory,
						states: (s) => ({ count: s.count }),
						commands: ({ source: store }) => ({
							add: (amount: number) => store.add(amount),
						}),
					});
			return {
				core,
				check: () => {
					if (!shared) expect(factory).toHaveBeenCalledTimes(2);
				},
				cleanup: () => {},
			};
		},
	})),
	...[false, true].map((shared) => ({
		name: `Actor-Web ${shared ? "source" : "factory"}`,
		shared,
		create() {
			const instances: ReturnType<typeof actorWebFactory>[] = [];
			const factory = vi.fn(() => {
				const source = actorWebFactory();
				instances.push(source);
				return source;
			});
			const core = actorWebCore({
				source: shared ? factory() : factory,
				states: (s) => ({ count: s.context.count }),
				commands: ({ source }) => ({
					add: (amount: number) => source.send({ type: "ADD", amount }),
				}),
			});
			return {
				core,
				check: () => {
					expect(factory).toHaveBeenCalledTimes(shared ? 1 : 2);
					expect(
						instances.reduce(
							(sum, source) => sum + source.send.mock.calls.length,
							0,
						),
					).toBe(1);
					for (const source of instances)
						expect(source.close).not.toHaveBeenCalled();
				},
				cleanup: () => {},
			};
		},
	})),
];

describe("resolved source command context", () => {
	it("preserves a native action's direct return through inferred JSX commands", () => {
		const source = observableFactory();
		const core = mobxCore({
			source,
			commands: ({ source: store }) => ({
				add: (amount: number) => store.add(amount),
			}),
		});
		let result: number | undefined;
		const tag = `source-return-${crypto.randomUUID()}`;
		core(tag, (ctx) => (
			<button
				type="button"
				onClick={() => {
					result = ctx.add(2);
				}}
			>
				Add
			</button>
		));
		const element = document.createElement(tag);
		try {
			document.body.append(element);
			element.shadowRoot?.querySelector("button")?.click();
			expect(result).toBe(2);
			expect(source.count).toBe(2);
		} finally {
			element.remove();
			core.dispose();
		}
	});

	for (const scenario of cases) {
		it(`${scenario.name} targets the intended view instance without extra acquisition`, async () => {
			const { core, check, cleanup } = scenario.create();
			const tag = `source-context-${crypto.randomUUID()}`;
			core(tag, (ctx) => (
				<button type="button" onClick={() => ctx.add(2)}>
					{ctx.count}
				</button>
			));
			const first = document.createElement(tag);
			const second = document.createElement(tag);
			try {
				document.body.append(first, second);
				const button = first.shadowRoot?.querySelector("button");
				expect(button).not.toBeNull();
				button?.click();
				await Promise.resolve();
				expect(first.shadowRoot?.textContent).toContain("2");
				expect(second.shadowRoot?.textContent).toContain(
					scenario.shared ? "2" : "0",
				);
			} finally {
				first.remove();
				second.remove();
				try {
					core.dispose();
					check();
				} finally {
					cleanup();
				}
			}
		});
	}

	it("exposes only source and preserves headless results, effects and borrowed lifetime", async () => {
		const source = observableFactory();
		const keys: string[][] = [];
		const core = mobxCore({
			source,
			states: (s) => ({ count: s.count }),
			commands: (context) => {
				keys.push(Object.keys(context));
				return { add: (amount: number) => context.source.add(amount) };
			},
			events: (e) => ({ changed: e<{ count: number }>() }),
			effects: ({ select, emit }) => {
				const count = select((s) => s.count);
				if (count.changed) emit({ type: "changed", count: count.current });
			},
		});
		const events: number[] = [];
		const observer = core.on("changed", (event) => events.push(event.count));
		try {
			expect(core.get("states").count).toBe(0);
			const result = await core.execute({ command: "add", input: 3 });
			expect(result.states.count).toBe(3);
			expect(source.count).toBe(3);
			expect(events).toEqual([3]);
			expect(keys.every((key) => key.length === 1 && key[0] === "source")).toBe(
				true,
			);
		} finally {
			observer.unsubscribe();
			core.dispose();
		}
		source.add(1);
		expect(source.count).toBe(4);
	});
});

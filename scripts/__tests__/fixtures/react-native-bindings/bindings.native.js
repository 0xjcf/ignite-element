import { configureStore, createSlice } from "@reduxjs/toolkit";
import { igniteCore as mobxCore } from "ignite-element/mobx";
import { useIgnite } from "ignite-element/react";
import { igniteCore as reduxCore } from "ignite-element/redux";
import { igniteCore } from "ignite-element/xstate";
import { makeAutoObservable, onBecomeObserved, onBecomeUnobserved } from "mobx";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { act, create } from "react-test-renderer";
import { assign, createActor, createMachine, fromCallback } from "xstate";

test("a native host borrows the prepared packed public core without DOM or owner shutdown", async () => {
	expect(typeof document).toBe("undefined");
	expect(typeof HTMLElement).toBe("undefined");
	const source = createActor(
		createMachine({
			context: { count: 0 },
			on: {
				ADD: { actions: assign({ count: ({ context }) => context.count + 1 }) },
			},
		}),
	).start();
	const stop = jest.spyOn(source, "stop");
	const core = igniteCore({
		source,
		states: (snapshot) => ({ count: snapshot.context.count }),
		commands: ({ source: actor }) => ({
			add: () => actor.send({ type: "ADD" }),
		}),
	});
	let savedCommand;
	function Counter() {
		const ctx = useIgnite(core);
		savedCommand = ctx.add;
		return (
			<View>
				<Text testID="count">{ctx.count}</Text>
				<Pressable testID="add" onPress={ctx.add}>
					<Text>Add</Text>
				</Pressable>
			</View>
		);
	}
	let root;
	await act(async () => {
		root = create(
			<React.StrictMode>
				<Counter />
			</React.StrictMode>,
		);
	});
	expect(root.root.findByProps({ testID: "count" }).props.children).toBe(0);
	await act(async () => {
		root.root.findByProps({ testID: "add" }).props.onPress();
	});
	expect(root.root.findByProps({ testID: "count" }).props.children).toBe(1);
	await act(async () => {
		root.unmount();
	});
	expect(stop).not.toHaveBeenCalled();
	savedCommand();
	expect(core.get("states").count).toBe(2);
	core.dispose();
	expect(stop).not.toHaveBeenCalled();
	expect(() => savedCommand()).toThrow(/disposed/);
	source.stop();
});

test("two native views borrow one ready actor without acquiring it during rendering", async () => {
	const source = createActor(
		createMachine({
			context: { count: 0 },
			on: {
				ADD: { actions: assign({ count: ({ context }) => context.count + 1 }) },
			},
		}),
	).start();
	const stop = jest.spyOn(source, "stop");
	const subscribe = jest.spyOn(source, "subscribe");
	const evaluated = jest.fn();
	const core = igniteCore({
		source,
		states: (snapshot) => ({ count: snapshot.context.count }),
		commands: ({ source: actor }) => ({
			add: () => actor.send({ type: "ADD" }),
		}),
		effects: ({ select }) => {
			const count = select((snapshot) => snapshot.context.count);
			evaluated(count.previous, count.current);
		},
	});
	expect(evaluated).not.toHaveBeenCalled();
	const preparedSubscriptions = subscribe.mock.calls.length;
	let held;
	function Counter({ id }) {
		const ctx = useIgnite(core);
		held = ctx.add;
		return (
			<Pressable testID={id} onPress={ctx.add}>
				<Text testID={`${id}-count`}>{ctx.count}</Text>
			</Pressable>
		);
	}
	let root;
	try {
		await act(async () => {
			root = create(
				<React.StrictMode>
					<Counter id="first" />
					<Counter id="second" />
				</React.StrictMode>,
			);
		});
		expect(subscribe).toHaveBeenCalledTimes(preparedSubscriptions);
		expect(evaluated).not.toHaveBeenCalled();
		await act(async () => {
			root.root.findByProps({ testID: "first" }).props.onPress();
		});
		expect(
			root.root.findByProps({ testID: "second-count" }).props.children,
		).toBe(1);
		await act(async () => {
			root.unmount();
		});
		source.send({ type: "ADD" });
		await Promise.resolve();
		await act(async () => {
			root = create(
				<React.StrictMode>
					<Counter id="again" />
				</React.StrictMode>,
			);
		});
		expect(
			root.root.findByProps({ testID: "again-count" }).props.children,
		).toBe(2);
		expect(evaluated.mock.calls).toEqual([
			[0, 1],
			[1, 2],
		]);
		expect(subscribe).toHaveBeenCalledTimes(preparedSubscriptions);
		await act(async () => root.unmount());
		core.dispose();
		core.dispose();
		expect(stop).not.toHaveBeenCalled();
		expect(() => held()).toThrow(/disposed/);
	} finally {
		core.dispose();
		source.stop();
	}
	expect(typeof document).toBe("undefined");
});

for (const kind of ["xstate", "redux", "mobx"]) {
	test(`independent ${kind} native hosts survive replay, replace and release automatically`, async () => {
		let active = 0;
		const slice = createSlice({
			name: "count",
			initialState: { count: 0 },
			reducers: {
				add: (s) => {
					s.count++;
				},
			},
		});
		const makeCore = () => {
			if (kind === "xstate")
				return igniteCore({
					source: createMachine({
						context: { count: 0 },
						invoke: {
							src: fromCallback(() => {
								active++;
								return () => {
									active--;
								};
							}),
						},
						on: {
							ADD: {
								actions: assign({ count: ({ context }) => context.count + 1 }),
							},
						},
					}),
					states: (s) => ({ count: s.context.count }),
					commands: ({ source }) => ({
						add: () => source.send({ type: "ADD" }),
					}),
				});
			if (kind === "redux")
				return reduxCore({
					source: () => {
						const store = configureStore({ reducer: slice.reducer });
						const subscribe = store.subscribe;
						store.subscribe = (fn) => {
							active++;
							const off = subscribe(fn);
							return () => {
								active--;
								off();
							};
						};
						return store;
					},
					states: (s) => ({ count: s.count }),
					commands: ({ source: store }) => ({
						add: () => store.dispatch(slice.actions.add()),
					}),
				});
			return mobxCore({
				source: () => {
					const store = makeAutoObservable({
						count: 0,
						add() {
							this.count++;
						},
					});
					onBecomeObserved(store, "count", () => {
						active++;
					});
					onBecomeUnobserved(store, "count", () => {
						active--;
					});
					return store;
				},
				states: (s) => ({ count: s.count }),
				commands: ({ source }) => ({ add: () => source.add() }),
			});
		};
		const core = makeCore(),
			replacement = makeCore();
		const held = {};
		function Counter({ id, owner }) {
			const ctx = useIgnite(owner);
			held[id] = ctx.add;
			return (
				<Pressable testID={id} onPress={ctx.add}>
					<Text testID={`${id}-count`}>{ctx.count}</Text>
				</Pressable>
			);
		}
		const pair = (first = core) => (
			<React.StrictMode>
				<Counter key="first" id="first" owner={first} />
				<Counter key="second" id="second" owner={core} />
			</React.StrictMode>
		);
		let root;
		const pending = new Promise(() => {});
		let abandonedReads = 0;
		function Suspended() {
			const ctx = useIgnite(core);
			expect(ctx.count).toBe(0);
			abandonedReads++;
			throw pending;
		}
		await act(async () => {
			root = create(
				<React.Suspense fallback={<Text>Waiting</Text>}>
					<Suspended />
				</React.Suspense>,
			);
		});
		expect(abandonedReads).toBeGreaterThan(0);
		expect(active).toBe(0);
		await act(async () => root.unmount());
		await act(async () => {
			root = create(pair());
		});
		expect(active).toBe(2);
		await act(async () => held.first());
		expect(
			root.root.findByProps({ testID: "first-count" }).props.children,
		).toBe(1);
		expect(
			root.root.findByProps({ testID: "second-count" }).props.children,
		).toBe(0);
		const old = held.first;
		await act(async () => root.update(pair(replacement)));
		expect(() => old()).toThrow(/disposed|unmounted/);
		expect(active).toBe(2);
		expect(
			root.root.findByProps({ testID: "first-count" }).props.children,
		).toBe(0);
		await act(async () => root.unmount());
		expect(active).toBe(0);
		await act(async () => {
			root = create(pair());
		});
		expect(
			root.root.findByProps({ testID: "first-count" }).props.children,
		).toBe(0);
		await act(async () => root.unmount());
		for (const phase of ["layout", "ref"]) {
			function Child({ add }) {
				React.useLayoutEffect(() => {
					if (phase === "layout") add();
				}, [add]);
				const ref = React.useCallback(
					(node) => {
						if (node && phase === "ref") add();
					},
					[add],
				);
				return <View ref={ref} />;
			}
			function Parent() {
				const ctx = useIgnite(core);
				React.useInsertionEffect(() => {
					expect(active).toBe(0);
				}, []);
				return (
					<View>
						<Text testID="commit-count">{ctx.count}</Text>
						<Child add={ctx.add} />
					</View>
				);
			}
			await act(async () => {
				root = create(<Parent />, { createNodeMock: () => ({}) });
			});
			expect(
				root.root.findByProps({ testID: "commit-count" }).props.children,
			).toBe(1);
			expect(active).toBe(1);
			await act(async () => root.unmount());
			expect(active).toBe(0);
		}
		core.dispose();
		core.dispose();
		replacement.dispose();
		expect(active).toBe(0);
		expect(() => held.first()).toThrow(/disposed/);
		await act(async () => root.unmount());
		expect(typeof document).toBe("undefined");
	});
}

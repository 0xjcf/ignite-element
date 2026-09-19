import { configureStore, createSlice } from "@reduxjs/toolkit";
import { igniteCore as mobxCore } from "ignite-element/mobx";
import { useIgnite } from "ignite-element/react";
import { igniteCore as reduxCore } from "ignite-element/redux";
import { igniteCore } from "ignite-element/xstate";
import { makeAutoObservable } from "mobx";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { assign, createActor, createMachine, emit, setup } from "xstate";

const source = createMachine({
	types: {} as {
		context: { count: number };
		events: { type: "ADD"; amount: number };
	},
	context: { count: 0 },
});
const core = igniteCore({
	source,
	states: (snapshot) => ({ count: snapshot.context.count }),
	commands: ({ source: actor }) => ({
		add: ({ amount }: { amount: number }) =>
			actor.send({ type: "ADD", amount }),
	}),
});
export function Counter() {
	const ctx = useIgnite(core);
	const value: number = ctx.count;
	// @ts-expect-error Native command inference rejects the wrong payload.
	ctx.add({ amount: "bad" });
	return (
		<View>
			<Text>{value}</Text>
			<Pressable onPress={() => ctx.add({ amount: 2 })}>
				<Text>Add</Text>
			</Pressable>
		</View>
	);
}

const borrowed = igniteCore({
	source: createActor(source).start(),
	states: (snapshot) => ({ count: snapshot.context.count }),
	commands: ({ source: actor }) => ({
		add: (amount: number) => actor.send({ type: "ADD", amount }),
	}),
});
export function SharedCounter() {
	const ctx = useIgnite(borrowed);
	const count: number = ctx.count;
	// @ts-expect-error The shared native binding keeps numeric command inference.
	ctx.add("wrong");
	return (
		<Pressable onPress={() => ctx.add(1)}>
			<Text>{count}</Text>
		</Pressable>
	);
}

const counterActor = createActor(
	setup({
		types: {
			context: {} as { count: number },
			events: {} as { type: "INCREMENT" } | { type: "RESET" },
			emitted: {} as { type: "counterReset"; count: number },
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
					emit(({ context }) => ({
						type: "counterReset",
						count: context.count,
					})),
				],
			},
		},
	}),
).start();
const eventCore = igniteCore({
	source: counterActor,
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
		// @ts-expect-error Native names cannot also be produced by effects.
		emit({ type: "counterReset", count: 0 });
	},
});
export function EventCounter() {
	const ctx = useIgnite(eventCore);
	return (
		<View>
			<Text>{ctx.count}</Text>
			<Pressable onPress={() => ctx.increment()}>
				<Text>Increment</Text>
			</Pressable>
			<Pressable onPress={() => ctx.reset()}>
				<Text>Reset</Text>
			</Pressable>
		</View>
	);
}
eventCore.on("counterReset", (event) => {
	const count: number = event.count;
	void count;
});
// Terminal application shutdown, separately from native view unmount:
eventCore.dispose();
counterActor.stop();

// Compile-only migration guards: the removed property is not a compatibility API.
function commandContextContract() {
	igniteCore({
		source,
		// @ts-expect-error Commands expose source, not actor.
		commands: ({ actor }) => ({
			add: () => actor.send({ type: "ADD", amount: 1 }),
		}),
	});
	igniteCore({
		source,
		commands: ({ source }) => ({
			invalidMethod: () => {
				// @ts-expect-error XState capabilities are unchanged by the rename.
				source.dispatch({ type: "ADD", amount: 1 });
			},
		}),
	});
}
void commandContextContract;

const slice = createSlice({
	name: "count",
	initialState: { count: 0 },
	reducers: {
		add: (state) => {
			state.count++;
		},
	},
});
const independentRedux = reduxCore({
	source: () => configureStore({ reducer: slice.reducer }),
	states: (s) => ({ count: s.count }),
	commands: ({ source: store }) => ({
		add: () => store.dispatch(slice.actions.add()),
	}),
});
const independentMobx = mobxCore({
	source: () =>
		makeAutoObservable({
			count: 0,
			add(amount: number) {
				this.count += amount;
			},
		}),
	states: (s) => ({ count: s.count }),
	commands: ({ source: store }) => ({
		add: (amount: number) => store.add(amount),
	}),
});
export function FactoryCounters() {
	const redux = useIgnite(independentRedux),
		mobx = useIgnite(independentMobx);
	const value: number = redux.count + mobx.count;
	// @ts-expect-error Aliased MobX commands preserve numeric input.
	mobx.add("bad");
	// @ts-expect-error Redux action creator command remains argument-free.
	redux.add(1);
	return (
		<Text
			onPress={() => {
				redux.add();
				mobx.add(2);
			}}
		>
			{value}
		</Text>
	);
}

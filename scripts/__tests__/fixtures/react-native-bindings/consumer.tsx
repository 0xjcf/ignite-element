import { useIgnite } from "ignite-element/react";
import { igniteCore } from "ignite-element/xstate";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { createActor, createMachine } from "xstate";

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
	commands: ({ actor }) => ({
		add: ({ amount }: { amount: number }) =>
			actor.send({ type: "ADD", amount }),
	}),
});
core.get("states");
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
	commands: ({ actor }) => ({
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

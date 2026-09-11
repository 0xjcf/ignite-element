import { useIgnite } from "ignite-element/react";
import { igniteCore } from "ignite-element/xstate";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { createMachine } from "xstate";

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
	const { count, add } = useIgnite(core);
	const value: number = count;
	// @ts-expect-error Native command inference rejects the wrong payload.
	add({ amount: "bad" });
	return (
		<View>
			<Text>{value}</Text>
			<Pressable onPress={() => add({ amount: 2 })}>
				<Text>Add</Text>
			</Pressable>
		</View>
	);
}

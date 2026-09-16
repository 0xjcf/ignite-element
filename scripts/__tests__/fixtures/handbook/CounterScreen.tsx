import { useIgnite } from "ignite-element/react";
import { Pressable, Text, View } from "react-native";
import { core } from "./counter-core";

export function CounterScreen() {
	const ctx = useIgnite(core);
	return (
		<View>
			<Text>{ctx.count}</Text>
			<Pressable onPress={() => ctx.decrement()}>
				<Text>Decrement</Text>
			</Pressable>
			<Pressable onPress={() => ctx.increment()}>
				<Text>Increment</Text>
			</Pressable>
		</View>
	);
}

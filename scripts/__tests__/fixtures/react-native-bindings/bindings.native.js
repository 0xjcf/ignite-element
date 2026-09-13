import { useIgnite } from "ignite-element/react";
import { igniteCore } from "ignite-element/xstate";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { act, create } from "react-test-renderer";
import { assign, createActor, createMachine } from "xstate";

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
		commands: ({ actor }) => ({ add: () => actor.send({ type: "ADD" }) }),
	});
	core.get("states");
	let savedCommand;
	function Counter() {
		const { count, add } = useIgnite(core);
		savedCommand = add;
		return (
			<View>
				<Text testID="count">{count}</Text>
				<Pressable testID="add" onPress={add}>
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

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
		commands: ({ actor }) => ({ add: () => actor.send({ type: "ADD" }) }),
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
				<Text testID={id + "-count"}>{ctx.count}</Text>
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

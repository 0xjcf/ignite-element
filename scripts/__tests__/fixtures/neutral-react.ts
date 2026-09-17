import {
	type ActorWebCommandSource,
	igniteCore,
} from "ignite-element/actor-web";
import { useIgnite } from "ignite-element/react";

declare const source: ActorWebCommandSource<
	{ count: number },
	{ type: "ADD"; amount: number }
>;
const core = igniteCore({
	source,
	states: (snapshot) => ({
		count: snapshot.context.count,
		functionState: () => "state",
	}),
	commands: ({ source: actor }) => ({
		add: (amount: number) => actor.send({ type: "ADD", amount }),
	}),
});
core.get("states");
export function useCounter() {
	const { count, add, functionState } = useIgnite(core);
	const value: number = count;
	const text: string = functionState();
	add(2);
	// @ts-expect-error Hook command inference remains strict.
	add("bad");
	return { value, text };
}

// @ts-expect-error Web wrapper is not exported by the neutral hook.
import { igniteReact } from "ignite-element/react";

void igniteReact;

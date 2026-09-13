// Early public declaration probe: compile independently without lib.dom.
import { igniteCore } from "ignite-element/xstate";
import { createMachine } from "xstate";

const source = createMachine({
	context: { count: 0 },
});

const core = igniteCore({
	source,
	states: (snapshot) => ({ count: snapshot.context.count }),
});

const count: number = core.get("states").count;
void count;

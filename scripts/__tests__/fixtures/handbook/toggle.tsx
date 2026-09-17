/** @jsxImportSource ignite-element/jsx */
import { igniteCore } from "ignite-element/xstate";
import { createActor, createMachine } from "xstate";

export const source = createActor(
	createMachine({
		initial: "off",
		states: {
			off: { on: { TOGGLE: "on" } },
			on: { on: { TOGGLE: "off" } },
		},
	}),
).start();

export const core = igniteCore({
	source,
	states: (snapshot) => ({ isOn: snapshot.matches("on") }),
	commands: ({ actor }) => ({
		toggle: () => actor.send({ type: "TOGGLE" }),
	}),
});

core("ignite-toggle", (ctx) => (
	<section>
		<button type="button" onClick={() => ctx.toggle()}>
			{ctx.isOn ? "On" : "Off"}
		</button>
	</section>
));

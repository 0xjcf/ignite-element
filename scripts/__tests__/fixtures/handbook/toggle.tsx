/** @jsxImportSource ignite-element/jsx */
import { igniteCore } from "ignite-element/xstate";
import { createMachine } from "xstate";

const toggleMachine = createMachine({
	initial: "off",
	states: {
		off: { on: { TOGGLE: "on" } },
		on: { on: { TOGGLE: "off" } },
	},
});

export const core = igniteCore({
	source: toggleMachine,
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

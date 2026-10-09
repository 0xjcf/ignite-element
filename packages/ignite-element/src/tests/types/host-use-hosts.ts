import { createMachine } from "xstate";
import { igniteCore } from "../../xstate";

const machine = createMachine({
	types: { context: {} as { angle: number } },
	context: { angle: 0 },
});

const scene = {
	mount() {},
	dispose() {},
};

const speaker = {
	mount() {},
	dispose() {},
};

export const orbitHosts = { scene };
export const radioHosts = { speaker };

export const orbit = igniteCore({
	source: machine,
	hosts: orbitHosts,
});

export const radio = igniteCore({
	source: machine,
	hosts: radioHosts,
});

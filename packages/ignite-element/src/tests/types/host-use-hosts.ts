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

/** Same host map shape as `orbit`. JSX treats these handles as interchangeable. */
export const twin = igniteCore({
	source: machine,
	hosts: { scene },
});

export const plain = igniteCore({
	source: machine,
});

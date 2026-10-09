/** @jsxImportSource ignite-element/jsx */
import { createMachine } from "xstate";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import { igniteCore } from "../../xstate";

const machine = createMachine({
	types: { context: {} as { angle: number } },
	context: { angle: 0 },
});

const scene = {
	mount() {},
	dispose() {},
};

const core = igniteCore({
	source: machine,
	hosts: { scene },
});

core("orbit", () => <canvas use="scene" />);

// @ts-expect-error use must name a host on this core
core("orbit", () => jsx("canvas", { use: "missing" }));

export const hostedJsx = core;

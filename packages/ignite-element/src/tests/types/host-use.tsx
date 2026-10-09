/** @jsxImportSource ignite-element/jsx */
import { jsx } from "../../renderers/jsx/jsx-runtime";
import { orbit, type orbitHosts, radio } from "./host-use-hosts";

declare global {
	interface IgniteHostNames extends Record<keyof typeof orbitHosts, true> {}
}

orbit("orbit", () => <canvas use="scene" />);
orbit("orbit", () => (
	<div>
		<canvas use="scene" />
	</div>
));

// @ts-expect-error use must name a host on this core
orbit("orbit", () => <canvas use="missing" />);

orbit("orbit", () => (
	<div>
		{/* @ts-expect-error use must name a host on this core */}
		<canvas use="missing" />
	</div>
));

// @ts-expect-error use must name a host on this core
orbit("orbit", () => <canvas use="speaker" />);

// @ts-expect-error use must name a host on this core
orbit("orbit", () => jsx("canvas", { use: "missing" }));

// @ts-expect-error use must name a host on this core
orbit("orbit", () => jsx("canvas", { use: "speaker" }));

// @ts-expect-error use must name a host on this core
radio("radio", () => jsx("canvas", { use: "scene" }));

// @ts-expect-error use must name a host on this core
orbit("orbit", () =>
	jsx("div", { children: jsx("canvas", { use: "speaker" }) }),
);

export const hostedJsx = orbit;

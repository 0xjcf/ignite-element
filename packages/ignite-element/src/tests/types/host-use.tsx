/** @jsxImportSource ignite-element/jsx */
import { jsx } from "../../renderers/jsx/jsx-runtime";
import { orbit, radio } from "./host-use-hosts";

orbit("orbit", ({ hosts }) => <canvas use={hosts.scene} />);

orbit("orbit", ({ hosts }) => (
	<div>
		<canvas use={hosts.scene} />
	</div>
));

radio("radio", ({ hosts }) => <canvas use={hosts.speaker} />);

// @ts-expect-error use must be a handle on this core
orbit("orbit", ({ hosts }) => <canvas use={hosts.missing} />);

orbit("orbit", ({ hosts }) => (
	<div>
		{/* @ts-expect-error use must be a handle on this core */}
		<canvas use={hosts.missing} />
	</div>
));

// @ts-expect-error a bare string is not this core's handle
orbit("orbit", () => <canvas use="scene" />);

orbit("orbit", (orbitView) => {
	// @ts-expect-error a handle from another core is not this core's handle
	radio("radio", () => jsx("canvas", { use: orbitView.hosts.scene }));
	return <canvas use={orbitView.hosts.scene} />;
});

radio("radio", (radioView) => {
	// @ts-expect-error a handle from another core is not this core's handle
	orbit("orbit", () => jsx("canvas", { use: radioView.hosts.speaker }));
	return <canvas use={radioView.hosts.speaker} />;
});

export const hostedJsx = orbit;

/** @jsxImportSource ignite-element/jsx */
import { jsx } from "../../renderers/jsx/jsx-runtime";
import { orbit, plain, radio, twin } from "./host-use-hosts";

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
	// @ts-expect-error a different host map is not this core's handle
	radio("radio", () => jsx("canvas", { use: orbitView.hosts.scene }));
	// @ts-expect-error a hosted handle is not valid on a core with no hosts
	plain("plain", () => jsx("canvas", { use: orbitView.hosts.scene }));
	twin("twin", () => jsx("canvas", { use: orbitView.hosts.scene }));
	// Tag syntax types the element as JSX.Element and drops `use`, so a
	// different host map still compiles. So does a core with no hosts.
	// Identical host maps compile in both forms.
	radio("radio", () => <canvas use={orbitView.hosts.scene} />);
	plain("plain", () => <canvas use={orbitView.hosts.scene} />);
	twin("twin", () => <canvas use={orbitView.hosts.scene} />);
	return <canvas use={orbitView.hosts.scene} />;
});

radio("radio", (radioView) => {
	orbit("orbit", (orbitView) => {
		// @ts-expect-error a different host map is not this core's handle
		const mismatch: typeof radioView.hosts.speaker = orbitView.hosts.scene;
		void mismatch;
		return <canvas use={radioView.hosts.speaker} />;
	});
	return <canvas use={radioView.hosts.speaker} />;
});

orbit("orbit", ({ hosts }) => {
	// @ts-expect-error a string cast cannot forge this core's handle
	const cast = "scene" as typeof hosts.scene;
	const forged = "scene" as unknown as typeof hosts.scene;
	void cast;
	return <canvas use={forged} />;
});

export const hostedJsx = orbit;

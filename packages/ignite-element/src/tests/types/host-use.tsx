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

// @ts-expect-error a bare string is not this core's handle
orbit("orbit", () => jsx("canvas", { use: "scene" }));

orbit("orbit", (orbitView) => {
	const { hosts } = orbitView;
	// @ts-expect-error a typo is not a host on this core
	const typo: typeof hosts.scene = hosts.missing;
	// @ts-expect-error a bare string is not this core's handle
	const bare: typeof hosts.scene = "scene";
	// @ts-expect-error a string cast cannot forge this core's handle
	const cast: typeof hosts.scene = "scene" as typeof hosts.scene;
	// @ts-expect-error a typo is not a host on this core
	jsx("canvas", { use: hosts.missing });
	// @ts-expect-error a string cast cannot forge this core's handle
	jsx("canvas", { use: "scene" as typeof hosts.scene });
	void typo;
	void bare;
	void cast;
	// @ts-expect-error a different host map is not this core's handle
	radio("radio", () => jsx("canvas", { use: hosts.scene }));
	// @ts-expect-error a hosted handle is not valid on a core with no hosts
	plain("plain", () => jsx("canvas", { use: hosts.scene }));
	twin("twin", (twinView) => {
		const same: typeof hosts.scene = twinView.hosts.scene;
		void same;
		return jsx("canvas", { use: hosts.scene });
	});
	// On JSX tags, TypeScript cannot reject a handle from another core.
	// Cores with identical host maps are not distinguished.
	radio("radio", () => <canvas use={hosts.scene} />);
	plain("plain", () => <canvas use={hosts.scene} />);
	twin("twin", () => <canvas use={hosts.scene} />);
	return <canvas use={hosts.scene} />;
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

import {
	type createHome,
	createLocalHomeSession,
	ROOMS,
} from "../../../../../../examples/agents/smart-home/src/home";

const session = createLocalHomeSession();

/**
 * Same Smart Home factory as tips 1 and 2, isolated so `ignite-shared-home`
 * can coexist with `ignite-v3-home` and `ignite-views-home` on the docs site.
 */
export const home = session.home as ReturnType<typeof createHome>;

/** Restore a quiet house using the same on-stage commands as the panel. */
export async function restoreHome(): Promise<void> {
	const current = home.get("states");
	if (current.activeScene && !current.lights.living) {
		await home.execute({
			command: "toggleLight",
			input: { room: "living", on: true },
		});
	}
	for (const room of ROOMS) {
		await home.execute({
			command: "toggleLight",
			input: { room, on: false },
		});
		await home.execute({
			command: "setThermostat",
			input: { room, temp: 68 },
		});
	}
}

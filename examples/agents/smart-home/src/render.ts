import { type createHome, DOORS, type Door, ROOMS, type Room } from "./home";

/** The home's projected read-model — exactly what `getStates()` returns. */
export type HomeView = ReturnType<ReturnType<typeof createHome>["getStates"]>;

const light = (on: boolean) => (on ? "💡 on " : "·· off");
const lock = (locked: boolean) => (locked ? "🔒 locked  " : "🔓 unlocked");
const pad = (text: string, width: number) => text.padEnd(width);

/** Render the home view as a compact terminal panel (no DOM — pure string). */
export function renderHome(view: HomeView): string {
	const lines: string[] = [];
	lines.push("┌─ 🏠 Home ──────────────────────────────────────────┐");
	lines.push(
		`│ scene: ${pad(view.activeScene ?? "—", 10)}  doors: ${
			view.allDoorsLocked ? "all locked 🔒" : "UNLOCKED 🔓"
		}${pad("", 8)}│`,
	);
	lines.push("├────────────────────────────────────────────────────┤");
	for (const room of ROOMS as readonly Room[]) {
		lines.push(
			`│ ${pad(room, 8)} ${pad(light(view.lights[room]), 8)}  🌡️ ${pad(
				`${view.thermostat[room]}°F`,
				5,
			)}  🪟 ${pad(`${view.blinds[room]}%`, 4)}        │`,
		);
	}
	lines.push("├────────────────────────────────────────────────────┤");
	for (const door of DOORS as readonly Door[]) {
		lines.push(`│ ${pad(door, 8)} ${pad(lock(view.locks[door]), 38)} │`);
	}
	lines.push("└────────────────────────────────────────────────────┘");
	return lines.join("\n");
}

import { isOk, type NeutralToolCall } from "ignite-element/tools";
import { ROOMS } from "../../../../../../examples/agents/smart-home/src/home";
import { home, offeredToolNames, tools } from "./session";

export const movieNightCall: NeutralToolCall = {
	name: "runScene",
	input: "movie",
};

export type AgentBeat =
	| { phase: "offered"; tools: readonly string[] }
	| { phase: "model"; call: NeutralToolCall }
	| { phase: "run"; ok: boolean; detail: string }
	| { phase: "until"; scene: string | null }
	| { phase: "done"; text: string }
	| { phase: "error"; message: string };

function prefersReducedMotion(): boolean {
	return (
		typeof matchMedia === "function" &&
		matchMedia("(prefers-reduced-motion: reduce)").matches
	);
}

function pause(ms = 420): Promise<void> {
	if (prefersReducedMotion()) {
		return Promise.resolve();
	}
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

/**
 * One scripted agent turn: offer tools, emit runScene("movie"), run, until.
 * Pacing is visual only. The model never leaves the browser.
 */
export async function runMovieNight(
	onBeat: (beat: AgentBeat) => void,
): Promise<void> {
	onBeat({ phase: "offered", tools: offeredToolNames });
	await pause();
	onBeat({ phase: "model", call: movieNightCall });
	await pause();

	const result = await tools.run(movieNightCall);
	if (!isOk(result)) {
		onBeat({
			phase: "run",
			ok: false,
			detail: result.error.kind,
		});
		onBeat({ phase: "error", message: result.error.kind });
		return;
	}

	onBeat({
		phase: "run",
		ok: true,
		detail: `acknowledged · scene ${result.value.states.activeScene ?? "manual"}`,
	});
	await pause();

	const states = await tools.until((observation) =>
		observation.type === "states" && observation.states.activeScene === "movie"
			? observation.states
			: undefined,
	);
	onBeat({
		phase: "until",
		scene: states.activeScene === "movie" ? "movie" : null,
	});
	await pause();
	onBeat({
		phase: "done",
		text: "Movie night is on. Same home, same runScene command.",
	});
}

/** Restore a quiet house using only the three on-stage commands. */
export async function resetHome(): Promise<void> {
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

import {
	ROOMS,
	type Room,
} from "../../../../../../examples/agents/smart-home/src/home";
import { home, restoreHome } from "./shared-session";

export type Caller = "panel" | "scripted";

export type SourceSlice = {
	lights: Record<Room, boolean>;
	thermostat: Record<Room, number>;
	activeScene: string | null;
};

export type SourceRecord = {
	caller: Caller;
	summary: string;
};

export type SourceListener = (
	slice: SourceSlice,
	records: readonly SourceRecord[],
	caller: Caller | null,
) => void;

const listeners = new Set<SourceListener>();
let records: SourceRecord[] = [];
let lastCaller: Caller | null = null;
let pendingCaller: Caller = "panel";
let restoring = false;

function sliceFrom(states = home.get("states")): SourceSlice {
	return {
		lights: { ...states.lights },
		thermostat: { ...states.thermostat },
		activeScene: states.activeScene,
	};
}

function summarize(slice: SourceSlice): string {
	const lights = ROOMS.map(
		(room) => `${room} ${slice.lights[room] ? "on" : "off"}`,
	).join(", ");
	return `${lights} · scene ${slice.activeScene ?? "manual"}`;
}

function publish(slice: SourceSlice): void {
	for (const listener of listeners) {
		listener(slice, records, lastCaller);
	}
}

home.watch(
	(states: {
		lights: Record<Room, boolean>;
		thermostat: Record<Room, number>;
		activeScene: string | null;
	}) => {
		const slice = sliceFrom(states);
		if (restoring) {
			publish(slice);
			return;
		}
		const caller = pendingCaller;
		pendingCaller = "panel";
		lastCaller = caller;
		records = [{ caller, summary: summarize(slice) }, ...records].slice(0, 8);
		publish(slice);
	},
);

export function watchSource(listener: SourceListener): () => void {
	listeners.add(listener);
	listener(sliceFrom(), records, lastCaller);
	return () => {
		listeners.delete(listener);
	};
}

/** Drive the shared core without clicking the panel. */
export async function runMovie(): Promise<void> {
	pendingCaller = "scripted";
	await home.execute({
		command: "runScene",
		input: "movie",
	});
}

export async function resetHome(): Promise<void> {
	restoring = true;
	pendingCaller = "panel";
	lastCaller = null;
	records = [];
	try {
		await restoreHome();
		await Promise.resolve();
		publish(sliceFrom());
	} finally {
		restoring = false;
	}
}

import { igniteCore } from "ignite-element/xstate";
import { assign, setup } from "xstate";

// A virtual smart home the agent drives. No hardware — the browser UI (Phase C)
// will render these devices; here the terminal renders them. The command set is
// deliberately varied to stress the manifest + the Anthropic adapter:
//   - object inputs   (toggleLight, setThermostat, setBlinds)
//   - scalar enum     (lockDoor / unlockDoor / runScene  → Option D scalar wrap)
//   - array input     (dimRooms → Option D scalar wrap)
//   - no-arg          (status)

export const ROOMS = ["living", "bedroom", "kitchen"] as const;
export const DOORS = ["front", "back", "garage"] as const;
export const SCENES = ["morning", "away", "movie", "night"] as const;
const SCENE_TRANSITION_DELAY_MS = 25;

export type Room = (typeof ROOMS)[number];
export type Door = (typeof DOORS)[number];
export type Scene = (typeof SCENES)[number];

export type HomeContext = {
	lights: Record<Room, boolean>;
	thermostat: Record<Room, number>; // °F
	blinds: Record<Room, number>; // % open, 0–100
	locks: Record<Door, boolean>; // true = locked
	activeScene: Scene | null;
	pendingScene: Scene | null;
};

type HomeEvent =
	| { type: "TOGGLE_LIGHT"; room: Room; on: boolean }
	| { type: "SET_THERMOSTAT"; room: Room; temp: number }
	| { type: "SET_BLINDS"; room: Room; percent: number }
	| { type: "SET_LOCK"; door: Door; locked: boolean }
	| { type: "DIM_ROOMS"; rooms: Room[] }
	| { type: "RUN_SCENE"; scene: Scene }
	| { type: "START_SCENE_TRANSITION"; scene: Scene };

const initialContext: HomeContext = {
	lights: { living: false, bedroom: false, kitchen: false },
	thermostat: { living: 68, bedroom: 68, kitchen: 68 },
	blinds: { living: 0, bedroom: 0, kitchen: 0 },
	activeScene: null,
	pendingScene: null,
	locks: { front: true, back: true, garage: true },
};

/** What each scene sets. Returns the full next context (merged). */
function applyScene(ctx: HomeContext, scene: Scene): HomeContext {
	switch (scene) {
		case "morning":
			return {
				...ctx,
				activeScene: scene,
				lights: { living: true, bedroom: true, kitchen: true },
				blinds: { living: 100, bedroom: 100, kitchen: 100 },
				thermostat: { living: 70, bedroom: 70, kitchen: 70 },
			};
		case "away":
			return {
				...ctx,
				activeScene: scene,
				lights: { living: false, bedroom: false, kitchen: false },
				blinds: { living: 0, bedroom: 0, kitchen: 0 },
				thermostat: { living: 62, bedroom: 62, kitchen: 62 },
				locks: { front: true, back: true, garage: true },
			};
		case "movie":
			return {
				...ctx,
				activeScene: scene,
				lights: { ...ctx.lights, living: false },
				blinds: { ...ctx.blinds, living: 0 },
			};
		case "night":
			return {
				...ctx,
				activeScene: scene,
				lights: { living: false, bedroom: false, kitchen: false },
				locks: { front: true, back: true, garage: true },
			};
	}
}

function dimRooms(ctx: HomeContext, rooms: readonly Room[]): HomeContext {
	const lights = { ...ctx.lights };
	const blinds = { ...ctx.blinds };
	let changed = false;

	for (const room of rooms) {
		if (lights[room] !== false || blinds[room] !== 0) {
			changed = true;
		}
		lights[room] = false;
		blinds[room] = 0;
	}

	return {
		...ctx,
		lights,
		blinds,
		activeScene: changed ? null : ctx.activeScene,
	};
}

const homeMachine = setup({
	types: {
		context: {} as HomeContext,
		events: {} as HomeEvent,
	},
}).createMachine({
	id: "smart-home",
	context: initialContext,
	initial: "active",
	states: {
		active: {
			on: {
				TOGGLE_LIGHT: {
					actions: assign({
						lights: ({ context, event }) => ({
							...context.lights,
							[event.room]: event.on,
						}),
						activeScene: ({ context, event }) =>
							context.lights[event.room] === event.on
								? context.activeScene
								: null,
					}),
				},
				SET_THERMOSTAT: {
					actions: assign({
						thermostat: ({ context, event }) => ({
							...context.thermostat,
							[event.room]: event.temp,
						}),
						activeScene: ({ context, event }) =>
							context.thermostat[event.room] === event.temp
								? context.activeScene
								: null,
					}),
				},
				SET_BLINDS: {
					actions: assign({
						blinds: ({ context, event }) => ({
							...context.blinds,
							[event.room]: event.percent,
						}),
						activeScene: ({ context, event }) =>
							context.blinds[event.room] === event.percent
								? context.activeScene
								: null,
					}),
				},
				SET_LOCK: {
					actions: assign({
						locks: ({ context, event }) => ({
							...context.locks,
							[event.door]: event.locked,
						}),
						activeScene: ({ context, event }) =>
							context.locks[event.door] === event.locked
								? context.activeScene
								: null,
					}),
				},
				DIM_ROOMS: {
					actions: assign(({ context, event }) =>
						dimRooms(context, event.rooms),
					),
				},
				RUN_SCENE: {
					actions: assign(({ context, event }) =>
						applyScene(context, event.scene),
					),
				},
				START_SCENE_TRANSITION: {
					target: "settlingScene",
					actions: assign({
						pendingScene: ({ event }) => event.scene,
					}),
				},
			},
		},
		settlingScene: {
			on: {
				TOGGLE_LIGHT: {
					actions: assign({
						lights: ({ context, event }) => ({
							...context.lights,
							[event.room]: event.on,
						}),
						activeScene: ({ context, event }) =>
							context.lights[event.room] === event.on
								? context.activeScene
								: null,
					}),
				},
				SET_THERMOSTAT: {
					actions: assign({
						thermostat: ({ context, event }) => ({
							...context.thermostat,
							[event.room]: event.temp,
						}),
						activeScene: ({ context, event }) =>
							context.thermostat[event.room] === event.temp
								? context.activeScene
								: null,
					}),
				},
				SET_BLINDS: {
					actions: assign({
						blinds: ({ context, event }) => ({
							...context.blinds,
							[event.room]: event.percent,
						}),
						activeScene: ({ context, event }) =>
							context.blinds[event.room] === event.percent
								? context.activeScene
								: null,
					}),
				},
				SET_LOCK: {
					actions: assign({
						locks: ({ context, event }) => ({
							...context.locks,
							[event.door]: event.locked,
						}),
						activeScene: ({ context, event }) =>
							context.locks[event.door] === event.locked
								? context.activeScene
								: null,
					}),
				},
				DIM_ROOMS: {
					actions: assign(({ context, event }) =>
						dimRooms(context, event.rooms),
					),
				},
				RUN_SCENE: {
					target: "active",
					actions: assign(({ context, event }) => ({
						...applyScene(context, event.scene),
						pendingScene: null,
					})),
				},
				START_SCENE_TRANSITION: {
					target: "settlingScene",
					reenter: true,
					actions: assign({
						pendingScene: ({ event }) => event.scene,
					}),
				},
			},
			after: {
				[SCENE_TRANSITION_DELAY_MS]: {
					target: "active",
					actions: assign(({ context }) => {
						const scene = context.pendingScene;
						if (!scene) {
							return { pendingScene: null };
						}

						return {
							...applyScene(context, scene),
							pendingScene: null,
						};
					}),
				},
			},
		},
	},
});

/**
 * Build a fresh headless smart home. Returns the agent-runtime surface
 * (`getSchema()` + `execute()` + `getView()` + `on()` + `watchView()`), no DOM.
 */
export function createHome() {
	return igniteCore({
		source: homeMachine,
		events: (event) => ({
			"light-changed": event<{ room: Room; on: boolean }>(),
			"scene-applied": event<{ scene: Scene }>(),
			"security-changed": event<{ allDoorsLocked: boolean }>(),
		}),
		view: ({ snapshot }) => {
			const c = snapshot.context;
			return {
				lights: { ...c.lights },
				thermostat: { ...c.thermostat },
				blinds: { ...c.blinds },
				locks: { ...c.locks },
				activeScene: c.activeScene,
				pendingScene: c.pendingScene,
				lightsOn: ROOMS.filter((room) => c.lights[room]),
				allDoorsLocked: DOORS.every((door) => c.locks[door]),
			};
		},
		commands: ({ actor, command }) => ({
			toggleLight: command(
				({ room, on }: { room: Room; on: boolean }) =>
					actor.send({ type: "TOGGLE_LIGHT", room, on }),
				{
					description: "Turn a room's light on or off.",
					input: command.object({
						room: command.enum(ROOMS),
						on: command.boolean(),
					}),
				},
			),
			setThermostat: command(
				({ room, temp }: { room: Room; temp: number }) =>
					actor.send({ type: "SET_THERMOSTAT", room, temp }),
				{
					description: "Set a room's target temperature in °F.",
					input: command.object({
						room: command.enum(ROOMS),
						temp: command.number({ minimum: 50, maximum: 90 }),
					}),
				},
			),
			setBlinds: command(
				({ room, percent }: { room: Room; percent: number }) =>
					actor.send({ type: "SET_BLINDS", room, percent }),
				{
					description: "Set how far a room's blinds are open (0–100%).",
					input: command.object({
						room: command.enum(ROOMS),
						percent: command.number({ minimum: 0, maximum: 100 }),
					}),
				},
			),
			lockDoor: command(
				(door: Door) => actor.send({ type: "SET_LOCK", door, locked: true }),
				{
					description: "Lock a door.",
					input: command.enum(DOORS, {
						description: "Door id to lock: front, back, or garage.",
					}),
				},
			),
			unlockDoor: command(
				(door: Door) => actor.send({ type: "SET_LOCK", door, locked: false }),
				{
					description: "Unlock a door.",
					input: command.enum(DOORS, {
						description: "Door id to unlock: front, back, or garage.",
					}),
				},
			),
			runScene: command(
				(scene: Scene) => actor.send({ type: "RUN_SCENE", scene }),
				{
					description:
						"Activate a scene: morning, away, movie, or night. Sets several devices at once.",
					input: command.enum(SCENES, {
						description:
							"Scene name to activate: morning, away, movie, or night.",
					}),
				},
			),
			dimRooms: command(
				(rooms: Room[]) => actor.send({ type: "DIM_ROOMS", rooms }),
				{
					description:
						"Dim selected rooms by turning lights off and closing blinds.",
					input: command.array(
						command.enum(ROOMS, {
							description: "Room id to dim.",
						}),
						{
							description:
								"Room ids to dim by turning lights off and closing blinds.",
							minItems: 1,
						},
					),
				},
			),
			transitionScene: command(
				(scene: Scene) => actor.send({ type: "START_SCENE_TRANSITION", scene }),
				{
					description:
						"Start a scene transition that acknowledges immediately and settles asynchronously.",
					input: command.enum(SCENES, {
						description:
							"Scene name to transition toward asynchronously: morning, away, movie, or night.",
					}),
				},
			),
			status: command(
				() => {
					// No-op: the home state is read from the returned snapshot / getView().
				},
				{ description: "Read the current home state (no change)." },
			),
		}),
		effects: ({ emit, select }) => {
			const lights = select((state) => state.context.lights);
			if (lights.changed) {
				for (const room of ROOMS) {
					if (lights.current[room] !== lights.previous[room]) {
						emit("light-changed", { room, on: lights.current[room] });
					}
				}
			}
			const scene = select((state) => state.context.activeScene);
			if (scene.changed && scene.current) {
				emit("scene-applied", { scene: scene.current });
			}
			const locked = select((state) =>
				DOORS.every((door) => state.context.locks[door]),
			);
			if (locked.changed) {
				emit("security-changed", { allDoorsLocked: locked.current });
			}
		},
	});
}

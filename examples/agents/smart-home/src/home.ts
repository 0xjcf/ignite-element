import type { IgniteToolsRuntime } from "ignite-element/tools";
import { type CommandHelper, igniteCore } from "ignite-element/xstate";
import { assign, createActor, setup } from "xstate";

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
export const SCENE_TRANSITION_DELAY_MS = 25;

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

export type HomeCommand =
	| { type: "TOGGLE_LIGHT"; room: Room; on: boolean }
	| { type: "SET_THERMOSTAT"; room: Room; temp: number }
	| { type: "SET_BLINDS"; room: Room; percent: number }
	| { type: "SET_LOCK"; door: Door; locked: boolean }
	| { type: "DIM_ROOMS"; rooms: Room[] }
	| { type: "RUN_SCENE"; scene: Scene }
	| { type: "START_SCENE_TRANSITION"; scene: Scene }
	| { type: "APPLY_PENDING_SCENE" };

type ReadonlyHomeContext = {
	readonly lights: Readonly<Record<Room, boolean>>;
	readonly thermostat: Readonly<Record<Room, number>>;
	readonly blinds: Readonly<Record<Room, number>>;
	readonly locks: Readonly<Record<Door, boolean>>;
	readonly activeScene: Scene | null;
	readonly pendingScene: Scene | null;
};

export function createInitialHomeContext(): HomeContext {
	return {
		lights: { living: false, bedroom: false, kitchen: false },
		thermostat: { living: 68, bedroom: 68, kitchen: 68 },
		blinds: { living: 0, bedroom: 0, kitchen: 0 },
		activeScene: null,
		pendingScene: null,
		locks: { front: true, back: true, garage: true },
	};
}

export const initialHomeContext: ReadonlyHomeContext = freezeHomeContext(
	createInitialHomeContext(),
);

function freezeHomeContext(context: HomeContext): ReadonlyHomeContext {
	return Object.freeze({
		lights: Object.freeze({ ...context.lights }),
		thermostat: Object.freeze({ ...context.thermostat }),
		blinds: Object.freeze({ ...context.blinds }),
		locks: Object.freeze({ ...context.locks }),
		activeScene: context.activeScene,
		pendingScene: context.pendingScene,
	});
}

/** What each scene sets. Returns the full next context (merged). */
export function applyScene(ctx: HomeContext, scene: Scene): HomeContext {
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

export function dimRooms(
	ctx: HomeContext,
	rooms: readonly Room[],
): HomeContext {
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
		pendingScene: changed ? null : ctx.pendingScene,
		activeScene: changed ? null : ctx.activeScene,
	};
}

function runHomeScene(ctx: HomeContext, scene: Scene): HomeContext {
	return {
		...applyScene(ctx, scene),
		pendingScene: null,
	};
}

export function reduceHomeContext(
	context: HomeContext,
	command: HomeCommand,
): HomeContext {
	switch (command.type) {
		case "TOGGLE_LIGHT":
			return {
				...context,
				lights: {
					...context.lights,
					[command.room]: command.on,
				},
				pendingScene:
					context.lights[command.room] === command.on
						? context.pendingScene
						: null,
				activeScene:
					context.lights[command.room] === command.on
						? context.activeScene
						: null,
			};
		case "SET_THERMOSTAT":
			return {
				...context,
				thermostat: {
					...context.thermostat,
					[command.room]: command.temp,
				},
				pendingScene:
					context.thermostat[command.room] === command.temp
						? context.pendingScene
						: null,
				activeScene:
					context.thermostat[command.room] === command.temp
						? context.activeScene
						: null,
			};
		case "SET_BLINDS":
			return {
				...context,
				blinds: {
					...context.blinds,
					[command.room]: command.percent,
				},
				pendingScene:
					context.blinds[command.room] === command.percent
						? context.pendingScene
						: null,
				activeScene:
					context.blinds[command.room] === command.percent
						? context.activeScene
						: null,
			};
		case "SET_LOCK":
			return {
				...context,
				locks: {
					...context.locks,
					[command.door]: command.locked,
				},
				pendingScene:
					context.locks[command.door] === command.locked
						? context.pendingScene
						: null,
				activeScene:
					context.locks[command.door] === command.locked
						? context.activeScene
						: null,
			};
		case "DIM_ROOMS":
			return dimRooms(context, command.rooms);
		case "RUN_SCENE":
			return runHomeScene(context, command.scene);
		case "START_SCENE_TRANSITION":
			return {
				...context,
				pendingScene: command.scene,
			};
		case "APPLY_PENDING_SCENE": {
			const scene = context.pendingScene;
			if (!scene) {
				return { ...context, pendingScene: null };
			}

			return runHomeScene(context, scene);
		}
		default:
			return assertNeverHomeCommand(command);
	}
}

function assertNeverHomeCommand(command: never): never {
	const candidate = command as { type?: unknown };
	throw new Error(
		`Unsupported home command type: ${String(candidate.type ?? "unknown")}`,
	);
}

export function projectHomeView(context: HomeContext) {
	return {
		lights: { ...context.lights },
		thermostat: { ...context.thermostat },
		blinds: { ...context.blinds },
		locks: { ...context.locks },
		activeScene: context.activeScene,
		pendingScene: context.pendingScene,
		lightsOn: ROOMS.filter((room) => context.lights[room]),
		allDoorsLocked: DOORS.every((door) => context.locks[door]),
	};
}

type HomeCommandSender = (message: HomeCommand) => void | Promise<void>;

export function createHomeCommands(
	command: CommandHelper,
	sendHomeCommand: HomeCommandSender,
) {
	return {
		toggleLight: command(
			({ room, on }: { room: Room; on: boolean }) =>
				sendHomeCommand({ type: "TOGGLE_LIGHT", room, on }),
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
				sendHomeCommand({ type: "SET_THERMOSTAT", room, temp }),
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
				sendHomeCommand({ type: "SET_BLINDS", room, percent }),
			{
				description: "Set how far a room's blinds are open (0–100%).",
				input: command.object({
					room: command.enum(ROOMS),
					percent: command.number({ minimum: 0, maximum: 100 }),
				}),
			},
		),
		lockDoor: command(
			(door: Door) => sendHomeCommand({ type: "SET_LOCK", door, locked: true }),
			{
				description: "Lock a door.",
				input: command.enum(DOORS, {
					description: "Door id to lock: front, back, or garage.",
				}),
			},
		),
		unlockDoor: command(
			(door: Door) =>
				sendHomeCommand({ type: "SET_LOCK", door, locked: false }),
			{
				description: "Unlock a door.",
				input: command.enum(DOORS, {
					description: "Door id to unlock: front, back, or garage.",
				}),
			},
		),
		runScene: command(
			(scene: Scene) => sendHomeCommand({ type: "RUN_SCENE", scene }),
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
			(rooms: Room[]) => sendHomeCommand({ type: "DIM_ROOMS", rooms }),
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
			(scene: Scene) =>
				sendHomeCommand({ type: "START_SCENE_TRANSITION", scene }),
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
	};
}

type HomeRuntimeCommands = ReturnType<typeof createHomeCommands>;

type HomeRuntimeEvents = {
	readonly "light-changed": {
		readonly __payload?: { room: Room; on: boolean };
	};
	readonly "scene-applied": { readonly __payload?: { scene: Scene } };
	readonly "security-changed": {
		readonly __payload?: { allDoorsLocked: boolean };
	};
};

type HomeRuntimeView = ReturnType<typeof projectHomeView>;

const homeMachine = setup({
	types: {
		context: {} as HomeContext,
		events: {} as HomeCommand,
	},
}).createMachine({
	id: "smart-home",
	context: () => createInitialHomeContext(),
	initial: "active",
	states: {
		active: {
			on: {
				TOGGLE_LIGHT: {
					actions: assign(({ context, event }) =>
						reduceHomeContext(context, event),
					),
				},
				SET_THERMOSTAT: {
					actions: assign(({ context, event }) =>
						reduceHomeContext(context, event),
					),
				},
				SET_BLINDS: {
					actions: assign(({ context, event }) =>
						reduceHomeContext(context, event),
					),
				},
				SET_LOCK: {
					actions: assign(({ context, event }) =>
						reduceHomeContext(context, event),
					),
				},
				DIM_ROOMS: {
					actions: assign(({ context, event }) =>
						reduceHomeContext(context, event),
					),
				},
				RUN_SCENE: {
					actions: assign(({ context, event }) =>
						reduceHomeContext(context, event),
					),
				},
				START_SCENE_TRANSITION: {
					target: "settlingScene",
					actions: assign(({ context, event }) =>
						reduceHomeContext(context, event),
					),
				},
			},
		},
		settlingScene: {
			on: {
				TOGGLE_LIGHT: {
					actions: assign(({ context, event }) =>
						reduceHomeContext(context, event),
					),
				},
				SET_THERMOSTAT: {
					actions: assign(({ context, event }) =>
						reduceHomeContext(context, event),
					),
				},
				SET_BLINDS: {
					actions: assign(({ context, event }) =>
						reduceHomeContext(context, event),
					),
				},
				SET_LOCK: {
					actions: assign(({ context, event }) =>
						reduceHomeContext(context, event),
					),
				},
				DIM_ROOMS: {
					actions: assign(({ context, event }) =>
						reduceHomeContext(context, event),
					),
				},
				RUN_SCENE: {
					target: "active",
					actions: assign(({ context, event }) =>
						reduceHomeContext(context, event),
					),
				},
				START_SCENE_TRANSITION: {
					target: "settlingScene",
					reenter: true,
					actions: assign(({ context, event }) =>
						reduceHomeContext(context, event),
					),
				},
				APPLY_PENDING_SCENE: {
					target: "active",
					actions: assign(({ context }) =>
						reduceHomeContext(context, { type: "APPLY_PENDING_SCENE" }),
					),
				},
			},
			after: {
				[SCENE_TRANSITION_DELAY_MS]: {
					target: "active",
					actions: assign(({ context }) =>
						reduceHomeContext(context, { type: "APPLY_PENDING_SCENE" }),
					),
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
	return createHomeFromSource(homeMachine);
}

type HomeActor = ReturnType<typeof createActor<typeof homeMachine>>;

function createHomeFromSource(source: typeof homeMachine | HomeActor) {
	return igniteCore({
		source,
		events: (event) => ({
			"light-changed": event<{ room: Room; on: boolean }>(),
			"scene-applied": event<{ scene: Scene }>(),
			"security-changed": event<{ allDoorsLocked: boolean }>(),
		}),
		view: ({ snapshot }) => projectHomeView(snapshot.context),
		commands: ({ actor, command }) =>
			createHomeCommands(command, (message) => actor.send(message)),
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

export type HomeAgentRuntime = IgniteToolsRuntime<
	unknown,
	HomeRuntimeCommands,
	HomeRuntimeEvents,
	unknown,
	HomeRuntimeView
>;

export type HomeRuntimeSession = {
	home: HomeAgentRuntime;
	close(): Promise<void>;
};

export type HomeRuntimeFactory = () =>
	| HomeRuntimeSession
	| Promise<HomeRuntimeSession>;

export function createLocalHomeSession(): HomeRuntimeSession {
	const actor = createActor(homeMachine).start();
	const home = createHomeFromSource(actor);
	return {
		home,
		close: async () => {
			actor.stop();
		},
	};
}

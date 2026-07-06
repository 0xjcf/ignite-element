import {
	actor,
	defineActorWebTopology,
	defineBehavior,
	node,
	startRuntime,
} from "@actor-web/runtime";
import { igniteCore } from "ignite-element/actor-web";
import {
	applyScene,
	createLocalHomeSession,
	DOORS,
	type Door,
	dimRooms,
	type HomeCommand,
	type HomeContext,
	type HomeRuntimeSession,
	initialHomeContext,
	projectHomeView,
	ROOMS,
	type Room,
	SCENE_TRANSITION_DELAY_MS,
	SCENES,
	type Scene,
} from "./home";

type HomeActorEmitted =
	| { type: "light-changed"; room: Room; on: boolean }
	| { type: "scene-applied"; scene: Scene }
	| { type: "security-changed"; allDoorsLocked: boolean };

type TransitionScheduler = () => void;

export async function createActorWebHomeSession(): Promise<HomeRuntimeSession> {
	const pendingTransitionTimers = new Set<ReturnType<typeof setTimeout>>();
	const clearPendingTransitionTimers = () => {
		for (const timer of pendingTransitionTimers) {
			clearTimeout(timer);
		}
		pendingTransitionTimers.clear();
	};
	let sendAndFlush: (message: HomeCommand) => Promise<void> = async () => {
		throw new Error("Actor-web home session is not ready.");
	};
	const homeTopology = createHomeTopology(() => {
		clearPendingTransitionTimers();
		const timer = setTimeout(() => {
			pendingTransitionTimers.delete(timer);
			void sendAndFlush({ type: "APPLY_PENDING_SCENE" });
		}, SCENE_TRANSITION_DELAY_MS);
		pendingTransitionTimers.add(timer);
	});
	const runtime = await startRuntime(homeTopology);
	const sourceHandle = runtime.topology.source("home")({
		host: new EventTarget(),
	});
	sendAndFlush = async (message: HomeCommand) => {
		await sourceHandle.commandSource.send(message);
		await runtime.nodes.local?.system.flush();
	};
	const home = igniteCore({
		source: sourceHandle.commandSource,
		view: ({ context }) => projectHomeView(context),
		commands: ({ command }) => ({
			toggleLight: command(
				({ room, on }: { room: Room; on: boolean }) =>
					sendAndFlush({ type: "TOGGLE_LIGHT", room, on }),
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
					sendAndFlush({ type: "SET_THERMOSTAT", room, temp }),
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
					sendAndFlush({ type: "SET_BLINDS", room, percent }),
				{
					description: "Set how far a room's blinds are open (0–100%).",
					input: command.object({
						room: command.enum(ROOMS),
						percent: command.number({ minimum: 0, maximum: 100 }),
					}),
				},
			),
			lockDoor: command(
				(door: Door) => sendAndFlush({ type: "SET_LOCK", door, locked: true }),
				{
					description: "Lock a door.",
					input: command.enum(DOORS, {
						description: "Door id to lock: front, back, or garage.",
					}),
				},
			),
			unlockDoor: command(
				(door: Door) => sendAndFlush({ type: "SET_LOCK", door, locked: false }),
				{
					description: "Unlock a door.",
					input: command.enum(DOORS, {
						description: "Door id to unlock: front, back, or garage.",
					}),
				},
			),
			runScene: command(
				(scene: Scene) => sendAndFlush({ type: "RUN_SCENE", scene }),
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
				(rooms: Room[]) => sendAndFlush({ type: "DIM_ROOMS", rooms }),
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
					sendAndFlush({ type: "START_SCENE_TRANSITION", scene }),
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
					// No-op: callers read the current view from the command result.
				},
				{ description: "Read the current home state (no change)." },
			),
		}),
	});

	return {
		home,
		close: async () => {
			clearPendingTransitionTimers();
			await sourceHandle.stop();
			await runtime.stop();
		},
	};
}

export function createDefaultHomeSession(options?: { actorWeb?: boolean }) {
	if (options?.actorWeb) {
		return createActorWebHomeSession();
	}
	return createLocalHomeSession();
}

function createHomeTopology(scheduleTransition: TransitionScheduler) {
	return defineActorWebTopology({
		nodes: {
			local: node("smart-home-local-runtime"),
		},
		actors: {
			home: actor({
				id: "smart-home",
				node: "local",
				behavior: () => createActorWebHomeBehavior(scheduleTransition),
			}),
		},
	});
}

function createActorWebHomeBehavior(scheduleTransition: TransitionScheduler) {
	return defineBehavior<HomeCommand, HomeActorEmitted>()
		.withContext(initialHomeContext)
		.onMessage(({ context, message }) => {
			switch (message.type) {
				case "TOGGLE_LIGHT":
					return updateContext(context, {
						...context,
						lights: {
							...context.lights,
							[message.room]: message.on,
						},
						activeScene:
							context.lights[message.room] === message.on
								? context.activeScene
								: null,
					});
				case "SET_THERMOSTAT":
					return updateContext(context, {
						...context,
						thermostat: {
							...context.thermostat,
							[message.room]: message.temp,
						},
						activeScene:
							context.thermostat[message.room] === message.temp
								? context.activeScene
								: null,
					});
				case "SET_BLINDS":
					return updateContext(context, {
						...context,
						blinds: {
							...context.blinds,
							[message.room]: message.percent,
						},
						activeScene:
							context.blinds[message.room] === message.percent
								? context.activeScene
								: null,
					});
				case "SET_LOCK":
					return updateContext(context, {
						...context,
						locks: {
							...context.locks,
							[message.door]: message.locked,
						},
						activeScene:
							context.locks[message.door] === message.locked
								? context.activeScene
								: null,
					});
				case "DIM_ROOMS":
					return updateContext(context, dimRooms(context, message.rooms));
				case "RUN_SCENE":
					return updateContext(context, applyScene(context, message.scene));
				case "START_SCENE_TRANSITION":
					scheduleTransition();
					return {
						context: {
							...context,
							pendingScene: message.scene,
						},
					};
				case "APPLY_PENDING_SCENE": {
					const scene = context.pendingScene;
					if (!scene) {
						return { context: { ...context, pendingScene: null } };
					}

					return updateContext(context, {
						...applyScene(context, scene),
						pendingScene: null,
					});
				}
			}
		})
		.build();
}

function updateContext(previous: HomeContext, next: HomeContext) {
	return {
		context: next,
		emit: deriveEmittedEvents(previous, next),
	};
}

function deriveEmittedEvents(
	previous: HomeContext,
	next: HomeContext,
): HomeActorEmitted[] {
	const events: HomeActorEmitted[] = [];

	for (const room of ROOMS) {
		if (previous.lights[room] !== next.lights[room]) {
			events.push({ type: "light-changed", room, on: next.lights[room] });
		}
	}

	if (previous.activeScene !== next.activeScene && next.activeScene) {
		events.push({ type: "scene-applied", scene: next.activeScene });
	}

	const allDoorsLockedBefore = DOORS.every((door) => previous.locks[door]);
	const allDoorsLockedAfter = DOORS.every((door) => next.locks[door]);
	if (allDoorsLockedBefore !== allDoorsLockedAfter) {
		events.push({
			type: "security-changed",
			allDoorsLocked: allDoorsLockedAfter,
		});
	}

	return events;
}

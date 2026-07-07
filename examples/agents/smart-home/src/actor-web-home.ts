import {
	actor,
	defineActorWebTopology,
	defineBehavior,
	node,
	startRuntime,
} from "@actor-web/runtime";
import {
	type ActorWebCommandSource,
	igniteCore,
} from "ignite-element/actor-web";
import {
	createLocalHomeSession,
	createHomeCommands,
	DOORS,
	type HomeCommand,
	type HomeContext,
	type HomeRuntimeSession,
	initialHomeContext,
	projectHomeView,
	reduceHomeContext,
	ROOMS,
	type Room,
	SCENE_TRANSITION_DELAY_MS,
	type Scene,
} from "./home";

type HomeActorEmitted =
	| { type: "light-changed"; room: Room; on: boolean }
	| { type: "scene-applied"; scene: Scene }
	| { type: "security-changed"; allDoorsLocked: boolean };

type TransitionScheduler = () => void;

export async function createActorWebHomeSession(): Promise<HomeRuntimeSession> {
	const pendingTransitionTimers = new Set<ReturnType<typeof setTimeout>>();
	const pendingTransitionSends = new Set<Promise<void>>();
	const clearPendingTransitionTimers = () => {
		for (const timer of pendingTransitionTimers) {
			clearTimeout(timer);
		}
		pendingTransitionTimers.clear();
	};
	const waitForPendingTransitionSends = async () => {
		while (pendingTransitionSends.size > 0) {
			await Promise.allSettled([...pendingTransitionSends]);
		}
	};
	let closed = false;
	let sendAndFlush: (message: HomeCommand) => Promise<void> = async () => {
		throw new Error("Actor-web home session is not ready.");
	};
	const homeTopology = createHomeTopology(() => {
		if (closed) {
			return;
		}
		clearPendingTransitionTimers();
		const timer = setTimeout(() => {
			pendingTransitionTimers.delete(timer);
			if (closed) {
				return;
			}
			const pendingSend = sendAndFlush({ type: "APPLY_PENDING_SCENE" }).catch(
				(error) => {
					console.error("Failed to apply pending scene transition", error);
				},
			);
			pendingTransitionSends.add(pendingSend);
			void pendingSend.finally(() => {
				pendingTransitionSends.delete(pendingSend);
			});
		}, SCENE_TRANSITION_DELAY_MS);
		pendingTransitionTimers.add(timer);
	});
	const runtime = await startRuntime(homeTopology);
	let sourceHandle:
		| ReturnType<ReturnType<typeof runtime.topology.source>>
		| undefined;
	try {
		sourceHandle = runtime.topology.source("home")({
			host: new EventTarget(),
		});
		const commandSource = sourceHandle.commandSource as ActorWebCommandSource<
			HomeContext,
			HomeCommand,
			HomeActorEmitted
		>;
		sendAndFlush = async (message: HomeCommand) => {
			await commandSource.send(message);
			const localNode = runtime.nodes.local;
			if (!localNode) {
				throw new Error("Actor-web home runtime is missing the local node.");
			}
			await localNode.system.flush();
		};
		const home = igniteCore({
			source: commandSource,
			events: (event) => ({
				"light-changed": event<{ room: Room; on: boolean }>(),
				"scene-applied": event<{ scene: Scene }>(),
				"security-changed": event<{ allDoorsLocked: boolean }>(),
			}),
			view: ({ context }) => projectHomeView(context),
			commands: ({ command }) => createHomeCommands(command, sendAndFlush),
		});

		return {
			home,
			close: async () => {
				closed = true;
				clearPendingTransitionTimers();
				await waitForPendingTransitionSends();
				const errors: unknown[] = [];
				if (sourceHandle) {
					try {
						await sourceHandle.stop();
					} catch (error) {
						errors.push(error);
					}
				}
				try {
					await runtime.stop();
				} catch (error) {
					errors.push(error);
				}
				if (errors.length > 0) {
					const primary = errors[0];
					const cleanupError =
						primary instanceof Error ? primary : new Error(String(primary));
					if (errors.length > 1) {
						const errorWithSuppressed = cleanupError as Error & {
							suppressedErrors?: unknown[];
						};
						errorWithSuppressed.suppressedErrors = errors.slice(1);
					}
					throw cleanupError;
				}
			},
		};
	} catch (error) {
		closed = true;
		clearPendingTransitionTimers();
		if (sourceHandle) {
			await sourceHandle.stop().catch((cleanupError: unknown) => {
				console.error(
					"Failed to stop actor-web home source after setup failure",
					cleanupError,
				);
			});
		}
		try {
			await runtime.stop();
		} catch (cleanupError) {
			console.error(
				"Failed to stop actor-web home runtime after setup failure",
				cleanupError,
			);
		}
		throw error;
	}
}

export async function createDefaultHomeSession(options?: {
	actorWeb?: boolean;
}): Promise<HomeRuntimeSession> {
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
			if (message.type === "START_SCENE_TRANSITION") {
				scheduleTransition();
			}
			return updateContext(context, reduceHomeContext(context, message));
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

	for (const door of DOORS) {
		if (previous.locks[door] !== next.locks[door]) {
			events.push({
				type: "security-changed",
				allDoorsLocked: DOORS.every((item) => next.locks[item]),
			});
			break;
		}
	}

	return events;
}

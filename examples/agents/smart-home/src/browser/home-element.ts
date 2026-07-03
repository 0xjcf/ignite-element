import { jsx, jsxs } from "ignite-element/jsx/jsx-runtime";
import { igniteCore } from "ignite-element/xstate";
import { assign, createActor, setup } from "xstate";
import {
	applyBridgeMessage,
	createCommandMessage,
	createInitialBridgeState,
	type HomeBridgeMessage,
	type HomeBridgeState,
	parseBridgeMessage,
	serializeBridgeMessage,
} from "../bridge";
import {
	DOORS,
	type Door,
	ROOMS,
	type Room,
	SCENES,
	type Scene,
} from "../shared/home";

type BridgeMachineEvent =
	| { type: "SERVER_CONNECTING" }
	| { type: "SERVER_CONNECTED" }
	| { type: "SERVER_DISCONNECTED" }
	| { type: "SERVER_ERROR"; message: string }
	| { type: "BRIDGE_MESSAGE_ERROR"; message: string }
	| { type: "SERVER_MESSAGE"; message: HomeBridgeMessage };

const styles = `
:host {
	display: block;
	font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
	color: #17211f;
}
.shell {
	min-height: 100vh;
	background: #f6f7f1;
}
.topbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 1rem;
	padding: 1rem clamp(1rem, 3vw, 2rem);
	background: #16201d;
	color: #f8fbf3;
}
.brand {
	display: grid;
	gap: 0.15rem;
}
.brand strong {
	font-size: 1rem;
}
.brand span,
.status {
	color: #cbd7cf;
	font-size: 0.875rem;
}
.status {
	display: inline-flex;
	align-items: center;
	gap: 0.45rem;
	white-space: nowrap;
}
.dot {
	width: 0.65rem;
	height: 0.65rem;
	border-radius: 999px;
	background: #e85d75;
}
.dot.is-connected {
	background: #4fb477;
}
.content {
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(15rem, 20rem);
	gap: 1rem;
	padding: clamp(1rem, 3vw, 2rem);
}
.rooms,
.doors,
.scenes,
.timeline {
	background: #ffffff;
	border: 1px solid #d9dfd7;
	border-radius: 8px;
}
.rooms {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
	gap: 1rem;
	background: transparent;
	border: 0;
}
.room,
.side-section,
.timeline {
	padding: 1rem;
}
.room h2,
.side-section h2,
.timeline h2 {
	margin: 0 0 0.75rem;
	font-size: 1rem;
}
.room {
	background: #ffffff;
	border: 1px solid #d9dfd7;
	border-radius: 8px;
	min-width: 0;
}
.metrics {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 0.75rem;
	margin: 1rem 0;
}
.metric {
	background: #eef2ec;
	border-radius: 6px;
	padding: 0.65rem;
}
.metric span {
	display: block;
	color: #60716b;
	font-size: 0.75rem;
}
.metric strong {
	display: block;
	margin-top: 0.15rem;
	font-size: 1.1rem;
}
.actions,
.door-grid,
.scene-grid {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
}
.actions button {
	flex: 1 1 calc(50% - 0.5rem);
	min-width: 8rem;
}
button {
	border: 1px solid #a7b4ab;
	border-radius: 6px;
	background: #ffffff;
	color: #17211f;
	cursor: pointer;
	font: inherit;
	min-height: 2.25rem;
	padding: 0.45rem 0.7rem;
}
button:hover {
	background: #edf5ef;
}
button.primary {
	background: #245b44;
	border-color: #245b44;
	color: #ffffff;
}
.sidebar {
	display: grid;
	gap: 1rem;
	align-content: start;
}
.pill {
	display: inline-flex;
	border-radius: 999px;
	margin: 0 0 0.75rem;
	padding: 0.25rem 0.55rem;
	background: #e6eee9;
	color: #245b44;
	font-size: 0.75rem;
}
.side-section .pill {
	margin-bottom: 0.85rem;
}
.log {
	display: grid;
	gap: 0.45rem;
	margin: 0;
	padding: 0;
	list-style: none;
}
.log li {
	background: #f4f6f1;
	border-radius: 6px;
	padding: 0.5rem;
	font-size: 0.875rem;
}
.empty {
	padding: 2rem;
	color: #60716b;
}
.error {
	color: #a83449;
	font-size: 0.875rem;
	margin-top: 0.75rem;
}
@media (max-width: 860px) {
	.content,
	.rooms {
		grid-template-columns: 1fr;
	}
	.topbar {
		align-items: flex-start;
		flex-direction: column;
	}
}
`;

const bridgeMachine = setup({
	types: {
		context: {} as HomeBridgeState,
		events: {} as BridgeMachineEvent,
	},
}).createMachine({
	id: "smart-home-bridge-client",
	context: createInitialBridgeState(),
	on: {
		SERVER_CONNECTING: {
			actions: assign({
				connected: () => false,
				status: () => "connecting" as const,
				error: () => null,
			}),
		},
		SERVER_CONNECTED: {
			actions: assign({
				connected: () => true,
				status: () => "connected" as const,
				error: () => null,
			}),
		},
		SERVER_DISCONNECTED: {
			actions: assign({
				connected: () => false,
				status: () => "disconnected" as const,
			}),
		},
		SERVER_ERROR: {
			actions: assign({
				connected: () => false,
				status: () => "disconnected" as const,
				error: ({ event }) => event.message,
			}),
		},
		BRIDGE_MESSAGE_ERROR: {
			actions: assign({
				error: ({ event }) => event.message,
			}),
		},
		SERVER_MESSAGE: {
			actions: assign(({ context, event }) =>
				applyBridgeMessage(context, event.message),
			),
		},
	},
});

const bridgeActor = createActor(bridgeMachine).start();
let socket: WebSocket | undefined;
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let activeSocketToken = 0;
let bridgeUrl: string | undefined;

export function connectSmartHomeBridge(
	url = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/bridge`,
): void {
	bridgeUrl = url;
	if (
		socket &&
		(socket.readyState === WebSocket.OPEN ||
			socket.readyState === WebSocket.CONNECTING)
	) {
		return;
	}

	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = undefined;
	}
	detachSocket(socket);
	bridgeActor.send({ type: "SERVER_CONNECTING" });
	const currentSocket = new WebSocket(url);
	const socketToken = ++activeSocketToken;
	socket = currentSocket;

	currentSocket.onopen = () => {
		if (socketToken !== activeSocketToken) {
			return;
		}
		reconnectAttempt = 0;
		bridgeActor.send({ type: "SERVER_CONNECTED" });
	};
	currentSocket.onclose = () => {
		if (socketToken !== activeSocketToken) {
			return;
		}
		bridgeActor.send({ type: "SERVER_DISCONNECTED" });
		scheduleReconnect(url);
	};
	currentSocket.onerror = () => {
		if (socketToken !== activeSocketToken) {
			return;
		}
		bridgeActor.send({
			type: "SERVER_ERROR",
			message: "Browser bridge connection failed.",
		});
	};
	currentSocket.onmessage = (event) => {
		if (socketToken !== activeSocketToken) {
			return;
		}
		try {
			const message = parseBridgeMessage(String(event.data));
			if (message.type !== "home:command") {
				bridgeActor.send({ type: "SERVER_MESSAGE", message });
			}
		} catch (error) {
			bridgeActor.send({
				type: "BRIDGE_MESSAGE_ERROR",
				message: error instanceof Error ? error.message : String(error),
			});
		}
	};
}

function scheduleReconnect(url: string): void {
	if (reconnectTimer) {
		return;
	}
	const delay = Math.min(1000 * 2 ** reconnectAttempt, 15_000);
	reconnectAttempt++;
	reconnectTimer = setTimeout(() => {
		reconnectTimer = undefined;
		connectSmartHomeBridge(url);
	}, delay);
}

function detachSocket(target: WebSocket | undefined): void {
	if (!target) {
		return;
	}
	target.onopen = null;
	target.onclose = null;
	target.onerror = null;
	target.onmessage = null;
	if (
		target.readyState === WebSocket.OPEN ||
		target.readyState === WebSocket.CONNECTING
	) {
		target.close();
	}
}

function sendCommand(command: string, input?: unknown): void {
	if (!socket || socket.readyState !== WebSocket.OPEN) {
		bridgeActor.send({
			type: "SERVER_ERROR",
			message: "Bridge is not connected yet.",
		});
		return;
	}
	socket.send(serializeBridgeMessage(createCommandMessage(command, input)));
}

const registerHomeBridge = igniteCore({
	source: bridgeActor,
	cleanup: false,
	view: ({ snapshot }: { snapshot: { context: HomeBridgeState } }) =>
		snapshot.context,
	commands: () => ({
		toggleLight: ({ room, on }: { room: Room; on: boolean }) =>
			sendCommand("toggleLight", { room, on }),
		setThermostat: ({ room, temp }: { room: Room; temp: number }) =>
			sendCommand("setThermostat", { room, temp }),
		setBlinds: ({ room, percent }: { room: Room; percent: number }) =>
			sendCommand("setBlinds", { room, percent }),
		lockDoor: (door: Door) => sendCommand("lockDoor", door),
		unlockDoor: (door: Door) => sendCommand("unlockDoor", door),
		runScene: (scene: Scene) => sendCommand("runScene", scene),
	}),
});

registerHomeBridge("smart-home-bridge", (ctx) => {
	const view = ctx.view;
	const connectedLabel =
		ctx.status === "connected"
			? "Live bridge connected"
			: ctx.status === "connecting"
				? "Connecting"
				: "Disconnected";

	return jsxs("section", {
		class: "shell",
		children: [
			jsx("style", { children: styles }),
			jsxs("header", {
				class: "topbar",
				children: [
					jsxs("div", {
						class: "brand",
						children: [
							jsx("strong", { children: "Ignite smart home" }),
							jsx("span", {
								children: "Headless runtime, terminal agent, browser UI",
							}),
						],
					}),
					jsxs("div", {
						class: "status",
						children: [
							jsx("span", {
								class: ctx.connected ? "dot is-connected" : "dot",
							}),
							connectedLabel,
							ctx.status === "disconnected"
								? jsx("button", {
										type: "button",
										onClick: () => connectSmartHomeBridge(bridgeUrl),
										children: "Reconnect",
									})
								: null,
						],
					}),
				],
			}),
			view
				? jsxs("main", {
						class: "content",
						children: [
							jsx("div", {
								class: "rooms",
								children: ROOMS.map((room) => roomPanel(room, view, ctx)),
							}),
							jsxs("aside", {
								class: "sidebar",
								children: [
									scenesPanel(view, ctx.runScene),
									doorsPanel(view, ctx.lockDoor, ctx.unlockDoor),
									timelinePanel(ctx),
								],
							}),
						],
					})
				: jsx("main", {
						class: "empty",
						children: "Waiting for the shared headless smart-home runtime.",
					}),
		],
	});
});

function roomPanel(
	room: Room,
	view: NonNullable<HomeBridgeState["view"]>,
	ctx: HomeBridgeState & {
		toggleLight(payload: { room: Room; on: boolean }): void;
		setThermostat(payload: { room: Room; temp: number }): void;
		setBlinds(payload: { room: Room; percent: number }): void;
	},
) {
	const lightOn = view.lights[room];
	const temp = view.thermostat[room];
	const blinds = view.blinds[room];

	return jsxs("section", {
		class: "room",
		children: [
			jsx("h2", { children: title(room) }),
			jsxs("div", {
				class: "metrics",
				children: [
					metric("Light", lightOn ? "On" : "Off"),
					metric("Temp", `${temp} F`),
					metric("Blinds", `${blinds}%`),
					metric("Scene", view.activeScene ?? "Manual"),
				],
			}),
			jsxs("div", {
				class: "actions",
				children: [
					jsx("button", {
						class: lightOn ? "" : "primary",
						onClick: () => ctx.toggleLight({ room, on: !lightOn }),
						children: lightOn ? "Turn off" : "Turn on",
					}),
					jsx("button", {
						onClick: () => ctx.setThermostat({ room, temp: temp + 1 }),
						children: "Warmer",
					}),
					jsx("button", {
						onClick: () => ctx.setThermostat({ room, temp: temp - 1 }),
						children: "Cooler",
					}),
					jsx("button", {
						onClick: () =>
							ctx.setBlinds({ room, percent: blinds === 100 ? 0 : 100 }),
						children: blinds === 100 ? "Close blinds" : "Open blinds",
					}),
				],
			}),
		],
	});
}

function scenesPanel(
	view: NonNullable<HomeBridgeState["view"]>,
	runScene: (scene: Scene) => void,
) {
	return jsxs("section", {
		class: "side-section scenes",
		children: [
			jsx("h2", { children: "Scenes" }),
			view.pendingScene
				? jsx("span", {
						class: "pill",
						children: `Settling ${view.pendingScene}`,
					})
				: jsx("span", {
						class: "pill",
						children: view.activeScene ?? "Manual",
					}),
			jsx("div", {
				class: "scene-grid",
				children: SCENES.map((scene) =>
					jsx("button", {
						class: scene === view.activeScene ? "primary" : "",
						onClick: () => runScene(scene),
						children: title(scene),
					}),
				),
			}),
		],
	});
}

function doorsPanel(
	view: NonNullable<HomeBridgeState["view"]>,
	lockDoor: (door: Door) => void,
	unlockDoor: (door: Door) => void,
) {
	return jsxs("section", {
		class: "side-section doors",
		children: [
			jsx("h2", { children: "Security" }),
			jsx("span", {
				class: "pill",
				children: view.allDoorsLocked ? "All locked" : "Door unlocked",
			}),
			jsx("div", {
				class: "door-grid",
				children: DOORS.map((door) =>
					jsx("button", {
						onClick: () =>
							view.locks[door] ? unlockDoor(door) : lockDoor(door),
						children: `${title(door)}: ${view.locks[door] ? "Locked" : "Unlocked"}`,
					}),
				),
			}),
		],
	});
}

function timelinePanel(ctx: HomeBridgeState) {
	return jsxs("section", {
		class: "timeline",
		children: [
			jsx("h2", { children: "Bridge log" }),
			ctx.error
				? jsx("p", { class: "error", role: "alert", children: ctx.error })
				: null,
			ctx.lastEvent
				? jsx("span", {
						class: "pill",
						children: `Last event: ${ctx.lastEvent.type}`,
					})
				: null,
			jsx("ul", {
				class: "log",
				children: ctx.log.length
					? ctx.log.map((entry) => jsx("li", { children: entry }))
					: [jsx("li", { children: "No runtime events yet." })],
			}),
		],
	});
}

function metric(label: string, value: string) {
	return jsxs("div", {
		class: "metric",
		children: [
			jsx("span", { children: label }),
			jsx("strong", { children: value }),
		],
	});
}

function title(value: string): string {
	return value
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

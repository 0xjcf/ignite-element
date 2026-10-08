import { igniteCore } from "ignite-element/xstate";
import { assign, enqueueActions, setup } from "xstate";
import type { ManifestSource } from "../manifest/schema";
import type { Clock } from "../ports/clock";
import {
	DEVTOOLS_MESSAGE_VERSION,
	type RuntimeConnection,
} from "../ports/connection";
import {
	DEVTOOLS_CONNECTION_STORAGE_KEY,
	type DevtoolsStorage,
} from "../ports/storage";

export type ConnectionPorts = {
	connection: RuntimeConnection;
	storage: DevtoolsStorage;
	clock: Clock;
};

export type ConnectionPhase =
	| "disconnected"
	| "connecting"
	| "connected.live"
	| "connected.paused"
	| "error";

export type ConnectionStates = {
	phase: ConnectionPhase;
	runtimeId: string | null;
	error: string | null;
	canConnect: boolean;
	canPause: boolean;
	canResume: boolean;
	canDisconnect: boolean;
	isLive: boolean;
	showReconnectBanner: boolean;
};

type ConnectionContext = {
	runtimeId?: string;
	error?: string;
	linked: boolean;
};

type ConnectionEvent =
	| { type: "CONNECT"; runtimeId: string }
	| { type: "CONNECTED" }
	| { type: "FAILED"; message: string }
	| { type: "PAUSE" }
	| { type: "RESUME" }
	| { type: "DISCONNECT" };

export const connectionManifestSource = {
	id: "connection",
	adapter: "xstate",
	declaredStates: [
		"disconnected",
		"connecting",
		"connected.live",
		"connected.paused",
		"error",
	],
	flags: [
		{ name: "canConnect", kind: "can" },
		{ name: "canPause", kind: "can" },
		{ name: "canResume", kind: "can" },
		{ name: "canDisconnect", kind: "can" },
		{ name: "isLive", kind: "is" },
		{ name: "showReconnectBanner", kind: "show" },
	],
	commands: [
		{
			name: "connect",
			nativeEvent: "CONNECT",
			flag: "canConnect",
			port: "connection",
		},
		{ name: "pause", nativeEvent: "PAUSE", flag: "canPause" },
		{ name: "resume", nativeEvent: "RESUME", flag: "canResume" },
		{
			name: "disconnect",
			nativeEvent: "DISCONNECT",
			flag: "canDisconnect",
			port: "connection",
		},
	],
	events: [],
	ports: ["connection", "storage", "clock"],
	hosts: ["headless"],
} satisfies ManifestSource;

const connectionMachine = setup({
	types: {
		context: {} as ConnectionContext,
		events: {} as ConnectionEvent,
	},
	actions: {
		openLink: () => {},
		recordPhase: () => {},
		closeLink: () => {},
		clearSession: assign({
			runtimeId: () => undefined,
			error: () => undefined,
			linked: () => false,
		}),
	},
}).createMachine({
	id: "devtools-connection",
	context: { linked: false },
	initial: "disconnected",
	states: {
		disconnected: {
			entry: "recordPhase",
			on: {
				CONNECT: {
					guard: ({ event }) => event.runtimeId.length > 0,
					target: "connecting",
					actions: assign({
						runtimeId: ({ event }) => event.runtimeId,
						error: () => undefined,
						linked: () => false,
					}),
				},
			},
		},
		connecting: {
			entry: ["openLink", "recordPhase"],
			on: {
				CONNECTED: {
					target: "connected",
					actions: assign({
						linked: () => true,
						error: () => undefined,
					}),
				},
				FAILED: {
					target: "error",
					actions: assign({
						error: ({ event }) => event.message,
						linked: () => false,
					}),
				},
				DISCONNECT: {
					target: "disconnected",
					actions: ["closeLink", "clearSession"],
				},
			},
		},
		connected: {
			initial: "live",
			states: {
				live: {
					entry: "recordPhase",
					on: { PAUSE: "paused" },
				},
				paused: {
					entry: "recordPhase",
					on: { RESUME: "live" },
				},
			},
			on: {
				DISCONNECT: {
					target: "disconnected",
					actions: ["closeLink", "clearSession"],
				},
				FAILED: {
					target: "error",
					actions: assign({
						error: ({ event }) => event.message,
						linked: () => false,
					}),
				},
			},
		},
		error: {
			entry: "recordPhase",
			on: {
				CONNECT: {
					guard: ({ event }) => event.runtimeId.length > 0,
					target: "connecting",
					actions: assign({
						runtimeId: ({ event }) => event.runtimeId,
						error: () => undefined,
						linked: () => false,
					}),
				},
				DISCONNECT: {
					target: "disconnected",
					actions: ["closeLink", "clearSession"],
				},
			},
		},
	},
});

function phaseFromValue(value: unknown): ConnectionPhase {
	if (value === "disconnected" || value === "connecting" || value === "error") {
		return value;
	}
	if (isConnectedValue(value)) {
		return value.connected === "live" ? "connected.live" : "connected.paused";
	}
	return "disconnected";
}

function isConnectedValue(
	value: unknown,
): value is { connected: "live" | "paused" } {
	if (typeof value !== "object" || value === null || !("connected" in value)) {
		return false;
	}
	return value.connected === "live" || value.connected === "paused";
}

function recordPhase(
	ports: ConnectionPorts,
	value: unknown,
	context: ConnectionContext,
) {
	ports.storage.set(
		DEVTOOLS_CONNECTION_STORAGE_KEY,
		JSON.stringify({
			runtimeId: context.runtimeId ?? null,
			phase: phaseFromValue(value),
			error: context.error ?? null,
			at: ports.clock.now(),
			seq: ports.clock.seq(),
		}),
	);
}

/**
 * Ports are closed over by XState `.provide()`.
 * `igniteCore` receives only the provided machine.
 */
export function createConnectionMachine(ports: ConnectionPorts) {
	return connectionMachine.provide({
		actions: {
			openLink: enqueueActions(({ context, enqueue }) => {
				const runtimeId = context.runtimeId;
				if (!runtimeId) {
					enqueue.raise({
						type: "FAILED",
						message: "runtime id is required",
					});
					return;
				}
				try {
					ports.connection.connect(runtimeId);
					ports.connection.send({
						v: DEVTOOLS_MESSAGE_VERSION,
						seq: ports.clock.seq(),
						runtimeId,
						at: ports.clock.now(),
						surface: "headless",
						kind: "hello",
						payload: null,
					});
					enqueue.raise({ type: "CONNECTED" });
				} catch (error) {
					enqueue.raise({
						type: "FAILED",
						message: error instanceof Error ? error.message : String(error),
					});
				}
			}),
			recordPhase: ({ self }) => {
				const snapshot = self.getSnapshot();
				recordPhase(ports, snapshot.value, snapshot.context);
			},
			closeLink: ({ context }) => {
				if (!context.linked || !context.runtimeId) return;
				ports.connection.send({
					v: DEVTOOLS_MESSAGE_VERSION,
					seq: ports.clock.seq(),
					runtimeId: context.runtimeId,
					at: ports.clock.now(),
					surface: "headless",
					kind: "bye",
					payload: null,
				});
			},
		},
	});
}

export function createConnectionCore(ports: ConnectionPorts) {
	return igniteCore({
		source: createConnectionMachine(ports),
		states: (snapshot): ConnectionStates => ({
			phase: phaseFromValue(snapshot.value),
			runtimeId: snapshot.context.runtimeId ?? null,
			error: snapshot.context.error ?? null,
			canConnect: snapshot.can({ type: "CONNECT", runtimeId: "runtime" }),
			canPause: snapshot.can({ type: "PAUSE" }),
			canResume: snapshot.can({ type: "RESUME" }),
			canDisconnect: snapshot.can({ type: "DISCONNECT" }),
			isLive: snapshot.matches({ connected: "live" }),
			showReconnectBanner: snapshot.matches("error"),
		}),
		commands: ({ source }) => ({
			connect: (runtimeId: string) => {
				source.send({ type: "CONNECT", runtimeId });
			},
			pause: () => {
				source.send({ type: "PAUSE" });
			},
			resume: () => {
				source.send({ type: "RESUME" });
			},
			disconnect: () => {
				source.send({ type: "DISCONNECT" });
			},
		}),
	});
}

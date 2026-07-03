import type { HomeView } from "./render";

export type HomeBridgeEvent = {
	type: string;
	payload?: unknown;
};

export type HomeBridgeMessage =
	| { type: "home:view"; view: HomeView }
	| { type: "home:event"; event: HomeBridgeEvent; view: HomeView }
	| { type: "home:command-result"; command: string; ok: true; view: HomeView }
	| {
			type: "home:error";
			command?: string;
			message: string;
			view?: HomeView;
	  };

export type HomeCommandMessage = {
	type: "home:command";
	command: string;
	input?: unknown;
};

export type HomeBridgeClientMessage = HomeBridgeMessage | HomeCommandMessage;

export type HomeBridgeState = {
	connected: boolean;
	status: "connecting" | "connected" | "disconnected";
	view: HomeView | null;
	lastEvent: HomeBridgeEvent | null;
	lastCommand: string | null;
	error: string | null;
	log: string[];
};

export function createInitialBridgeState(): HomeBridgeState {
	return {
		connected: false,
		status: "connecting",
		view: null,
		lastEvent: null,
		lastCommand: null,
		error: null,
		log: [],
	};
}

export function createCommandMessage(
	command: string,
	input?: unknown,
): HomeCommandMessage {
	return { type: "home:command", command, input };
}

export function applyBridgeMessage(
	state: HomeBridgeState | undefined,
	message: HomeBridgeMessage,
): HomeBridgeState {
	const previous = state ?? createInitialBridgeState();
	const log = [...previous.log, describeBridgeMessage(message)].slice(-12);

	switch (message.type) {
		case "home:view":
			return {
				...previous,
				connected: true,
				status: "connected",
				view: message.view,
				error: null,
				log,
			};
		case "home:event":
			return {
				...previous,
				connected: true,
				status: "connected",
				view: message.view,
				lastEvent: message.event,
				error: null,
				log,
			};
		case "home:command-result":
			return {
				...previous,
				connected: true,
				status: "connected",
				view: message.view,
				lastCommand: message.command,
				error: null,
				log,
			};
		case "home:error":
			return {
				...previous,
				connected: true,
				status: "connected",
				view: message.view ?? previous.view,
				lastCommand: message.command ?? previous.lastCommand,
				error: message.message,
				log,
			};
	}
}

export function serializeBridgeMessage(
	message: HomeBridgeClientMessage,
): string {
	return JSON.stringify(message);
}

export function parseBridgeMessage(payload: string): HomeBridgeClientMessage {
	const value: unknown = JSON.parse(payload);
	if (!isBridgeMessage(value)) {
		throw new Error("Unsupported smart-home bridge message");
	}
	return value;
}

function describeBridgeMessage(message: HomeBridgeMessage): string {
	switch (message.type) {
		case "home:view":
			return "Synced browser view";
		case "home:event":
			return `Runtime event: ${message.event.type}`;
		case "home:command-result":
			return `Command accepted: ${message.command}`;
		case "home:error":
			return message.command
				? `Command rejected: ${message.command}`
				: `Bridge error: ${message.message}`;
	}
}

function isBridgeMessage(value: unknown): value is HomeBridgeClientMessage {
	if (!value || typeof value !== "object") {
		return false;
	}
	const message = value as Record<string, unknown>;
	switch (message.type) {
		case "home:view":
			return isRecord(message.view);
		case "home:event":
			return (
				isRecord(message.event) &&
				typeof message.event.type === "string" &&
				isRecord(message.view)
			);
		case "home:command-result":
			return typeof message.command === "string" && isRecord(message.view);
		case "home:error":
			return (
				typeof message.message === "string" &&
				(message.command === undefined ||
					typeof message.command === "string") &&
				(message.view === undefined || isRecord(message.view))
			);
		case "home:command":
			return typeof message.command === "string";
		default:
			return false;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

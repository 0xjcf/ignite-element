// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import {
	createCommandMessage,
	type HomeBridgeClientMessage,
	parseBridgeMessage,
	serializeBridgeMessage,
} from "./bridge";
import {
	type SmartHomeBridgeServer,
	startSmartHomeBridgeServer,
} from "./server";

let server: SmartHomeBridgeServer | undefined;

afterEach(async () => {
	await server?.close();
	server = undefined;
});

describe("smart-home bridge server", () => {
	it("routes browser commands into the shared headless runtime", async () => {
		server = await startSmartHomeBridgeServer({ port: 0, runAgent: false });
		const socket = new WebSocket(`ws://127.0.0.1:${server.port}/bridge`);
		const messages = collectMessages(socket);

		await opened(socket);
		const initial = await messages.next("home:view");
		expect(initial.view.lights.kitchen).toBe(false);

		socket.send(
			serializeBridgeMessage(
				createCommandMessage("toggleLight", { room: "kitchen", on: true }),
			),
		);

		const result = await messages.next("home:command-result");
		expect(result.command).toBe("toggleLight");
		expect(result.view.lights.kitchen).toBe(true);

		socket.close();
	});
});

function collectMessages(socket: WebSocket) {
	const queued: HomeBridgeClientMessage[] = [];
	const waiters: Array<() => void> = [];

	socket.on("message", (payload) => {
		queued.push(parseBridgeMessage(String(payload)));
		for (const resolve of waiters.splice(0)) {
			resolve();
		}
	});

	return {
		async next<Type extends HomeBridgeClientMessage["type"]>(
			type: Type,
		): Promise<Extract<HomeBridgeClientMessage, { type: Type }>> {
			while (true) {
				const index = queued.findIndex((message) => message.type === type);
				if (index >= 0) {
					const [message] = queued.splice(index, 1);
					return message as Extract<HomeBridgeClientMessage, { type: Type }>;
				}
				await new Promise<void>((resolve) => waiters.push(resolve));
			}
		},
	};
}

function opened(socket: WebSocket): Promise<void> {
	return new Promise((resolve, reject) => {
		socket.once("open", () => resolve());
		socket.once("error", reject);
	});
}

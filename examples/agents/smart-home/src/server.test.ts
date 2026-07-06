// @vitest-environment node

import type { OpenAIChatCompletionResponse } from "ignite-element/tools/openai";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { createActorWebHomeSession } from "./actor-web-home";
import {
	createCommandMessage,
	type HomeBridgeClientMessage,
	parseBridgeMessage,
	serializeBridgeMessage,
} from "./bridge";
import {
	parseTerminalCommand,
	type SmartHomeBridgeServer,
	startSmartHomeBridgeServer,
} from "./server";
import { createLocalHomeSession, type HomeAgentRuntime } from "./shared/home";

let server: SmartHomeBridgeServer | undefined;

afterEach(async () => {
	await server?.close();
	server = undefined;
});

describe("smart-home bridge server", () => {
	it("parses terminal commands for the shared runtime", () => {
		expect(parseTerminalCommand("scene away")).toEqual({
			type: "command",
			command: "runScene",
			input: "away",
		});
		expect(parseTerminalCommand("light kitchen on")).toEqual({
			type: "command",
			command: "toggleLight",
			input: { room: "kitchen", on: true },
		});
		expect(parseTerminalCommand("temp bedroom 72")).toEqual({
			type: "command",
			command: "setThermostat",
			input: { room: "bedroom", temp: 72 },
		});
		expect(parseTerminalCommand("dim living bedroom")).toEqual({
			type: "command",
			command: "dimRooms",
			input: ["living", "bedroom"],
		});
		expect(parseTerminalCommand("help")).toEqual({ type: "help" });
		expect(parseTerminalCommand("quit")).toEqual({ type: "exit" });
	});

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

	it("can let an OpenAI-compatible model drive the shared browser runtime", async () => {
		const script: OpenAIChatCompletionResponse[] = [
			{
				choices: [
					{
						message: {
							tool_calls: [
								{
									id: "mlx-bridge-1",
									type: "function",
									function: {
										name: "toggleLight",
										arguments: JSON.stringify({ room: "kitchen", on: true }),
									},
								},
							],
						},
					},
				],
			},
			{ choices: [{ message: { content: "Kitchen light is on." } }] },
		];
		let turn = 0;
		server = await startSmartHomeBridgeServer({
			port: 0,
			openAIModel: async () => {
				const response = script[turn++];
				if (!response) {
					throw new Error("OpenAI-compatible bridge script exhausted");
				}
				return response;
			},
		});
		const socket = new WebSocket(`ws://127.0.0.1:${server.port}/bridge`);
		const messages = collectMessages(socket);

		await opened(socket);
		await messages.next("home:view");
		const result = await messages.next("home:command-result");

		expect(result.command).toBe("toggleLight");
		expect(result.view.lights.kitchen).toBe(true);

		socket.close();
	});

	it("waits for an in-flight OpenAI-compatible agent run before closing", async () => {
		let resolveModel:
			| ((response: OpenAIChatCompletionResponse) => void)
			| undefined;
		let modelStarted: (() => void) | undefined;
		const started = new Promise<void>((resolve) => {
			modelStarted = resolve;
		});
		const modelResponse = new Promise<OpenAIChatCompletionResponse>(
			(resolve) => {
				resolveModel = resolve;
			},
		);

		server = await startSmartHomeBridgeServer({
			port: 0,
			openAIModel: async () => {
				modelStarted?.();
				return await modelResponse;
			},
		});
		const socket = new WebSocket(`ws://127.0.0.1:${server.port}/bridge`);

		await opened(socket);
		await started;

		let closed = false;
		const closePromise = server.close().then(() => {
			closed = true;
		});
		await delay(20);
		expect(closed).toBe(false);

		resolveModel?.({ choices: [{ message: { content: "Done." } }] });
		await closePromise;
		server = undefined;
		socket.close();
		expect(closed).toBe(true);
	});

	it("routes browser commands into the actor-web-backed shared runtime when runtimeFactory is injected", async () => {
		server = await startSmartHomeBridgeServer({
			port: 0,
			runAgent: false,
			runtimeFactory: createActorWebHomeSession,
		});
		const socket = new WebSocket(`ws://127.0.0.1:${server.port}/bridge`);
		const messages = collectMessages(socket);

		await opened(socket);
		await messages.next("home:view");

		socket.send(
			serializeBridgeMessage(createCommandMessage("runScene", "movie")),
		);

		const result = await messages.next("home:command-result");
		expect(result.command).toBe("runScene");
		expect(result.view).toMatchObject({
			activeScene: "movie",
			lights: { living: false },
		});

		socket.close();
	});

	it("closes an acquired runtime session when setup fails after acquisition", async () => {
		const session = createLocalHomeSession();
		let sessionClosed = false;

		await expect(
			startSmartHomeBridgeServer({
				port: 0,
				runAgent: false,
				runtimeFactory: () => ({
					home: undefined as unknown as HomeAgentRuntime,
					close: async () => {
						sessionClosed = true;
						await session.close();
					},
				}),
			}),
		).rejects.toThrow();
		try {
			expect(sessionClosed).toBe(true);
		} finally {
			if (!sessionClosed) {
				await session.close();
			}
		}
	});
});

function collectMessages(socket: WebSocket) {
	const queued: HomeBridgeClientMessage[] = [];
	const waiters: Array<{
		resolve(): void;
		reject(error: Error): void;
	}> = [];

	socket.on("message", (payload) => {
		queued.push(parseBridgeMessage(String(payload)));
		for (const waiter of waiters.splice(0)) {
			waiter.resolve();
		}
	});
	socket.on("close", () => {
		for (const waiter of waiters.splice(0)) {
			waiter.reject(new Error("smart-home bridge socket closed"));
		}
	});
	socket.on("error", (error) => {
		for (const waiter of waiters.splice(0)) {
			waiter.reject(error instanceof Error ? error : new Error(String(error)));
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
				await new Promise<void>((resolve, reject) =>
					waiters.push({ resolve, reject }),
				);
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

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

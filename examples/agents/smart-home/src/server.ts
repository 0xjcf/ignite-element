import { createServer as createHttpServer, type Server } from "node:http";
import { dirname, join } from "node:path";
import { createInterface, type Interface } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
	igniteTools,
	isOk,
	type NeutralToolCall,
	type NeutralToolResult,
	type Result,
	type ToolError,
	type ToolObservation,
} from "ignite-element/tools";
import {
	type AnthropicResponse,
	type AnthropicToolResultBlock,
	anthropic,
} from "ignite-element/tools/anthropic";
import {
	type OpenAIChatCompletionResponse,
	type OpenAIChatToolResultMessage,
	openai,
} from "ignite-element/tools/openai";
import type { ViteDevServer } from "vite";
import { createServer as createViteServer } from "vite";
import { WebSocket, WebSocketServer } from "ws";
import { createActorWebHomeSession } from "./actor-web-home";
import type { HomeBridgeClientMessage, HomeBridgeMessage } from "./bridge";
import { parseBridgeMessage, serializeBridgeMessage } from "./bridge";
import {
	assertOpenAIChatCompletionResponse,
	firstOpenAIChoiceResponse,
	type AnthropicMessage,
	type Model,
	type OpenAICompatibleMessage,
	type OpenAICompatibleModel,
	scriptedModel,
	toOpenAIAssistantMessage,
} from "./model";
import { renderHome } from "./render";
import type { HomeView } from "./render";
import {
	createLocalHomeSession,
	type HomeAgentRuntime,
	type HomeRuntimeFactory,
} from "./shared/home";

export type SmartHomeBridgeServer = {
	port: number;
	close(): Promise<void>;
};

type SharedHomeAgentTools = {
	tools: Parameters<Model>[0]["tools"];
	toolCalls(response: AnthropicResponse): NeutralToolCall[];
	run(
		call: NeutralToolCall,
	): Promise<Result<ToolObservation<unknown, HomeView>, ToolError>>;
	toolResult(
		result: NeutralToolResult<unknown, HomeView>,
	): AnthropicToolResultBlock;
};

type SharedHomeOpenAICompatibleAgentTools = {
	tools: Parameters<OpenAICompatibleModel>[0]["tools"];
	toolCalls(response: OpenAIChatCompletionResponse): NeutralToolCall[];
	run(
		call: NeutralToolCall,
	): Promise<Result<ToolObservation<unknown, HomeView>, ToolError>>;
	toolResult(
		result: NeutralToolResult<unknown, HomeView>,
	): OpenAIChatToolResultMessage;
};

type TerminalTools = {
	run(
		call: NeutralToolCall,
	): Promise<Result<ToolObservation<unknown, HomeView>, ToolError>>;
};

type TerminalControls = {
	close(): void;
	reportCommand(command: string, view: HomeView): void;
};

export type TerminalBridgeCommand =
	| { type: "command"; command: string; input?: unknown }
	| { type: "help" }
	| { type: "exit" };

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, "..");
const DEFAULT_PORT = 5177;
const MAX_TURNS = 12;

const prompt =
	"Turn on the living room light, set the bedroom to 72, lock the front door, then start movie mode.";

const demoScript: AnthropicResponse[] = [
	{
		content: [
			{
				type: "tool_use",
				id: "bridge-1",
				name: "toggleLight",
				input: { room: "living", on: true },
			},
		],
	},
	{
		content: [
			{
				type: "tool_use",
				id: "bridge-2",
				name: "setThermostat",
				input: { room: "bedroom", temp: 72 },
			},
		],
	},
	{
		content: [
			{
				type: "tool_use",
				id: "bridge-3",
				name: "lockDoor",
				input: { value: "front" },
			},
		],
	},
	{
		content: [
			{
				type: "tool_use",
				id: "bridge-4",
				name: "runScene",
				input: { value: "movie" },
			},
		],
	},
	{
		content: [
			{
				type: "text",
				text: "The shared smart home is ready for movie mode.",
			},
		],
	},
];

export async function startSmartHomeBridgeServer(
	options: {
		port?: number;
		runAgent?: boolean;
		model?: Model;
		openAIModel?: OpenAICompatibleModel;
		terminal?: boolean;
		runtimeFactory?: HomeRuntimeFactory;
	} = {},
): Promise<SmartHomeBridgeServer> {
	const port = options.port ?? Number(process.env.PORT ?? DEFAULT_PORT);
	const session = await resolveSharedHomeSession(options.runtimeFactory);
	let agentStarted = false;
	let closing = false;
	let terminal: TerminalControls | undefined;
	let stream: { unsubscribe(): void } | undefined;
	let vite: ViteDevServer | undefined;
	let httpServer: Server | undefined;
	let wss: WebSocketServer | undefined;

	try {
		const { home } = session;
		const tools = igniteTools(home);
		const agentTools = igniteTools(
			home,
			anthropic,
		) as unknown as SharedHomeAgentTools;
		const openAIAgentTools = igniteTools(
			home,
			openai,
		) as unknown as SharedHomeOpenAICompatibleAgentTools;
		vite = await createViteMiddleware();
		httpServer = createHttpServer((request, response) => {
			vite?.middlewares(request, response, () => {
				response.statusCode = 404;
				response.end("Not found");
			});
		});
		wss = new WebSocketServer({ server: httpServer, path: "/bridge" });

		const broadcast = (message: HomeBridgeMessage) => {
			if (closing) {
				return;
			}
			const payload = serializeBridgeMessage(message);
			for (const client of wss?.clients ?? []) {
				if (client.readyState === WebSocket.OPEN) {
					client.send(payload);
				}
			}
			if (message.type === "home:command-result") {
				terminal?.reportCommand(message.command, message.view);
			}
		};

		stream = tools.observe((observation) => {
			const view = home.getView();
			if (observation.type === "event") {
				broadcast({ type: "home:event", event: observation.event, view });
			} else {
				broadcast({ type: "home:view", view });
			}
		});

		wss.on("connection", (socket) => {
			socket.on("error", (error) => {
				console.error("smart-home bridge socket error:", error);
			});
			const sendSocketMessage = (message: HomeBridgeMessage) => {
				if (closing || socket.readyState !== WebSocket.OPEN) {
					return;
				}
				socket.send(serializeBridgeMessage(message));
			};
			sendSocketMessage({ type: "home:view", view: home.getView() });
			startAgentOnce();
			socket.on("message", (payload) => {
				if (closing) {
					return;
				}
				void handleClientMessage(
					String(payload),
					(commandMessage) =>
						void tools
							.run({
								name: commandMessage.command,
								input: commandMessage.input,
							})
							.then((result) => {
								if (closing) {
									return;
								}
								if (isOk(result)) {
									broadcast({
										type: "home:command-result",
										command: commandMessage.command,
										ok: true,
										view: home.getView(),
									});
									return;
								}
								sendSocketMessage({
									type: "home:error",
									command: commandMessage.command,
									message: result.error.kind,
									view: home.getView(),
								});
							})
							.catch((error) => {
								sendSocketMessage({
									type: "home:error",
									command: commandMessage.command,
									message:
										error instanceof Error ? error.message : String(error),
									view: home.getView(),
								});
							}),
					(error) => {
						sendSocketMessage({
							type: "home:error",
							message: error instanceof Error ? error.message : String(error),
							view: home.getView(),
						});
					},
				);
			});
		});

		await listen(httpServer, port);
		const assignedPort = resolveServerPort(httpServer, port);
		if (options.terminal) {
			terminal = startTerminalControls({
				home,
				tools: tools as unknown as TerminalTools,
				broadcast,
			});
		}

		function startAgentOnce(): void {
			if (agentStarted || options.runAgent === false || closing) {
				return;
			}
			agentStarted = true;
			void (
				options.openAIModel
					? runSharedHomeOpenAICompatibleAgent(
							options.openAIModel,
							openAIAgentTools,
							prompt,
							broadcast,
							() => home.getView(),
							() => closing,
						)
					: runSharedHomeAgent(
							options.model ?? scriptedModel(demoScript),
							agentTools,
							prompt,
							broadcast,
							() => home.getView(),
							() => closing,
						)
			).catch((error) => {
				if (closing) {
					return;
				}
				console.error("smart-home bridge agent failed:", error);
				broadcast({
					type: "home:error",
					message: error instanceof Error ? error.message : String(error),
					view: home.getView(),
				});
			});
		}

		if (!stream || !wss || !httpServer || !vite) {
			throw new Error("smart-home bridge server startup was incomplete.");
		}
		const bridgeStream = stream;
		const bridgeWss = wss;
		const bridgeHttpServer = httpServer;
		const bridgeVite = vite;

		return {
			port: assignedPort,
			close: async () => {
				closing = true;
				await cleanupBestEffort([
					() => terminal?.close(),
					() => bridgeStream.unsubscribe(),
					() => closeWebSocketServer(bridgeWss),
					() => closeServer(bridgeHttpServer),
					() => bridgeVite.close(),
					() => session.close(),
				]);
			},
		};
	} catch (error) {
		await cleanupBestEffort([
			() => terminal?.close(),
			() => stream?.unsubscribe(),
			async () => {
				if (wss) {
					await closeWebSocketServer(wss);
				}
			},
			async () => {
				if (httpServer?.listening) {
					await closeServer(httpServer);
				}
			},
			async () => {
				if (vite) {
					await vite.close();
				}
			},
			() => session.close(),
		]);
		throw error;
	}
}

export function parseTerminalCommand(
	line: string,
): TerminalBridgeCommand | null {
	const parts = line.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) {
		return null;
	}

	const [verb, first, second] = parts;
	switch (verb.toLowerCase()) {
		case "help":
		case "?":
			return { type: "help" };
		case "exit":
		case "quit":
			return { type: "exit" };
		case "status":
			return { type: "command", command: "status" };
		case "scene":
			return first
				? { type: "command", command: "runScene", input: first }
				: null;
		case "light":
			return first && second
				? {
						type: "command",
						command: "toggleLight",
						input: { room: first, on: second === "on" },
					}
				: null;
		case "temp":
		case "thermostat":
			return first && second
				? {
						type: "command",
						command: "setThermostat",
						input: { room: first, temp: Number(second) },
					}
				: null;
		case "blinds":
			return first && second
				? {
						type: "command",
						command: "setBlinds",
						input: { room: first, percent: Number(second) },
					}
				: null;
		case "lock":
			return first
				? { type: "command", command: "lockDoor", input: first }
				: null;
		case "unlock":
			return first
				? { type: "command", command: "unlockDoor", input: first }
				: null;
		case "dim":
			return parts.length > 1
				? { type: "command", command: "dimRooms", input: parts.slice(1) }
				: null;
		default:
			return null;
	}
}

function startTerminalControls(options: {
	home: HomeAgentRuntime;
	tools: TerminalTools;
	broadcast: (message: HomeBridgeMessage) => void;
}): TerminalControls {
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
		prompt: "smart-home> ",
	});

	printTerminalHelp(options.home.getView());
	rl.prompt();

	let closed = false;
	rl.on("close", () => {
		closed = true;
	});
	rl.on("line", (line) => {
		void handleTerminalLine(line, options, rl).finally(() => {
			if (!closed) {
				rl.prompt();
			}
		});
	});

	return {
		close: () => rl.close(),
		reportCommand: (command, view) => {
			if (closed) {
				return;
			}
			console.log(`\n↳ ${command}`);
			console.log(renderHome(view));
			rl.prompt();
		},
	};
}

async function handleTerminalLine(
	line: string,
	options: {
		home: HomeAgentRuntime;
		tools: TerminalTools;
		broadcast: (message: HomeBridgeMessage) => void;
	},
	rl: Interface,
): Promise<void> {
	const parsed = parseTerminalCommand(line);
	if (!parsed) {
		console.log("Unknown command. Type `help` for examples.");
		return;
	}

	if (parsed.type === "help") {
		printTerminalHelp(options.home.getView());
		return;
	}

	if (parsed.type === "exit") {
		rl.close();
		return;
	}

	const result = await options.tools.run({
		name: parsed.command,
		input: parsed.input,
	});

	if (isOk(result)) {
		options.broadcast({
			type: "home:command-result",
			command: parsed.command,
			ok: true,
			view: result.value.view,
		});
		return;
	}

	options.broadcast({
		type: "home:error",
		command: parsed.command,
		message: result.error.kind,
		view: options.home.getView(),
	});
	console.error(`Command failed: ${result.error.kind}`);
}

function printTerminalHelp(view: HomeView): void {
	console.log("Terminal controls share the same live home as the browser.");
	console.log("Examples:");
	console.log("  scene away | scene movie");
	console.log("  light kitchen on | light living off");
	console.log("  temp bedroom 72 | blinds living 100");
	console.log("  lock front | unlock garage | dim living bedroom");
	console.log("  status | help | quit");
	console.log(renderHome(view));
}

function reportStartupCleanupError(error: unknown): void {
	console.error("smart-home bridge startup cleanup failed:", error);
}

async function cleanupBestEffort(
	cleanups: Array<() => void | Promise<void>>,
): Promise<void> {
	for (const cleanup of cleanups) {
		try {
			await cleanup();
		} catch (error) {
			reportStartupCleanupError(error);
		}
	}
}

async function createViteMiddleware(): Promise<ViteDevServer> {
	return createViteServer({
		root: appRoot,
		configFile: join(appRoot, "vite.config.ts"),
		appType: "spa",
		server: { middlewareMode: true },
	});
}

async function handleClientMessage(
	payload: string,
	onCommand: (
		message: Extract<HomeBridgeClientMessage, { type: "home:command" }>,
	) => void,
	onError: (error: unknown) => void,
): Promise<void> {
	try {
		const message = parseBridgeMessage(payload);
		if (message.type === "home:command") {
			onCommand(message);
		}
	} catch (error) {
		onError(error);
	}
}

async function runSharedHomeAgent(
	model: Model,
	tools: SharedHomeAgentTools,
	userPrompt: string,
	broadcast: (message: HomeBridgeMessage) => void,
	getView: () => HomeView,
	shouldStop: () => boolean,
): Promise<void> {
	const messages: AnthropicMessage[] = [{ role: "user", content: userPrompt }];

	for (let turn = 0; turn < MAX_TURNS; turn++) {
		if (shouldStop()) {
			return;
		}
		const response = await model({ tools: tools.tools, messages });
		if (shouldStop()) {
			return;
		}
		messages.push({ role: "assistant", content: response.content });
		const calls = tools.toolCalls(response);

		if (calls.length === 0) {
			return;
		}

		const resultBlocks: AnthropicToolResultBlock[] = [];
		for (const call of calls) {
			if (shouldStop()) {
				return;
			}
			const result = await tools.run(call);
			if (shouldStop()) {
				return;
			}
			if (isOk(result)) {
				broadcast({
					type: "home:command-result",
					command: call.name,
					ok: true,
					view: result.value.view,
				});
			} else {
				broadcast({
					type: "home:error",
					command: call.name,
					message: result.error.kind,
					view: getView(),
				});
			}
			resultBlocks.push(
				tools.toolResult({ id: call.id, name: call.name, result }),
			);
		}
		messages.push({ role: "user", content: resultBlocks });
	}
}

async function runSharedHomeOpenAICompatibleAgent(
	model: OpenAICompatibleModel,
	tools: SharedHomeOpenAICompatibleAgentTools,
	userPrompt: string,
	broadcast: (message: HomeBridgeMessage) => void,
	getView: () => HomeView,
	shouldStop: () => boolean,
): Promise<void> {
	const messages: OpenAICompatibleMessage[] = [
		{ role: "user", content: userPrompt },
	];

	for (let turn = 0; turn < MAX_TURNS; turn++) {
		if (shouldStop()) {
			return;
		}
		const response = await model({ tools: tools.tools, messages });
		if (shouldStop()) {
			return;
		}
		assertOpenAIChatCompletionResponse(
			response,
			"OpenAI-compatible bridge model response",
		);
		const primaryResponse = firstOpenAIChoiceResponse(response);
		messages.push(toOpenAIAssistantMessage(primaryResponse));
		const calls = tools.toolCalls(primaryResponse);

		if (calls.length === 0) {
			return;
		}

		const resultMessages: OpenAIChatToolResultMessage[] = [];
		for (const call of calls) {
			if (shouldStop()) {
				return;
			}
			const result = await tools.run(call);
			if (shouldStop()) {
				return;
			}
			if (isOk(result)) {
				broadcast({
					type: "home:command-result",
					command: call.name,
					ok: true,
					view: result.value.view,
				});
			} else {
				broadcast({
					type: "home:error",
					command: call.name,
					message: result.error.kind,
					view: getView(),
				});
			}
			resultMessages.push(
				tools.toolResult({ id: call.id, name: call.name, result }),
			);
		}
		messages.push(...resultMessages);
	}
}

function listen(server: Server, port: number): Promise<void> {
	return new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(port, () => {
			server.off("error", reject);
			resolve();
		});
	});
}

function closeServer(server: Server): Promise<void> {
	return new Promise((resolve, reject) => {
		server.close((error) => {
			if (error) {
				reject(error);
				return;
			}
			resolve();
		});
	});
}

function closeWebSocketServer(wss: WebSocketServer): Promise<void> {
	for (const client of wss.clients) {
		client.terminate();
	}

	return new Promise((resolve, reject) => {
		wss.close((error) => {
			if (error) {
				reject(error);
				return;
			}
			resolve();
		});
	});
}

function resolveServerPort(server: Server, fallback: number): number {
	const address = server.address();
	if (address && typeof address === "object") {
		return address.port;
	}
	return fallback;
}

async function resolveSharedHomeSession(runtimeFactory?: HomeRuntimeFactory) {
	return await (runtimeFactory?.() ?? createLocalHomeSession());
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	const runtimeFactory =
		process.env.SMART_HOME_RUNTIME === "actor-web"
			? createActorWebHomeSession
			: undefined;
	const server = await startSmartHomeBridgeServer({
		terminal: true,
		runtimeFactory,
	});
	console.log(`Smart-home bridge listening on http://localhost:${server.port}`);
}

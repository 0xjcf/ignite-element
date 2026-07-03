import { createServer as createHttpServer, type Server } from "node:http";
import { dirname, join } from "node:path";
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
import type { ViteDevServer } from "vite";
import { createServer as createViteServer } from "vite";
import { WebSocket, WebSocketServer } from "ws";
import type { HomeBridgeClientMessage, HomeBridgeMessage } from "./bridge";
import { parseBridgeMessage, serializeBridgeMessage } from "./bridge";
import { type AnthropicMessage, type Model, scriptedModel } from "./model";
import type { HomeView } from "./render";
import { createHome } from "./shared/home";

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
	options: { port?: number; runAgent?: boolean; model?: Model } = {},
): Promise<SmartHomeBridgeServer> {
	const port = options.port ?? Number(process.env.PORT ?? DEFAULT_PORT);
	const home = createHome();
	const tools = igniteTools(home);
	const agentTools = igniteTools(
		home,
		anthropic,
	) as unknown as SharedHomeAgentTools;
	const vite = await createViteMiddleware();
	const httpServer = createHttpServer((request, response) => {
		vite.middlewares(request, response, () => {
			response.statusCode = 404;
			response.end("Not found");
		});
	});
	const wss = new WebSocketServer({ server: httpServer, path: "/bridge" });

	const broadcast = (message: HomeBridgeMessage) => {
		const payload = serializeBridgeMessage(message);
		for (const client of wss.clients) {
			if (client.readyState === WebSocket.OPEN) {
				client.send(payload);
			}
		}
	};

	const stream = tools.observe((observation) => {
		const view = home.getView();
		if (observation.type === "event") {
			broadcast({ type: "home:event", event: observation.event, view });
		} else {
			broadcast({ type: "home:view", view });
		}
	});

	wss.on("connection", (socket) => {
		socket.send(
			serializeBridgeMessage({ type: "home:view", view: home.getView() }),
		);
		socket.on("message", (payload) => {
			void handleClientMessage(
				String(payload),
				(commandMessage) =>
					void tools
						.run({
							name: commandMessage.command,
							input: commandMessage.input,
						})
						.then((result) => {
							if (isOk(result)) {
								broadcast({
									type: "home:command-result",
									command: commandMessage.command,
									ok: true,
									view: home.getView(),
								});
								return;
							}
							socket.send(
								serializeBridgeMessage({
									type: "home:error",
									command: commandMessage.command,
									message: result.error.kind,
									view: home.getView(),
								}),
							);
						}),
				(error) => {
					socket.send(
						serializeBridgeMessage({
							type: "home:error",
							message: error instanceof Error ? error.message : String(error),
							view: home.getView(),
						}),
					);
				},
			);
		});
	});

	await listen(httpServer, port);
	const assignedPort = resolveServerPort(httpServer, port);

	if (options.runAgent ?? true) {
		void runSharedHomeAgent(
			options.model ?? scriptedModel(demoScript),
			agentTools,
			prompt,
			broadcast,
		);
	}

	return {
		port: assignedPort,
		close: async () => {
			stream.unsubscribe();
			wss.close();
			await closeServer(httpServer);
			await vite.close();
		},
	};
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
): Promise<void> {
	const messages: AnthropicMessage[] = [{ role: "user", content: userPrompt }];

	for (let turn = 0; turn < MAX_TURNS; turn++) {
		const response = await model({ tools: tools.tools, messages });
		messages.push({ role: "assistant", content: response.content });
		const calls = tools.toolCalls(response);

		if (calls.length === 0) {
			return;
		}

		const resultBlocks: AnthropicToolResultBlock[] = [];
		for (const call of calls) {
			const result = await tools.run(call);
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
				});
			}
			resultBlocks.push(
				tools.toolResult({ id: call.id, name: call.name, result }),
			);
		}
		messages.push({ role: "user", content: resultBlocks });
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

function resolveServerPort(server: Server, fallback: number): number {
	const address = server.address();
	if (address && typeof address === "object") {
		return address.port;
	}
	return fallback;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	const server = await startSmartHomeBridgeServer();
	console.log(`Smart-home bridge listening on http://localhost:${server.port}`);
}

import { createActorWebHomeSession } from "./actor-web-home";
import { openAICompatibleModel } from "./model";
import { startSmartHomeBridgeServer } from "./server";

const baseUrl =
	process.env.MLX_BASE_URL ??
	process.env.OPENAI_COMPAT_BASE_URL ??
	"http://127.0.0.1:8080/v1";
const model =
	process.env.MLX_MODEL ?? process.env.OPENAI_COMPAT_MODEL ?? "mlx-local";
const apiKey = process.env.OPENAI_COMPAT_API_KEY ?? process.env.OPENAI_API_KEY;
const runtimeFactory =
	process.env.SMART_HOME_RUNTIME === "actor-web"
		? createActorWebHomeSession
		: undefined;

let server: Awaited<ReturnType<typeof startSmartHomeBridgeServer>> | undefined;
let startupPromise: ReturnType<typeof startSmartHomeBridgeServer> | undefined;
let shuttingDown = false;

const shutdown = async (signal: string) => {
	if (shuttingDown) {
		return;
	}
	shuttingDown = true;
	try {
		if (startupPromise) {
			server = await startupPromise.catch(() => undefined);
		}
		await server?.close();
		process.exit(0);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(
			`\nFailed to close smart-home MLX bridge after ${signal}: ${message}`,
		);
		process.exit(1);
	}
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

try {
	startupPromise = startSmartHomeBridgeServer({
		terminal: true,
		openAIModel: openAICompatibleModel({ baseUrl, model, apiKey }),
		runtimeFactory,
	});
	server = await startupPromise;

	console.log(
		`Smart-home MLX bridge listening on http://localhost:${server.port}`,
	);
	console.log(`OpenAI-compatible endpoint: ${baseUrl}`);
	console.log(`Model: ${model}`);
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`\n${message}`);
	process.exit(1);
}

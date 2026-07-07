import { createActorWebHomeSession } from "./actor-web-home";
import { openAICompatibleModel } from "./model";
import { startSmartHomeBridgeServer } from "./server";

const defaultBaseUrl = "http://127.0.0.1:8080/v1";
const baseUrl =
	process.env.MLX_BASE_URL ??
	process.env.OPENAI_COMPAT_BASE_URL ??
	defaultBaseUrl;
const model =
	process.env.MLX_MODEL ?? process.env.OPENAI_COMPAT_MODEL ?? "mlx-local";
const apiKey = process.env.OPENAI_COMPAT_API_KEY;
const runtimeFactory =
	process.env.SMART_HOME_RUNTIME === "actor-web"
		? createActorWebHomeSession
		: undefined;
const STARTUP_WAIT_TIMEOUT_MS = 10_000;

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
			try {
				server = await waitForStartupBeforeShutdown(startupPromise, signal);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.error(
					`\nSmart-home MLX bridge failed to start before ${signal}: ${message}`,
				);
				process.exit(1);
			}
		}
		if (!server) {
			console.error(
				`\nSmart-home MLX bridge was not available before ${signal}.`,
			);
			process.exit(1);
		}
		await waitForShutdownBeforeExit(server.close(), signal);
		process.exit(0);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(
			`\nFailed to close smart-home MLX bridge after ${signal}: ${message}`,
		);
		process.exit(1);
	}
};

async function waitForShutdownBeforeExit(
	promise: ReturnType<
		Awaited<ReturnType<typeof startSmartHomeBridgeServer>>["close"]
	>,
	signal: string,
): Promise<void> {
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	try {
		await Promise.race([
			promise,
			new Promise<never>((_, reject) => {
				timeoutId = setTimeout(() => {
					reject(
						new Error(
							`Timed out after ${STARTUP_WAIT_TIMEOUT_MS}ms closing smart-home MLX bridge after ${signal}.`,
						),
					);
				}, STARTUP_WAIT_TIMEOUT_MS);
			}),
		]);
	} finally {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
	}
}

async function waitForStartupBeforeShutdown(
	promise: ReturnType<typeof startSmartHomeBridgeServer>,
	signal: string,
): Promise<Awaited<ReturnType<typeof startSmartHomeBridgeServer>>> {
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			promise,
			new Promise<never>((_, reject) => {
				timeoutId = setTimeout(() => {
					reject(
						new Error(
							`Timed out after ${STARTUP_WAIT_TIMEOUT_MS}ms waiting for smart-home MLX bridge startup before ${signal}.`,
						),
					);
				}, STARTUP_WAIT_TIMEOUT_MS);
			}),
		]);
	} finally {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
	}
}

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

import { createActorWebHomeSession } from "./actor-web-home";
import type { AgentResult } from "./agentLoop";
import { runHomeOpenAICompatibleAgent } from "./agentLoop";
import { createHome } from "./home";
import { openAICompatibleModel } from "./model";
import { renderHome } from "./render";

// The local-model loop: an MLX server drives the headless smart home through
// igniteTools + the OpenAI-compatible adapter. Needs no cloud API key:
//   python -m mlx_lm.server --model <model> --port 8080
//   MLX_MODEL=<model> npm run mlx -- "it's bedtime"

const defaultBaseUrl = "http://127.0.0.1:8080/v1";
const baseUrl =
	process.env.MLX_BASE_URL ??
	process.env.OPENAI_COMPAT_BASE_URL ??
	defaultBaseUrl;
const model =
	process.env.MLX_MODEL ?? process.env.OPENAI_COMPAT_MODEL ?? "mlx-local";
const apiKey = process.env.OPENAI_COMPAT_API_KEY;

const prompt =
	process.argv.slice(2).join(" ") ||
	"It's bedtime — turn off all the lights and lock every door.";

function printSession(result: AgentResult): void {
	console.log("Agent actions:");
	for (const entry of result.trace) {
		const events = entry.events.length ? `  * ${entry.events.join(", ")}` : "";
		const outcome = entry.ok ? "ok" : `ERROR ${entry.errorKind}`;
		console.log(
			`  - ${entry.command}(${JSON.stringify(entry.input)}) -> ${outcome}${events}`,
		);
	}
	console.log(`\nModel response: ${result.finalText}\n`);
	console.log("Final state:");
	console.log(renderHome(result.home.getView()));
}

const runtimeFactory =
	process.env.SMART_HOME_RUNTIME === "actor-web"
		? createActorWebHomeSession
		: undefined;

console.log("Smart-home agent - local MLX/OpenAI-compatible loop, headless\n");
console.log(`Endpoint: ${baseUrl}`);
console.log(`Model: ${model}`);
console.log("\nInitial state:");
console.log(renderHome(createHome().getView()));
console.log(`\nPrompt: "${prompt}"\n`);

try {
	const result = await runHomeOpenAICompatibleAgent(
		openAICompatibleModel({ baseUrl, model, apiKey }),
		prompt,
		{ runtimeFactory },
	);
	let printError: unknown;
	let closeError: unknown;
	try {
		printSession(result);
	} catch (error) {
		printError = error;
	}
	try {
		await result.close();
	} catch (error) {
		closeError = error;
	}
	if (printError !== undefined) {
		if (closeError !== undefined) {
			console.error("Failed to close session cleanly:", closeError);
		}
		throw printError;
	}
	if (closeError !== undefined) {
		throw closeError;
	}
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`\n${message}`);
	process.exit(1);
}

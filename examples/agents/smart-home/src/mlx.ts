import type { AgentResult } from "./agentLoop";
import { runHomeOpenAICompatibleAgent } from "./agentLoop";
import { createHome } from "./home";
import { openAICompatibleModel } from "./model";
import { renderHome } from "./render";

// The local-model loop: an MLX server drives the headless smart home through
// igniteTools + the OpenAI-compatible adapter. Needs no cloud API key:
//   python -m mlx_lm.server --model <model> --port 8080
//   MLX_MODEL=<model> npm run mlx -- "it's bedtime"

const baseUrl =
	process.env.MLX_BASE_URL ??
	process.env.OPENAI_COMPAT_BASE_URL ??
	"http://127.0.0.1:8080/v1";
const model =
	process.env.MLX_MODEL ?? process.env.OPENAI_COMPAT_MODEL ?? "mlx-local";
const apiKey = process.env.OPENAI_COMPAT_API_KEY ?? process.env.OPENAI_API_KEY;

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
	);
	printSession(result);
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`\n${message}`);
	process.exit(1);
}

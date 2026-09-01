import type { AgentResult } from "./agentLoop";
import { runHomeOpenAICompatibleAgent } from "./agentLoop";
import {
	printAndCloseAgentResult,
	resolveMlxConnectionOptions,
	resolveSmartHomeRuntimeFactory,
} from "./cli";
import { createHome } from "./home";
import { openAICompatibleModel } from "./model";
import { renderHome } from "./render";

// The local-model loop: an MLX server drives the headless smart home through
// igniteTools + the OpenAI-compatible adapter. Needs no cloud API key:
//   python -m mlx_lm.server --model <model> --port 8080
//   MLX_MODEL=<model> npm run mlx -- "it's bedtime"

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
	console.log(renderHome(result.home.getStates()));
}

try {
	const { baseUrl, model, apiKey } = resolveMlxConnectionOptions();
	const runtimeFactory = resolveSmartHomeRuntimeFactory();

	console.log(
		"Smart-home agent - local MLX/OpenAI-compatible loop, headless\n",
	);
	console.log(`Endpoint: ${baseUrl}`);
	console.log(`Model: ${model}`);
	console.log("\nInitial state:");
	console.log(renderHome(createHome().getStates()));
	console.log(`\nPrompt: "${prompt}"\n`);

	const result = await runHomeOpenAICompatibleAgent(
		openAICompatibleModel({ baseUrl, model, apiKey }),
		prompt,
		{ runtimeFactory },
	);
	await printAndCloseAgentResult(result, printSession);
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`\n${message}`);
	process.exitCode = 1;
}

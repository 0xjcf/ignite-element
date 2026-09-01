import type { AgentResult } from "./agentLoop";
import { runHomeAgent } from "./agentLoop";
import {
	printAndCloseAgentResult,
	resolveSmartHomeRuntimeFactory,
} from "./cli";
import { createHome } from "./home";
import { anthropicModel } from "./model";
import { renderHome } from "./render";

// The real loop: Claude drives the headless smart home through igniteTools + the
// Anthropic adapter. Needs an API key and the SDK:
//   npm install @anthropic-ai/sdk
//   ANTHROPIC_API_KEY=sk-... npm run anthropic -- "it's bedtime"

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
	console.error(
		"Set ANTHROPIC_API_KEY to run the live loop (or `npm run mock` for the key-free demo).",
	);
	process.exit(1);
}

const prompt =
	process.argv.slice(2).join(" ") ||
	"It's bedtime — turn off all the lights and lock every door.";

function printSession(result: AgentResult): void {
	console.log("Agent actions:");
	for (const entry of result.trace) {
		const events = entry.events.length ? `  ⚡ ${entry.events.join(", ")}` : "";
		const outcome = entry.ok ? "ok" : `⛔ ${entry.errorKind}`;
		console.log(
			`  🤖 ${entry.command}(${JSON.stringify(entry.input)}) → ${outcome}${events}`,
		);
	}
	console.log(`\n💬 ${result.finalText}\n`);
	console.log("Final state:");
	console.log(renderHome(result.home.getStates()));
}

console.log("🏠 Smart-home agent — live Anthropic loop, headless (no DOM)\n");
console.log("Initial state:");
console.log(renderHome(createHome().getStates()));
console.log(`\n🗣️  "${prompt}"\n`);

try {
	const runtimeFactory = resolveSmartHomeRuntimeFactory();
	const result = await runHomeAgent(anthropicModel({ apiKey }), prompt, {
		runtimeFactory,
	});
	await printAndCloseAgentResult(result, printSession);
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	const code =
		typeof error === "object" && error !== null && "code" in error
			? (error as { code?: unknown }).code
			: undefined;
	if (
		code === "ERR_MODULE_NOT_FOUND" ||
		/Cannot find( module|package)|ERR_MODULE_NOT_FOUND/.test(message)
	) {
		console.error(
			"\n@anthropic-ai/sdk is not installed. Run `npm install @anthropic-ai/sdk` and retry.",
		);
		process.exitCode = 1;
	} else {
		console.error(`\n${message}`);
		process.exitCode = 1;
	}
}

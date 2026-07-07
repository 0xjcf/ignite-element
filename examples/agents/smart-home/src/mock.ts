import type { AnthropicResponse } from "ignite-element/tools/anthropic";
import type { AgentResult } from "./agentLoop";
import { runHomeAgent } from "./agentLoop";
import {
	printAndCloseAgentResult,
	resolveSmartHomeRuntimeFactory,
} from "./cli";
import { createHome } from "./home";
import { scriptedModel } from "./model";
import { renderHome } from "./render";

// Key-free, headless demo: a scripted "model" returns tool_use blocks and the
// igniteTools loop drives a real ignite smart home — all in plain Node, no DOM,
// no API key. Run with: npm run mock

const prompt =
	"Turn on the living room light, set the bedroom to 72°, lock the front door, then start movie mode.";

const script: AnthropicResponse[] = [
	{
		content: [
			{
				type: "tool_use",
				id: "c1",
				name: "toggleLight",
				input: { room: "living", on: true },
			},
		],
	},
	{
		content: [
			{
				type: "tool_use",
				id: "c2",
				name: "setThermostat",
				input: { room: "bedroom", temp: 72 },
			},
		],
	},
	{
		content: [
			{
				type: "tool_use",
				id: "c3",
				name: "lockDoor",
				input: { value: "front" },
			},
		],
	},
	{
		content: [
			{
				type: "tool_use",
				id: "c4",
				name: "runScene",
				input: { value: "movie" },
			},
		],
	},
	{
		content: [
			{
				type: "text",
				text: "Living light on, bedroom set to 72°, front door locked, movie mode on.",
			},
		],
	},
];

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
	console.log(renderHome(result.home.getView()));
}

try {
	const runtimeFactory = resolveSmartHomeRuntimeFactory();

	console.log("🏠 Smart-home agent — scripted, key-free, headless (no DOM)\n");
	console.log("Initial state:");
	console.log(renderHome(createHome().getView()));
	console.log(`\n🗣️  "${prompt}"\n`);

	const result = await runHomeAgent(scriptedModel(script), prompt, {
		runtimeFactory,
	});
	await printAndCloseAgentResult(result, printSession);
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`\n${message}`);
	process.exitCode = 1;
}

import { igniteTools, isOk } from "ignite-element/tools";
import {
	type AnthropicResponse,
	type AnthropicToolResultBlock,
	anthropic,
} from "ignite-element/tools/anthropic";
import { createHome } from "./home";
import type { AnthropicMessage, Model } from "./model";

/** One tool call the agent made, plus what came back. */
export type AgentTraceEntry = {
	command: string;
	/** The validated input — a scalar command's `{ value }` is already unwrapped. */
	input: unknown;
	ok: boolean;
	/** errors-as-values: the ToolError kind when the call was rejected. */
	errorKind?: string;
	/** Domain events emitted during the command window (the observation stream). */
	events: string[];
};

export type AgentResult = {
	home: ReturnType<typeof createHome>;
	trace: AgentTraceEntry[];
	finalText: string;
	modelCalls: number;
};

/** A safety bound so a misbehaving model can't loop forever. */
const MAX_TURNS = 12;

/**
 * Drive a fresh smart home through an Anthropic tool-use loop:
 *
 *   getSchema() → anthropic.tools() → [model] → tool_use
 *     → toolCalls() (scalar-unwrap) → run() → toolResult() → repeat
 *
 * The `model` is injected, so the exact same loop runs against the scripted mock
 * (key-free) or the real Anthropic API. This runs headless in pure Node — no DOM,
 * no jsdom — which is the end-to-end proof of the DOM-free agent runtime.
 */
export async function runHomeAgent(
	model: Model,
	userPrompt: string,
): Promise<AgentResult> {
	const home = createHome();
	const { tools, toolCalls, run, toolResult } = igniteTools(home, anthropic);

	const messages: AnthropicMessage[] = [{ role: "user", content: userPrompt }];
	const trace: AgentTraceEntry[] = [];
	let finalText = "";
	let modelCalls = 0;

	for (let turn = 0; turn < MAX_TURNS; turn++) {
		const response = await model({ tools, messages });
		modelCalls++;
		messages.push({ role: "assistant", content: response.content });

		const calls = toolCalls(response);
		if (calls.length === 0) {
			finalText = textOf(response);
			break;
		}

		const resultBlocks: AnthropicToolResultBlock[] = [];
		for (const call of calls) {
			const result = await run(call);
			trace.push({
				command: call.name,
				input: call.input,
				ok: isOk(result),
				errorKind: isOk(result) ? undefined : result.error.kind,
				events: isOk(result)
					? result.value.events.map((event) => event.type)
					: [],
			});
			resultBlocks.push(toolResult({ id: call.id, name: call.name, result }));
		}
		messages.push({ role: "user", content: resultBlocks });
	}

	return { home, trace, finalText, modelCalls };
}

/** Concatenate the text blocks of an Anthropic response. */
function textOf(response: AnthropicResponse): string {
	return response.content
		.map((block) =>
			block.type === "text" && typeof block.text === "string" ? block.text : "",
		)
		.filter(Boolean)
		.join("\n");
}

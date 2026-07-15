/// <reference types="node" />

import "@ignite-element/renderer/jsx";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";
import { probeMlxWorkbenchReadiness } from "./model";
import { component, source } from "./session";
import { completeSubmittedPrompt } from "./workbench-agent";

const DEFAULT_BASE_URL = "http://127.0.0.1:8080/v1";
const DEFAULT_MODEL = "mlx-community/gemma-4-e4b-it-4bit";

type TerminalView = ReturnType<typeof component.getView>;

export const formatTerminalProjection = (view: TerminalView): string => {
	const lines = [
		"Ignite Element · voice + text workbench",
		"Projection source: current actor view",
		"matches({",
		`  provider: "${view.model.status}",`,
		`  turn: "${view.turnState}",`,
		"})",
		"",
		`Artifacts: ${view.artifacts.length}`,
	];

	for (const artifact of view.artifacts) {
		lines.push(
			`${artifact.id === view.activeArtifactId ? "*" : "-"} ${artifact.title ?? artifact.id} [${artifact.id}] · revision ${artifact.revision}`,
		);
		for (const node of artifact.nodes) {
			lines.push(`  - ${node.kind} · ${node.id}`);
		}
	}

	if (view.response) {
		lines.push("", "Response", view.response.text);
	}
	const trace = view.presentation.turn?.trace ?? [];
	if (trace.length > 0) {
		lines.push("", "Authorized trace");
		for (const entry of trace) {
			lines.push(`  ${entry.accepted ? "✓" : "×"} ${entry.command}`);
		}
	}
	return lines.join("\n");
};

const readPrompt = async (): Promise<string> => {
	const argumentPrompt = process.argv.slice(2).join(" ").trim();
	if (argumentPrompt) return argumentPrompt;
	const terminal = createInterface({ input: stdin, output: stdout });
	try {
		return (await terminal.question("Prompt: ")).trim();
	} finally {
		terminal.close();
	}
};

const run = async () => {
	const prompt = await readPrompt();
	if (!prompt) throw new Error("A text prompt is required.");
	const configuration = {
		baseUrl:
			process.env.VOICE_WORKBENCH_MLX_BASE_URL ??
			process.env.MLX_BASE_URL ??
			DEFAULT_BASE_URL,
		model:
			process.env.VOICE_WORKBENCH_MLX_MODEL ??
			process.env.MLX_MODEL ??
			DEFAULT_MODEL,
		apiKey: process.env.VOICE_WORKBENCH_MLX_API_KEY ?? process.env.MLX_API_KEY,
	};
	const readiness = await probeMlxWorkbenchReadiness(configuration);
	if (readiness.type === "MODEL_FAILED") {
		throw new Error(readiness.failure.message);
	}
	await component.execute({ command: "reportModelAvailable" });
	await component.execute({
		command: "submitPrompt",
		input: { modality: "text", text: prompt },
	});
	const result = await completeSubmittedPrompt(configuration, {
		modality: "text",
		text: prompt,
	});
	stdout.write(`${formatTerminalProjection(component.getView())}\n`);
	if (!result?.accepted) process.exitCode = 1;
};

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	run()
		.catch((error: unknown) => {
			const message = error instanceof Error ? error.message : String(error);
			process.stderr.write(`[voice-workbench] ${message}\n`);
			process.exitCode = 1;
		})
		.finally(() => source.stop());
}

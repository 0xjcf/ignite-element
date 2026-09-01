/// <reference types="node" />

import "@ignite-element/renderer/jsx";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";
import { waitFor } from "xstate";
import { createWorkbenchModelTurnPort } from "./adapters/mlx-model-turn";
import { emptyDomainRegistry } from "./domains/registry";
import { probeMlxWorkbenchReadiness } from "./model";
import { createVoiceWorkbenchSessionActor } from "./session";
import {
	createVoiceWorkbenchComponent,
	type WorkbenchView,
} from "./workbench-component";
import { createVoiceWorkbenchRuntime } from "./workbench-runtime";

const DEFAULT_BASE_URL = "http://127.0.0.1:8080/v1";
const DEFAULT_MODEL = "mlx-community/gemma-4-e4b-it-4bit";

type TerminalView = WorkbenchView;

export const formatTerminalProjection = (view: TerminalView): string => {
	const lines = [
		"Ignite Element · voice + text workbench",
		"Projection source: current actor view",
		view.runtimeInspector.actor.matchText,
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
	const source = createVoiceWorkbenchSessionActor().start();
	const component = createVoiceWorkbenchComponent(source);
	const runtime = createVoiceWorkbenchRuntime({
		actor: source,
		ports: {
			modelPreparation: async (request, { signal }) => {
				const readiness = await probeMlxWorkbenchReadiness({
					...configuration,
					signal,
				});
				return readiness.type === "MODEL_AVAILABLE"
					? { type: "available", sequence: request.sequence }
					: {
							type: "failed",
							sequence: request.sequence,
							failure: readiness.failure,
						};
			},
			modelTurn: createWorkbenchModelTurnPort(
				configuration,
				[],
				emptyDomainRegistry,
				component,
			),
			voiceCapture: () => undefined,
			speechDelivery: (request, emit) => {
				if (request.type === "mute") {
					emit({ type: "MUTED", attemptId: request.attemptId });
				} else if (request.type === "unavailable" || request.type === "speak") {
					emit({ type: "UNAVAILABLE", attemptId: request.attemptId });
				}
			},
		},
	});
	try {
		const ready = await waitFor(
			source,
			(snapshot) =>
				snapshot.matches("available") || snapshot.matches("unavailable"),
		);
		if (ready.matches("unavailable")) {
			throw new Error(
				ready.context.modelFailure?.message ??
					"The local model is unavailable.",
			);
		}
		await component.execute({
			command: "submitPrompt",
			input: { modality: "text", text: prompt },
		});
		const completed = await waitFor(
			source,
			(snapshot) =>
				snapshot.matches({ available: { turn: "idle" } }) &&
				snapshot.context.lastModelTurnResult !== null,
		);
		stdout.write(`${formatTerminalProjection(component.getStates())}\n`);
		if (!completed.context.lastModelTurnResult?.accepted) process.exitCode = 1;
	} finally {
		runtime.dispose();
		source.stop();
	}
};

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	run().catch((error: unknown) => {
		const message = error instanceof Error ? error.message : String(error);
		process.stderr.write(`[voice-workbench] ${message}\n`);
		process.exitCode = 1;
	});
}

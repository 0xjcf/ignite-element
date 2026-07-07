import { createActorWebHomeSession } from "./actor-web-home";
import type { AgentResult } from "./agentLoop";
import type { HomeRuntimeFactory } from "./home";
import { waitForLifecyclePromise } from "./lifecycle";

export type SmartHomeMlxConnectionOptions = {
	baseUrl: string;
	model: string;
	apiKey: string | undefined;
};

export class AgentResultCloseError extends Error {
	readonly errors: readonly [unknown, unknown];

	constructor(printError: unknown, closeError: unknown) {
		super("Failed to print session and close agent session cleanly");
		this.name = "AgentResultCloseError";
		this.errors = [printError, closeError];
	}
}

export function resolveSmartHomeRuntimeFactory():
	| HomeRuntimeFactory
	| undefined {
	return process.env.SMART_HOME_RUNTIME === "actor-web"
		? createActorWebHomeSession
		: undefined;
}

export function resolveMlxConnectionOptions(): SmartHomeMlxConnectionOptions {
	const defaultBaseUrl = "http://127.0.0.1:8080/v1";
	return {
		baseUrl:
			process.env.MLX_BASE_URL ??
			process.env.OPENAI_COMPAT_BASE_URL ??
			defaultBaseUrl,
		model:
			process.env.MLX_MODEL ?? process.env.OPENAI_COMPAT_MODEL ?? "mlx-local",
		apiKey: process.env.OPENAI_COMPAT_API_KEY,
	};
}

export async function printAndCloseAgentResult(
	result: AgentResult,
	printSession: (result: AgentResult) => void | Promise<void>,
): Promise<void> {
	let printError: unknown;
	let printFailed = false;
	let closeError: unknown;
	let closeFailed = false;
	try {
		await printSession(result);
	} catch (error) {
		printError = error;
		printFailed = true;
	}
	try {
		await waitForLifecyclePromise(result.close(), "closing agent session");
	} catch (error) {
		closeError = error;
		closeFailed = true;
	}
	if (printFailed) {
		if (closeFailed) {
			throw new AgentResultCloseError(printError, closeError);
		}
		throw printError;
	}
	if (closeFailed) {
		throw closeError;
	}
}

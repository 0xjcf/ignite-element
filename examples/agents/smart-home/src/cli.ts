import { createActorWebHomeSession } from "./actor-web-home";
import type { AgentResult } from "./agentLoop";
import type { HomeRuntimeFactory } from "./home";

export function resolveSmartHomeRuntimeFactory():
	| HomeRuntimeFactory
	| undefined {
	return process.env.SMART_HOME_RUNTIME === "actor-web"
		? createActorWebHomeSession
		: undefined;
}

export async function printAndCloseAgentResult(
	result: AgentResult,
	printSession: (result: AgentResult) => void,
): Promise<void> {
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
}

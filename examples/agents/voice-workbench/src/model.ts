import { igniteTools } from "ignite-element/tools";
import {
	type OpenAIChatCompletionResponse,
	openai,
} from "ignite-element/tools/openai";
import type {
	ModelFailureFact,
	ModelRequest,
	ModelResult,
	WorkbenchModel,
} from "./agent-loop";
import type { component as workbenchComponent } from "./session";

const SYSTEM_PROMPT = `You operate a consumer-owned Ignite conversation actor.
Use only the supplied tools. Create an artifact for a fresh request, revise the active artifact when the user requests a change, and finish every successful turn with completeResponse.
Produce semantic projection nodes only; never emit HTML, JavaScript, or executable code.`;

export type MlxWorkbenchModelOptions = {
	component: typeof workbenchComponent;
	baseUrl?: string;
	model?: string;
	apiKey?: string;
	fetch?: typeof fetch;
	timeoutMs?: number;
};

const failure = (
	kind: ModelFailureFact["kind"],
	message: string,
	status?: number,
): ModelResult => ({
	ok: false,
	error: { kind, message, ...(status === undefined ? {} : { status }) },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isCompletionResponse = (
	value: unknown,
): value is OpenAIChatCompletionResponse =>
	isRecord(value) && Array.isArray(value.choices) && value.choices.length > 0;

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const isAbortError = (error: unknown): boolean =>
	isRecord(error) && error.name === "AbortError";

function resolveConfiguration(options: MlxWorkbenchModelOptions):
	| {
			ok: true;
			baseUrl: string;
			model: string;
			timeoutMs: number;
	  }
	| { ok: false; result: ModelResult } {
	const baseUrl = options.baseUrl?.trim() ?? "";
	const model = options.model?.trim() ?? "";
	if (!baseUrl || !model) {
		return {
			ok: false,
			result: failure(
				"configuration",
				"A local model URL and model name are required.",
			),
		};
	}
	try {
		const parsed = new URL(baseUrl);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			throw new Error("unsupported protocol");
		}
	} catch {
		return {
			ok: false,
			result: failure(
				"configuration",
				"The local model URL must be an HTTP or HTTPS URL.",
			),
		};
	}
	const timeoutMs = options.timeoutMs ?? 30_000;
	if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
		return {
			ok: false,
			result: failure(
				"configuration",
				"The local model timeout must be a positive number.",
			),
		};
	}
	return {
		ok: true,
		baseUrl: stripTrailingSlash(baseUrl),
		model,
		timeoutMs,
	};
}

function requestBody(
	request: ModelRequest,
	model: string,
	tools: ReturnType<typeof openai.tools>,
): string {
	return JSON.stringify({
		model,
		messages: [
			{ role: "system", content: SYSTEM_PROMPT },
			{
				role: "user",
				content: JSON.stringify({
					prompt: request.prompt,
					currentView: request.view,
				}),
			},
		],
		tools,
	});
}

/**
 * Create an SDK-free model seam for an OpenAI-compatible MLX server. Provider
 * lifecycle and configuration stay consumer-owned; expected failures cross the
 * adapter boundary as typed facts.
 */
export function createMlxWorkbenchModel(
	options: MlxWorkbenchModelOptions,
): WorkbenchModel {
	return async (request) => {
		const configuration = resolveConfiguration(options);
		if (!configuration.ok) return configuration.result;

		const fetchImpl = options.fetch ?? globalThis.fetch;
		if (typeof fetchImpl !== "function") {
			return failure(
				"configuration",
				"This environment does not provide fetch for the local model request.",
			);
		}

		const dialect = igniteTools(options.component, openai);
		const requestedNames = new Set(request.tools.map((tool) => tool.name));
		const currentTools = dialect.tools.filter((tool) =>
			requestedNames.has(tool.function.name),
		);
		const headers: Record<string, string> = {
			"content-type": "application/json",
		};
		if (options.apiKey?.trim()) {
			headers.authorization = `Bearer ${options.apiKey.trim()}`;
		}

		const controller = new AbortController();
		const timeout = setTimeout(
			() => controller.abort(),
			configuration.timeoutMs,
		);
		let response: Response;
		try {
			response = await fetchImpl(`${configuration.baseUrl}/chat/completions`, {
				method: "POST",
				headers,
				body: requestBody(request, configuration.model, currentTools),
				signal: controller.signal,
			});
		} catch (error) {
			clearTimeout(timeout);
			if (controller.signal.aborted || isAbortError(error)) {
				return failure("timeout", "The local model request timed out.");
			}
			return failure("network", "The local model could not be reached.");
		}

		try {
			if (!response.ok) {
				return failure(
					"provider",
					"The local model rejected the request.",
					response.status,
				);
			}
			let payload: unknown;
			try {
				payload = await response.json();
			} catch (error) {
				if (controller.signal.aborted || isAbortError(error)) {
					return failure("timeout", "The local model request timed out.");
				}
				return failure(
					"invalid-response",
					"The local model returned an invalid response.",
				);
			}
			if (!isCompletionResponse(payload)) {
				return failure(
					"invalid-response",
					"The local model returned an invalid response.",
				);
			}
			const calls = dialect.toolCalls(payload);
			if (calls.length === 0) {
				return failure(
					"invalid-response",
					"The local model returned an invalid response.",
				);
			}
			return {
				ok: true,
				calls: calls.map((call) => ({
					command: call.name,
					input: call.input,
				})),
			};
		} finally {
			clearTimeout(timeout);
		}
	};
}

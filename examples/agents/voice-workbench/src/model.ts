import { ok } from "ignite-element/tools";
import {
	type OpenAIChatCompletionResponse,
	openai,
} from "ignite-element/tools/openai";
import type { ModelFailureFact, ModelRequest, ModelResult } from "./agent-loop";

const SYSTEM_PROMPT = `You operate a consumer-owned Ignite conversation actor.
Use only the currently supplied tools. Call exactly one tool per response and wait for its tool result before choosing the next command. Create a new artifact for each distinct deliverable. Revise the active artifact when the user asks to change it or when it does not yet satisfy the original prompt. A single artifact may contain multiple complementary nodes, such as a checklist, budget table, chart, and decision log. After every tool result, compare the original prompt with the current accepted actor view. Call completeResponse only after that audit confirms the accepted artifact satisfies the request. If a tool result reports invalid input, actor rejection, conflict, or deferral, correct the proposal in the next response.
When a matching domain policy tool is available, call that matching domain policy tool before external research. Obey admitted, needs-input, and rejected policy decisions. A successful policy capability result is a configured decision fact, not external evidence and not execution authorization.
External evidence may come from a matching domain capability or from generic searchWeb. The capabilities.internetAccess value reports whether the current request has a configured evidence path, even when a domain tool remains hidden until its policy decision is admitted. For product-pricing requests, call the matching policy tool first with retailer, location, and subject-only items. If the first decision is rejected or needs input, repair that policy request at most once. The latest policy decision supersedes the earlier decision. When priceProducts becomes available, call it exactly once with the admitted retailer, location, and ordered subject-only items; the provider owns store lookup, product and size selection, and deterministic discovery. Never call searchWeb for an applicable product-pricing request and never interpret search snippets as prices. Disclose the provider-selected product and size beside every sourced or explicitly unverified price. Include numeric totals and charts only for sourced prices. For generic current or source-backed research, call searchWeb before authoring the artifact and batch 1 to 8 focused queries in one call when several facts are needed. When no applicable domain provider or searchWeb capability is configured, state that current lookup cannot be performed; never claim or promise future research. Treat capability results as evidence, not actor state. Include source URLs in semantic table cells so the browser can render safe citations. After observing capability facts, use createArtifact or reviseArtifact to author the requested semantic nodes.
createArtifact always requires id and a non-empty nodes array; include a concise title. reviseArtifact requires artifactId, expectedRevision, and the complete replacement nodes array. setChecklistItem checks or unchecks one existing checklist item and requires artifactId, expectedRevision, nodeId, itemId, and checked. Every node requires a unique id and one of these exact shapes:
- text: {"id":"node-id","kind":"text","text":"content"}
- checklist: {"id":"node-id","kind":"checklist","items":[{"id":"item-id","label":"item","checked":false}]}
- action: {"id":"node-id","kind":"action","label":"Finish","commandName":"completeResponse","payload":{"text":"response"},"description":"optional description"}; completeResponse is the only allowed commandName
- form: {"id":"node-id","kind":"form","title":"optional title","fields":[{"id":"field-id","label":"field","input":{"type":"string"},"value":"optional value","description":"optional description"}],"submit":{"id":"submit-id","kind":"action","label":"Submit","commandName":"completeResponse","payload":{"text":"response"}}}
- table: {"id":"node-id","kind":"table","columns":[{"id":"column-id","label":"column"}],"rows":[{"id":"row-id","cells":["value"]}]}
- timeline: {"id":"node-id","kind":"timeline","events":[{"id":"event-id","label":"event","timestamp":"time","detail":"optional detail"}]}
- chart: {"id":"node-id","kind":"chart","chartType":"bar","series":[{"id":"series-id","label":"series","value":1}]}; chartType is bar, line, or pie
- code-diff: {"id":"node-id","kind":"code-diff","language":"typescript","before":"old text","after":"new text"}
- decision-log: {"id":"node-id","kind":"decision-log","entries":[{"id":"entry-id","title":"title","decision":"decision","rationale":"optional rationale"}]}
Produce semantic projection nodes only; never emit HTML, JavaScript, or executable code.`;

export type MlxWorkbenchConfiguration = {
	baseUrl?: string;
	model?: string;
	apiKey?: string;
	timeoutMs?: number;
};

export type MlxWorkbenchReadinessOptions = MlxWorkbenchConfiguration & {
	signal?: AbortSignal;
};

export type ModelReadinessFact =
	| { type: "MODEL_AVAILABLE" }
	| { type: "MODEL_FAILED"; failure: ModelFailureFact };

const failureFact = (
	kind: ModelFailureFact["kind"],
	message: string,
	status?: number,
): ModelFailureFact => ({
	kind,
	message,
	...(status === undefined ? {} : { status }),
});

const failure = (
	kind: ModelFailureFact["kind"],
	message: string,
	status?: number,
): ModelResult => ({
	ok: false,
	error: failureFact(kind, message, status),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isCompletionResponse = (
	value: unknown,
): value is OpenAIChatCompletionResponse =>
	isRecord(value) && Array.isArray(value.choices) && value.choices.length > 0;

const hasReadinessToolCall = (value: OpenAIChatCompletionResponse): boolean => {
	const choice = value.choices[0];
	if (!isRecord(choice) || !isRecord(choice.message)) return false;
	const calls = choice.message.tool_calls;
	if (!Array.isArray(calls)) return false;
	return calls.some((call) => {
		if (!isRecord(call) || !isRecord(call.function)) return false;
		if (
			call.type !== "function" ||
			call.function.name !== "workbenchReady" ||
			typeof call.function.arguments !== "string"
		) {
			return false;
		}
		try {
			return isRecord(JSON.parse(call.function.arguments));
		} catch {
			return false;
		}
	});
};

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const isAbortError = (error: unknown): boolean =>
	isRecord(error) && error.name === "AbortError";

function resolveConfiguration(
	options: MlxWorkbenchConfiguration,
	defaultTimeoutMs: number,
):
	| {
			ok: true;
			baseUrl: string;
			model: string;
			timeoutMs: number;
	  }
	| { ok: false; failure: ModelFailureFact } {
	const baseUrl = options.baseUrl?.trim() ?? "";
	const model = options.model?.trim() ?? "";
	if (!baseUrl || !model) {
		return {
			ok: false,
			failure: failureFact(
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
			failure: failureFact(
				"configuration",
				"The local model URL must be an HTTP or HTTPS URL.",
			),
		};
	}
	const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
	if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
		return {
			ok: false,
			failure: failureFact(
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

const requestHeaders = (apiKey?: string): Record<string, string> => ({
	"content-type": "application/json",
	...(apiKey?.trim() ? { authorization: `Bearer ${apiKey.trim()}` } : {}),
});

function requestSignal(
	timeoutMs: number,
	parent?: AbortSignal,
): {
	signal: AbortSignal;
	timedOut: () => boolean;
	cleanup: () => void;
} {
	const controller = new AbortController();
	let didTimeOut = false;
	const abortFromParent = () => controller.abort();
	if (parent?.aborted) controller.abort();
	else parent?.addEventListener("abort", abortFromParent, { once: true });
	const timeout = setTimeout(() => {
		didTimeOut = true;
		controller.abort();
	}, timeoutMs);
	return {
		signal: controller.signal,
		timedOut: () => didTimeOut,
		cleanup: () => {
			clearTimeout(timeout);
			parent?.removeEventListener("abort", abortFromParent);
		},
	};
}

/**
 * Prove that an OpenAI-compatible MLX endpoint can run inference. The launcher
 * may expose the browser while MLX is still loading, so a successful models
 * listing is intentionally insufficient for this actor fact.
 */
export async function probeMlxWorkbenchReadiness(
	options: MlxWorkbenchReadinessOptions,
): Promise<ModelReadinessFact> {
	const configuration = resolveConfiguration(options, 20 * 60_000);
	if (!configuration.ok) {
		return { type: "MODEL_FAILED", failure: configuration.failure };
	}

	if (typeof globalThis.fetch !== "function") {
		return {
			type: "MODEL_FAILED",
			failure: failureFact(
				"configuration",
				"This environment does not provide fetch for the local model request.",
			),
		};
	}

	const request = requestSignal(configuration.timeoutMs, options.signal);
	try {
		const response = await globalThis.fetch(
			`${configuration.baseUrl}/chat/completions`,
			{
				method: "POST",
				headers: requestHeaders(options.apiKey),
				body: JSON.stringify({
					model: configuration.model,
					messages: [
						{
							role: "user",
							content:
								"Call workbenchReady with an empty object. Do not answer with prose.",
						},
					],
					tools: [
						{
							type: "function",
							function: {
								name: "workbenchReady",
								description:
									"Confirm that the model can return OpenAI-compatible tool calls.",
								parameters: {
									type: "object",
									properties: {},
									additionalProperties: false,
								},
							},
						},
					],
					max_tokens: 256,
					stream: false,
					temperature: 0,
				}),
				signal: request.signal,
			},
		);
		if (!response.ok) {
			return {
				type: "MODEL_FAILED",
				failure: failureFact(
					"provider",
					"The local model rejected the readiness check.",
					response.status,
				),
			};
		}

		let payload: unknown;
		try {
			payload = await response.json();
		} catch (error) {
			if (request.signal.aborted || isAbortError(error)) {
				return {
					type: "MODEL_FAILED",
					failure: failureFact(
						"timeout",
						"The local model readiness check timed out.",
					),
				};
			}
			return {
				type: "MODEL_FAILED",
				failure: failureFact(
					"invalid-response",
					"The local model returned an invalid readiness response.",
				),
			};
		}
		if (!isCompletionResponse(payload)) {
			return {
				type: "MODEL_FAILED",
				failure: failureFact(
					"invalid-response",
					"The local model returned an invalid readiness response.",
				),
			};
		}
		if (!hasReadinessToolCall(payload)) {
			return {
				type: "MODEL_FAILED",
				failure: failureFact(
					"invalid-response",
					"The local model did not return an OpenAI-compatible tool call.",
				),
			};
		}
		return { type: "MODEL_AVAILABLE" };
	} catch (error) {
		if (request.timedOut() || request.signal.aborted || isAbortError(error)) {
			return {
				type: "MODEL_FAILED",
				failure: failureFact(
					"timeout",
					"The local model readiness check timed out.",
				),
			};
		}
		return {
			type: "MODEL_FAILED",
			failure: failureFact("network", "The local model could not be reached."),
		};
	} finally {
		request.cleanup();
	}
}

function requestBody(
	request: ModelRequest,
	model: string,
	tools: ReturnType<typeof openai.tools>,
): string {
	const messages: unknown[] = [
		{
			role: "system",
			content: [SYSTEM_PROMPT, request.domainPolicyInstructions?.trim()]
				.filter(Boolean)
				.join("\n"),
		},
		{
			role: "user",
			content: JSON.stringify({
				prompt: request.prompt,
				currentAcceptedView: request.view,
				capabilities: request.capabilities,
			}),
		},
	];
	for (const exchange of request.history) {
		messages.push({
			role: "assistant",
			content: null,
			tool_calls: exchange.calls.map((call) => ({
				id: call.id,
				type: "function",
				function: {
					name: call.command,
					arguments: JSON.stringify(call.input ?? {}),
				},
			})),
		});
		for (const result of exchange.results) {
			messages.push(
				openai.toolResult({
					id: result.id,
					name: result.command,
					result: ok({
						snapshot: {
							outcome: result.status,
							...(result.ownerId ? { ownerId: result.ownerId } : {}),
							...(result.reason ? { reason: result.reason } : {}),
							...(result.issues ? { issues: result.issues } : {}),
							...(result.providerStatus === undefined
								? {}
								: { providerStatus: result.providerStatus }),
							...(result.fact === undefined ? {} : { fact: result.fact }),
							...(result.receipt ? { receipt: result.receipt } : {}),
							events: result.events,
						},
						view: result.view,
						events: [],
					}),
				}),
			);
		}
	}
	if (request.history.length > 0) {
		messages.push({
			role: "user",
			content: JSON.stringify({
				instruction:
					"Continue the original request from the latest accepted actor view. Correct it if needed; otherwise complete the response.",
				currentAcceptedView: request.view,
				currentlyAuthorizedCommands: request.tools.map((tool) => tool.name),
				capabilities: request.capabilities,
			}),
		});
	}
	return JSON.stringify({
		model,
		messages,
		tools,
		tool_choice: "required",
		max_tokens: 2048,
		temperature: 0,
	});
}

/**
 * Request one model turn from an OpenAI-compatible MLX server. The request and
 * configuration are plain data; browser I/O stays at this provider boundary.
 */
export async function requestMlxWorkbenchModel(
	options: MlxWorkbenchConfiguration,
	request: ModelRequest,
	signal?: AbortSignal,
): Promise<ModelResult> {
	const configuration = resolveConfiguration(options, 30_000);
	if (!configuration.ok) return { ok: false, error: configuration.failure };

	if (typeof globalThis.fetch !== "function") {
		return failure(
			"configuration",
			"This environment does not provide fetch for the local model request.",
		);
	}

	const currentTools = openai.tools(request.tools);
	const headers = requestHeaders(options.apiKey);
	const requestAbort = requestSignal(configuration.timeoutMs, signal);
	let response: Response;
	try {
		response = await globalThis.fetch(
			`${configuration.baseUrl}/chat/completions`,
			{
				method: "POST",
				headers,
				body: requestBody(request, configuration.model, currentTools),
				signal: requestAbort.signal,
			},
		);
	} catch (error) {
		if (requestAbort.signal.aborted || isAbortError(error)) {
			requestAbort.cleanup();
			return failure("timeout", "The local model request timed out.");
		}
		requestAbort.cleanup();
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
			if (requestAbort.signal.aborted || isAbortError(error)) {
				return failure("timeout", "The local model request timed out.");
			}
			return failure(
				"invalid-response",
				"The local model returned invalid JSON.",
			);
		}
		if (!isCompletionResponse(payload)) {
			return failure(
				"invalid-response",
				"The local model returned an invalid completion envelope.",
			);
		}
		const calls = openai.toolCalls(payload, request.tools);
		if (calls.length === 0) {
			return failure(
				"invalid-response",
				"The local model returned no authorized compatible tool call.",
			);
		}
		return {
			ok: true,
			calls: calls.map((call) => ({
				id: call.id,
				command: call.name,
				input: call.input,
			})),
		};
	} finally {
		requestAbort.cleanup();
	}
}

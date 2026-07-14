import type { NeutralManifest, NeutralToolCall } from "ignite-element/tools";
import type {
	CapabilityExecutionFact,
	CapabilityOwner,
} from "./capability-federation";

export type WebSearchInput = { query: string; count: number };
export type WebSearchResult = {
	title: string;
	url: string;
	description: string;
};
export type WebSearchFact = {
	query: string;
	results: WebSearchResult[];
};

type FetchLike = (
	input: RequestInfo | URL,
	init?: RequestInit,
) => Promise<Response>;

export type WebSearchCapabilityOptions = {
	endpoint?: string;
	fetch?: FetchLike;
	timeoutMs?: number;
};

const SEARCH_TOOL_NAME = "searchWeb";

const webSearchManifest: NeutralManifest = [
	{
		name: SEARCH_TOOL_NAME,
		description:
			"Search the public web for current source-backed facts. Use the returned URLs as citations in semantic artifacts.",
		inputSchema: {
			type: "object",
			properties: {
				query: {
					type: "string",
					minLength: 1,
					maxLength: 400,
					description: "A focused public-web search query.",
				},
				count: {
					type: "number",
					minimum: 1,
					maximum: 20,
					description: "Maximum source results to return.",
				},
			},
			required: ["query"],
			additionalProperties: false,
		},
		gated: false,
	},
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

export const readWebSearchInput = (
	value: unknown,
): { ok: true; value: WebSearchInput } | { ok: false; issues: string[] } => {
	if (!isRecord(value)) {
		return { ok: false, issues: ["input: expected an object"] };
	}
	const query = typeof value.query === "string" ? value.query.trim() : "";
	const issues: string[] = [];
	if (!query) issues.push("query: expected a non-empty string");
	else if (query.length > 400) issues.push("query: expected at most 400 characters");

	const requestedCount = value.count ?? 5;
	const count =
		typeof requestedCount === "number" && Number.isInteger(requestedCount)
			? requestedCount
			: Number.NaN;
	if (!Number.isFinite(count) || count < 1 || count > 20) {
		issues.push("count: expected an integer from 1 to 20");
	}
	return issues.length > 0
		? { ok: false, issues }
		: { ok: true, value: { query, count } };
};

const isSearchResult = (value: unknown): value is WebSearchResult =>
	isRecord(value) &&
	typeof value.title === "string" &&
	typeof value.url === "string" &&
	typeof value.description === "string";

const readCapabilityFact = (value: unknown): CapabilityExecutionFact | null => {
	if (!isRecord(value) || typeof value.type !== "string") return null;
	const ownerId =
		typeof value.ownerId === "string" ? value.ownerId : "web-search";
	const toolName =
		typeof value.toolName === "string" ? value.toolName : SEARCH_TOOL_NAME;
	if (value.type === "success") {
		if (
			!isRecord(value.data) ||
			typeof value.data.query !== "string" ||
			!Array.isArray(value.data.results) ||
			!value.data.results.every(isSearchResult) ||
			!isRecord(value.receipt) ||
			typeof value.receipt.provider !== "string"
		) {
			return null;
		}
		return {
			type: "success",
			ownerId,
			toolName,
			data: {
				query: value.data.query,
				results: value.data.results,
			},
			receipt: {
				provider: value.receipt.provider,
				...(typeof value.receipt.sourceCount === "number"
					? { sourceCount: value.receipt.sourceCount }
					: {}),
			},
		};
	}
	if (
		value.type === "unavailable" ||
		value.type === "validation" ||
		value.type === "timeout" ||
		value.type === "provider-failure"
	) {
		if (typeof value.message !== "string") return null;
		return {
			type: value.type,
			ownerId,
			toolName,
			message: value.message,
			...(Array.isArray(value.issues) &&
			value.issues.every((issue) => typeof issue === "string")
				? { issues: value.issues }
				: {}),
			...(typeof value.status === "number" ? { status: value.status } : {}),
		};
	}
	return null;
};

const failed = (
	type: "unavailable" | "validation" | "timeout" | "provider-failure",
	message: string,
	extra: { issues?: readonly string[]; status?: number } = {},
): CapabilityExecutionFact => ({
	type,
	ownerId: "web-search",
	toolName: SEARCH_TOOL_NAME,
	message,
	...extra,
});

export const createWebSearchCapability = (
	options: WebSearchCapabilityOptions = {},
): CapabilityOwner => ({
	id: "web-search",
	manifest: webSearchManifest,
	run: async (call: NeutralToolCall): Promise<CapabilityExecutionFact> => {
		if (call.name !== SEARCH_TOOL_NAME) {
			return failed(
				"unavailable",
				"The capability is not available in this provider.",
			);
		}
		const input = readWebSearchInput(call.input);
		if (!input.ok) {
			return failed("validation", "The web search input is invalid.", {
				issues: input.issues,
			});
		}
		const fetcher = options.fetch ?? globalThis.fetch;
		if (typeof fetcher !== "function") {
			return failed(
				"unavailable",
				"This environment cannot reach the web search capability.",
			);
		}

		const controller = new AbortController();
		const timeout = setTimeout(
			() => controller.abort(),
			options.timeoutMs ?? 10_000,
		);
		try {
			const response = await fetcher(
				options.endpoint ?? "/api/capabilities/web-search",
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(input.value),
					signal: controller.signal,
				},
			);
			if (!response.ok) {
				return failed(
					"provider-failure",
					"The web search capability rejected the request.",
					{ status: response.status },
				);
			}
			let payload: unknown;
			try {
				payload = await response.json();
			} catch {
				return failed(
					"provider-failure",
					"The web search capability returned an invalid response.",
				);
			}
			const fact = readCapabilityFact(payload);
			if (!fact) {
				return failed(
					"provider-failure",
					"The web search capability returned an invalid response.",
				);
			}
			return { ...fact, ownerId: "web-search", toolName: SEARCH_TOOL_NAME };
		} catch {
			return controller.signal.aborted
				? failed("timeout", "The web search capability timed out.")
				: failed(
						"provider-failure",
						"The web search capability could not be reached.",
					);
		} finally {
			clearTimeout(timeout);
		}
	},
});

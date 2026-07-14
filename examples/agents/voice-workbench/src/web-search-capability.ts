import type { NeutralManifest, NeutralToolCall } from "ignite-element/tools";
import type {
	CapabilityExecutionFact,
	CapabilityOwner,
} from "./capability-federation";

export type WebSearchInput = {
	queries: string[];
	countPerQuery: number;
	country?: string;
};
export type WebSearchResult = {
	title: string;
	url: string;
	description: string;
};
export type WebSearchFact = {
	searches: Array<{
		query: string;
		results: WebSearchResult[];
	}>;
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
			"Search the public web for current source-backed facts using 1 to 8 focused queries. Put returned URLs in semantic table cells as citations.",
		inputSchema: {
			type: "object",
			properties: {
				queries: {
					type: "array",
					minItems: 1,
					maxItems: 8,
					items: {
						type: "string",
						minLength: 1,
						maxLength: 400,
					},
					description: "One focused query for each fact to research.",
				},
				country: {
					type: "string",
					minLength: 2,
					maxLength: 2,
					description: "Optional two-letter search country code.",
				},
				countPerQuery: {
					type: "number",
					minimum: 1,
					maximum: 5,
					description: "Maximum source results per query.",
				},
			},
			required: ["queries"],
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
	const issues: string[] = [];
	const queries = Array.isArray(value.queries)
		? value.queries.map((query, index) => {
				if (typeof query !== "string" || !query.trim()) {
					issues.push(`queries.${index}: expected a non-empty string`);
					return "";
				}
				const normalized = query.trim();
				if (normalized.length > 400) {
					issues.push(`queries.${index}: expected at most 400 characters`);
				}
				return normalized;
			})
		: [];
	if (
		!Array.isArray(value.queries) ||
		queries.length < 1 ||
		queries.length > 8
	) {
		issues.unshift("queries: expected between 1 and 8 queries");
	}

	const requestedCount = value.countPerQuery ?? 3;
	const countPerQuery =
		typeof requestedCount === "number" && Number.isInteger(requestedCount)
			? requestedCount
			: Number.NaN;
	if (
		!Number.isFinite(countPerQuery) ||
		countPerQuery < 1 ||
		countPerQuery > 5
	) {
		issues.push("countPerQuery: expected an integer from 1 to 5");
	}

	const country =
		typeof value.country === "string" ? value.country.trim().toLowerCase() : "";
	if (value.country !== undefined && !/^[a-z]{2}$/.test(country)) {
		issues.push("country: expected a two-letter country code");
	}

	return issues.length > 0
		? { ok: false, issues }
		: {
				ok: true,
				value: {
					queries,
					countPerQuery,
					...(country ? { country } : {}),
				},
			};
};

const isSearchResult = (value: unknown): value is WebSearchResult =>
	isRecord(value) &&
	typeof value.title === "string" &&
	typeof value.url === "string" &&
	typeof value.description === "string";

const isSearchFact = (
	value: unknown,
): value is WebSearchFact["searches"][number] =>
	isRecord(value) &&
	typeof value.query === "string" &&
	Array.isArray(value.results) &&
	value.results.every(isSearchResult);

const readCapabilityFact = (value: unknown): CapabilityExecutionFact | null => {
	if (!isRecord(value) || typeof value.type !== "string") return null;
	const ownerId =
		typeof value.ownerId === "string" ? value.ownerId : "web-search";
	const toolName =
		typeof value.toolName === "string" ? value.toolName : SEARCH_TOOL_NAME;
	if (value.type === "success") {
		if (
			!isRecord(value.data) ||
			!Array.isArray(value.data.searches) ||
			!value.data.searches.every(isSearchFact) ||
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
				searches: value.data.searches,
			},
			receipt: {
				provider: value.receipt.provider,
				...(typeof value.receipt.queryCount === "number"
					? { queryCount: value.receipt.queryCount }
					: {}),
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

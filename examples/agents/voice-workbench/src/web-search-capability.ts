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

export const WEB_SEARCH_LIMITS = Object.freeze({
	queryCount: 8,
	queryLength: 400,
	resultsPerQuery: 5,
	totalSources: 24,
	titleLength: 160,
	urlLength: 2_048,
	descriptionLength: 500,
	providerLength: 80,
	candidateResultsPerQuery: 20,
});

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
					maxItems: WEB_SEARCH_LIMITS.queryCount,
					items: {
						type: "string",
						minLength: 1,
						maxLength: WEB_SEARCH_LIMITS.queryLength,
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
					maximum: WEB_SEARCH_LIMITS.resultsPerQuery,
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
				if (normalized.length > WEB_SEARCH_LIMITS.queryLength) {
					issues.push(
						`queries.${index}: expected at most ${WEB_SEARCH_LIMITS.queryLength} characters`,
					);
				}
				return normalized;
			})
		: [];
	if (
		!Array.isArray(value.queries) ||
		queries.length < 1 ||
		queries.length > WEB_SEARCH_LIMITS.queryCount
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
		countPerQuery > WEB_SEARCH_LIMITS.resultsPerQuery
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

const boundedText = (value: string, maximum: number): string =>
	value.trim().slice(0, maximum);

export const sanitizeWebSearchResult = (
	value: unknown,
): WebSearchResult | null => {
	if (
		!isRecord(value) ||
		typeof value.title !== "string" ||
		typeof value.url !== "string"
	) {
		return null;
	}
	const urlValue = value.url.trim();
	if (!urlValue || urlValue.length > WEB_SEARCH_LIMITS.urlLength) return null;
	try {
		const url = new URL(urlValue);
		if (url.protocol !== "https:" && url.protocol !== "http:") return null;
	} catch {
		return null;
	}
	return {
		title: boundedText(value.title, WEB_SEARCH_LIMITS.titleLength),
		url: urlValue,
		description:
			typeof value.description === "string"
				? boundedText(value.description, WEB_SEARCH_LIMITS.descriptionLength)
				: "",
	};
};

const sanitizeSearches = (value: unknown): WebSearchFact["searches"] | null => {
	if (!Array.isArray(value)) return null;
	let remainingSources = WEB_SEARCH_LIMITS.totalSources;
	const searches: WebSearchFact["searches"] = [];
	for (const candidate of value.slice(0, WEB_SEARCH_LIMITS.queryCount)) {
		if (
			!isRecord(candidate) ||
			typeof candidate.query !== "string" ||
			!Array.isArray(candidate.results)
		) {
			return null;
		}
		const results: WebSearchResult[] = [];
		for (const source of candidate.results.slice(
			0,
			WEB_SEARCH_LIMITS.candidateResultsPerQuery,
		)) {
			if (
				results.length >= WEB_SEARCH_LIMITS.resultsPerQuery ||
				remainingSources <= 0
			) {
				break;
			}
			const sanitized = sanitizeWebSearchResult(source);
			if (!sanitized) continue;
			results.push(sanitized);
			remainingSources -= 1;
		}
		searches.push({
			query: boundedText(candidate.query, WEB_SEARCH_LIMITS.queryLength),
			results,
		});
	}
	return searches;
};

const readCapabilityFact = (value: unknown): CapabilityExecutionFact | null => {
	if (!isRecord(value) || typeof value.type !== "string") return null;
	const ownerId =
		typeof value.ownerId === "string" ? value.ownerId : "web-search";
	const toolName =
		typeof value.toolName === "string" ? value.toolName : SEARCH_TOOL_NAME;
	if (value.type === "success") {
		const searches = isRecord(value.data)
			? sanitizeSearches(value.data.searches)
			: null;
		if (
			!searches ||
			!isRecord(value.receipt) ||
			typeof value.receipt.provider !== "string"
		) {
			return null;
		}
		return {
			type: "success",
			ownerId,
			toolName,
			data: { searches },
			receipt: {
				provider: boundedText(
					value.receipt.provider,
					WEB_SEARCH_LIMITS.providerLength,
				),
				queryCount: searches.length,
				sourceCount: searches.reduce(
					(total, search) => total + search.results.length,
					0,
				),
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

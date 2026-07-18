import type { NeutralManifest, NeutralToolCall } from "ignite-element/tools";
import type {
	CapabilityExecutionFact,
	CapabilityFallbackAttempt,
	CapabilityOwner,
} from "./capability-federation";

export type WebSearchInput = {
	queries: WebSearchQuery[];
	countPerQuery: number;
	country?: string;
};
export type WebSearchQuery = {
	subject: string;
	query: string;
};
export type WebSearchResult = {
	title: string;
	url: string;
	description: string;
};
export type WebSearchPriceFact =
	| {
			status: "sourced";
			amount: number;
			display: string;
			sourceUrl: string;
	  }
	| {
			status: "unverified";
			amount: null;
			sourceUrl: string | null;
			reason: "No single explicit price was found in the returned sources.";
	  };
export type WebSearchFact = {
	searches: Array<{
		subject: string;
		query: string;
		price: WebSearchPriceFact;
		results: WebSearchResult[];
	}>;
};

export const WEB_SEARCH_LIMITS = Object.freeze({
	queryCount: 8,
	subjectLength: 120,
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
			"Search the public web for current source-backed facts using 1 to 8 subject/query pairs. Each subject returns either one unambiguous sourced price or an explicit unverified fact. Materialize subject, price, status, and source in semantic table cells.",
		inputSchema: {
			type: "object",
			properties: {
				queries: {
					type: "array",
					minItems: 1,
					maxItems: WEB_SEARCH_LIMITS.queryCount,
					items: {
						type: "object",
						properties: {
							subject: {
								type: "string",
								minLength: 1,
								maxLength: WEB_SEARCH_LIMITS.subjectLength,
							},
							query: {
								type: "string",
								minLength: 1,
								maxLength: WEB_SEARCH_LIMITS.queryLength,
							},
						},
						required: ["subject", "query"],
						additionalProperties: false,
					},
					description:
						"One stable subject identity and one focused query for each fact to research.",
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
	const queries: WebSearchQuery[] = Array.isArray(value.queries)
		? value.queries.map((candidate, index) => {
				if (!isRecord(candidate)) {
					issues.push(`queries.${index}: expected an object`);
					return { subject: "", query: "" };
				}
				const subject =
					typeof candidate.subject === "string" ? candidate.subject.trim() : "";
				const query =
					typeof candidate.query === "string" ? candidate.query.trim() : "";
				if (!subject) {
					issues.push(`queries.${index}.subject: expected a non-empty string`);
				} else if (subject.length > WEB_SEARCH_LIMITS.subjectLength) {
					issues.push(
						`queries.${index}.subject: expected at most ${WEB_SEARCH_LIMITS.subjectLength} characters`,
					);
				}
				if (!query) {
					issues.push(`queries.${index}.query: expected a non-empty string`);
				} else if (query.length > WEB_SEARCH_LIMITS.queryLength) {
					issues.push(
						`queries.${index}.query: expected at most ${WEB_SEARCH_LIMITS.queryLength} characters`,
					);
				}
				return { subject, query };
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

const UNVERIFIED_PRICE_REASON =
	"No single explicit price was found in the returned sources." as const;
const EXPLICIT_PRICE = /(?:US\s*)?\$\s*(\d{1,6}(?:,\d{3})*\.\d{2})(?!\d)/gi;
const DISCOUNT_CONTEXT =
	/\b(?:coupon|discount|promo(?:tion)?|save|savings)\b|\b(?:off)\b/i;
const ITEM_PRICE_PREFIX =
	/\b(?:price|priced|cost|costs|now|only|for|from|at)\b[^$]{0,16}$/i;
const ITEM_PRICE_SUFFIX =
	/^\s*(?:each\b|ea\.?\b|per\b|\/\s*(?:lb|oz|kg|item|unit)\b|at\b|from\b)/i;

const hasConservativeItemPriceContext = (
	text: string,
	match: RegExpMatchArray,
): boolean => {
	const start = match.index ?? 0;
	const end = start + match[0].length;
	const before = text.slice(Math.max(0, start - 48), start);
	const after = text.slice(end, end + 32);
	if (DISCOUNT_CONTEXT.test(`${before} ${after}`)) return false;
	return ITEM_PRICE_PREFIX.test(before) || ITEM_PRICE_SUFFIX.test(after);
};

export const deriveWebSearchPriceFact = (
	results: readonly WebSearchResult[],
): WebSearchPriceFact => {
	for (const result of results) {
		const prices = new Map<number, string>();
		const text = `${result.title} ${result.description}`;
		for (const match of text.matchAll(EXPLICIT_PRICE)) {
			if (!hasConservativeItemPriceContext(text, match)) continue;
			const numeric = match[1]?.replace(/,/g, "");
			const amount = numeric ? Number(numeric) : Number.NaN;
			if (Number.isFinite(amount) && amount >= 0) {
				prices.set(amount, `$${numeric}`);
			}
		}
		if (prices.size === 1) {
			const [amount, display] = prices.entries().next().value ?? [];
			if (amount !== undefined && display !== undefined) {
				return {
					status: "sourced",
					amount,
					display,
					sourceUrl: result.url,
				};
			}
		}
	}
	return {
		status: "unverified",
		amount: null,
		sourceUrl: results[0]?.url ?? null,
		reason: UNVERIFIED_PRICE_REASON,
	};
};

const sanitizeSearches = (value: unknown): WebSearchFact["searches"] | null => {
	if (!Array.isArray(value)) return null;
	let remainingSources = WEB_SEARCH_LIMITS.totalSources;
	const searches: WebSearchFact["searches"] = [];
	for (const candidate of value.slice(0, WEB_SEARCH_LIMITS.queryCount)) {
		if (
			!isRecord(candidate) ||
			typeof candidate.subject !== "string" ||
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
			subject: boundedText(candidate.subject, WEB_SEARCH_LIMITS.subjectLength),
			query: boundedText(candidate.query, WEB_SEARCH_LIMITS.queryLength),
			price: deriveWebSearchPriceFact(results),
			results,
		});
	}
	return searches;
};

const readFallbackAttempt = (
	value: unknown,
): CapabilityFallbackAttempt | undefined => {
	if (
		!isRecord(value) ||
		typeof value.from !== "string" ||
		typeof value.provider !== "string" ||
		typeof value.status !== "number" ||
		!Number.isFinite(value.status) ||
		(value.outcome !== "success" &&
			value.outcome !== "failure" &&
			value.outcome !== "timeout" &&
			value.outcome !== "threw")
	) {
		return undefined;
	}
	return {
		from: boundedText(value.from, 80),
		provider: boundedText(value.provider, WEB_SEARCH_LIMITS.providerLength),
		status: Math.min(Math.max(Math.floor(value.status), 100), 599),
		outcome: value.outcome,
	};
};

export const readSourcedSearchCapabilityFact = (
	value: unknown,
): CapabilityExecutionFact | null => {
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
		const fallback = readFallbackAttempt(value.receipt.fallback);
		const queryCount =
			typeof value.receipt.queryCount === "number" &&
			Number.isInteger(value.receipt.queryCount) &&
			value.receipt.queryCount >= 0
				? Math.min(value.receipt.queryCount, WEB_SEARCH_LIMITS.queryCount)
				: searches.length;
		const sourceCount =
			typeof value.receipt.sourceCount === "number" &&
			Number.isInteger(value.receipt.sourceCount) &&
			value.receipt.sourceCount >= 0
				? Math.min(value.receipt.sourceCount, WEB_SEARCH_LIMITS.totalSources)
				: searches.reduce((total, search) => total + search.results.length, 0);
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
				queryCount,
				sourceCount,
				...(isRecord(value.receipt.cache) &&
				(value.receipt.cache.status === "miss" ||
					value.receipt.cache.status === "hit" ||
					value.receipt.cache.status === "coalesced") &&
				typeof value.receipt.cache.ttlMs === "number" &&
				Number.isFinite(value.receipt.cache.ttlMs)
					? {
							cache: {
								status: value.receipt.cache.status,
								ttlMs: Math.min(
									Math.max(Math.floor(value.receipt.cache.ttlMs), 0),
									300_000,
								),
							},
						}
					: {}),
				...(fallback ? { fallback } : {}),
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
		const fallback = readFallbackAttempt(value.fallback);
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
			...(isRecord(value.retry) &&
			typeof value.retry.attempts === "number" &&
			typeof value.retry.maxAttempts === "number" &&
			typeof value.retry.exhausted === "boolean"
				? {
						retry: {
							attempts: Math.min(
								Math.max(Math.floor(value.retry.attempts), 1),
								4,
							),
							maxAttempts: Math.min(
								Math.max(Math.floor(value.retry.maxAttempts), 1),
								4,
							),
							...(typeof value.retry.retryAfterMs === "number" &&
							Number.isFinite(value.retry.retryAfterMs)
								? {
										retryAfterMs: Math.min(
											Math.max(Math.floor(value.retry.retryAfterMs), 0),
											10_000,
										),
									}
								: {}),
							exhausted: value.retry.exhausted,
						},
					}
				: {}),
			...(fallback ? { fallback } : {}),
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
			const fact = readSourcedSearchCapabilityFact(payload);
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

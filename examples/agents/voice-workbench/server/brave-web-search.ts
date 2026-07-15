import type { NeutralToolCall } from "ignite-element/tools";
import type { CapabilityExecutionFact } from "../src/capability-federation";
import {
	deriveWebSearchPriceFact,
	readWebSearchInput,
	sanitizeWebSearchResult,
	WEB_SEARCH_LIMITS,
	type WebSearchFact,
	type WebSearchInput,
	type WebSearchQuery,
	type WebSearchResult,
} from "../src/web-search-capability";

type FetchLike = (
	input: RequestInfo | URL,
	init?: RequestInit,
) => Promise<Response>;

export type BraveWebSearchOptions = {
	apiKey?: string;
	fetch?: FetchLike;
	timeoutMs?: number;
	maxRetries?: number;
	maxRetryAfterMs?: number;
	cacheTtlMs?: number;
	now?: () => number;
	sleep?: (milliseconds: number) => Promise<void>;
	fallback?: {
		provider: string;
		statuses?: readonly number[];
		run(call: NeutralToolCall): Promise<CapabilityExecutionFact>;
	};
};

const OWNER_ID = "brave-web-search";
const TOOL_NAME = "searchWeb";
const DEFAULT_CACHE_TTL_MS = 15_000;
const DEFAULT_MAX_RETRY_AFTER_MS = 2_000;
const DEFAULT_MAX_RETRIES = 1;
const MAX_CACHE_ENTRIES = 32;
const RETRYABLE_STATUSES = new Set([429, 503]);

type SuccessfulCapabilityFact = Extract<
	CapabilityExecutionFact,
	{ type: "success" }
>;
type RequestState = {
	cache: Map<string, { expiresAt: number; fact: SuccessfulCapabilityFact }>;
	inflight: Map<string, Promise<CapabilityExecutionFact>>;
};
const requestStateByFetcher = new WeakMap<FetchLike, RequestState>();

const requestState = (fetcher: FetchLike): RequestState => {
	const existing = requestStateByFetcher.get(fetcher);
	if (existing) return existing;
	const created = {
		cache: new Map<
			string,
			{ expiresAt: number; fact: SuccessfulCapabilityFact }
		>(),
		inflight: new Map<string, Promise<CapabilityExecutionFact>>(),
	};
	requestStateByFetcher.set(fetcher, created);
	return created;
};

const boundedInteger = (
	value: number | undefined,
	fallbackValue: number,
	maximum: number,
): number =>
	typeof value === "number" && Number.isFinite(value)
		? Math.min(Math.max(Math.floor(value), 0), maximum)
		: fallbackValue;

const defaultSleep = (milliseconds: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, milliseconds));

const retryAfterMilliseconds = (
	header: string | null,
	now: number,
	maximum: number,
): number => {
	if (!header) return 0;
	const seconds = Number(header);
	const requested = Number.isFinite(seconds)
		? seconds * 1_000
		: Date.parse(header) - now;
	if (!Number.isFinite(requested)) return 0;
	return Math.min(Math.max(Math.ceil(requested), 0), maximum);
};

const waitForRetry = async (
	milliseconds: number,
	sleep: (milliseconds: number) => Promise<void>,
	signal: AbortSignal,
): Promise<void> => {
	if (milliseconds <= 0 || signal.aborted) return;
	let abort: (() => void) | undefined;
	const aborted = new Promise<void>((resolve) => {
		abort = resolve;
		signal.addEventListener("abort", resolve, { once: true });
	});
	try {
		await Promise.race([sleep(milliseconds), aborted]);
	} finally {
		if (abort) signal.removeEventListener("abort", abort);
	}
};

const withCacheStatus = (
	fact: SuccessfulCapabilityFact,
	status: "miss" | "hit" | "coalesced",
	ttlMs: number,
): SuccessfulCapabilityFact => ({
	...fact,
	receipt: { ...fact.receipt, cache: { status, ttlMs } },
});

const failure = (
	type: "unavailable" | "validation" | "timeout" | "provider-failure",
	message: string,
	extra: {
		issues?: readonly string[];
		status?: number;
		retry?: {
			attempts: number;
			maxAttempts: number;
			retryAfterMs?: number;
			exhausted: boolean;
		};
	} = {},
): CapabilityExecutionFact => ({
	type,
	ownerId: OWNER_ID,
	toolName: TOOL_NAME,
	message,
	...extra,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

type SearchOutcome =
	| { ok: true; search: WebSearchFact["searches"][number] }
	| { ok: false; fact: CapabilityExecutionFact };

const requestBraveQuery = async (
	request: WebSearchQuery,
	input: WebSearchInput,
	apiKey: string,
	fetcher: FetchLike,
	signal: AbortSignal,
	retry: {
		maxRetries: number;
		maxRetryAfterMs: number;
		now: () => number;
		sleep: (milliseconds: number) => Promise<void>;
	},
): Promise<SearchOutcome> => {
	const endpoint = new URL("https://api.search.brave.com/res/v1/web/search");
	endpoint.searchParams.set("q", request.query);
	endpoint.searchParams.set("count", String(input.countPerQuery));
	endpoint.searchParams.set("safesearch", "moderate");
	if (input.country) endpoint.searchParams.set("country", input.country);

	let latestRetryAfterMs: number | undefined;
	for (let attempt = 0; attempt <= retry.maxRetries; attempt += 1) {
		try {
			const response = await fetcher(endpoint, {
				headers: {
					accept: "application/json",
					"X-Subscription-Token": apiKey,
				},
				signal,
			});
			if (!response.ok) {
				const retryable = RETRYABLE_STATUSES.has(response.status);
				const retryAfterMs = retryAfterMilliseconds(
					response.headers.get("Retry-After"),
					retry.now(),
					retry.maxRetryAfterMs,
				);
				if (response.headers.has("Retry-After")) {
					latestRetryAfterMs = retryAfterMs;
				}
				if (retryable && attempt < retry.maxRetries && !signal.aborted) {
					await waitForRetry(retryAfterMs, retry.sleep, signal);
					if (!signal.aborted) continue;
				}
				return {
					ok: false,
					fact: failure(
						"provider-failure",
						"Brave Web Search rejected the request.",
						{
							status: response.status,
							...(retryable
								? {
										retry: {
											attempts: attempt + 1,
											maxAttempts: retry.maxRetries + 1,
											...(latestRetryAfterMs === undefined
												? {}
												: { retryAfterMs: latestRetryAfterMs }),
											exhausted: attempt >= retry.maxRetries,
										},
									}
								: {}),
						},
					),
				};
			}
			const payload: unknown = await response.json().catch(() => null);
			if (!isRecord(payload) || !isRecord(payload.web)) {
				return {
					ok: false,
					fact: failure(
						"provider-failure",
						"Brave Web Search returned an invalid response.",
					),
				};
			}
			const candidates = Array.isArray(payload.web.results)
				? payload.web.results
				: [];
			const results = candidates
				.slice(0, WEB_SEARCH_LIMITS.candidateResultsPerQuery)
				.map(sanitizeWebSearchResult)
				.filter((result): result is WebSearchResult => result !== null)
				.slice(0, input.countPerQuery);
			return {
				ok: true,
				search: {
					...request,
					price: deriveWebSearchPriceFact(results),
					results,
				},
			};
		} catch {
			return {
				ok: false,
				fact: signal.aborted
					? failure("timeout", "Brave Web Search timed out.")
					: failure(
							"provider-failure",
							"Brave Web Search could not be reached.",
						),
			};
		}
	}
	return {
		ok: false,
		fact: failure("provider-failure", "Brave Web Search could not be reached."),
	};
};

const executeBraveWebSearch = async (
	call: NeutralToolCall,
	input: WebSearchInput,
	apiKey: string,
	fetcher: FetchLike,
	options: BraveWebSearchOptions,
): Promise<CapabilityExecutionFact> => {
	const controller = new AbortController();
	let timedOut = false;
	const timeout = setTimeout(() => {
		timedOut = true;
		controller.abort();
	}, options.timeoutMs ?? 8_000);
	try {
		let firstFailure: CapabilityExecutionFact | null = null;
		const outcomes = await Promise.all(
			input.queries.map(async (query) => {
				const outcome = await requestBraveQuery(
					query,
					input,
					apiKey,
					fetcher,
					controller.signal,
					{
						maxRetries: boundedInteger(
							options.maxRetries,
							DEFAULT_MAX_RETRIES,
							3,
						),
						maxRetryAfterMs: boundedInteger(
							options.maxRetryAfterMs,
							DEFAULT_MAX_RETRY_AFTER_MS,
							10_000,
						),
						now: options.now ?? Date.now,
						sleep: options.sleep ?? defaultSleep,
					},
				);
				if (!outcome.ok && firstFailure === null) {
					firstFailure = outcome.fact;
					controller.abort();
				}
				return outcome;
			}),
		);
		if (firstFailure) {
			if (timedOut) return failure("timeout", "Brave Web Search timed out.");
			const status = firstFailure.status;
			const eligible =
				firstFailure.type === "provider-failure" &&
				typeof status === "number" &&
				firstFailure.retry?.exhausted === true &&
				options.fallback &&
				(options.fallback.statuses ?? [429, 503]).includes(status);
			if (eligible && options.fallback) {
				try {
					const fallback = await options.fallback.run(call);
					if (fallback.type === "success") {
						return {
							...fallback,
							receipt: {
								...fallback.receipt,
								provider: options.fallback.provider,
								fallback: { from: OWNER_ID, status },
							},
						};
					}
				} catch {
					return firstFailure;
				}
			}
			return firstFailure;
		}
		let remainingSources = WEB_SEARCH_LIMITS.totalSources;
		const searches = outcomes
			.flatMap((outcome) => (outcome.ok ? [outcome.search] : []))
			.map((search) => {
				const results = search.results.slice(0, remainingSources);
				remainingSources -= results.length;
				return { ...search, results };
			});
		return {
			type: "success",
			ownerId: OWNER_ID,
			toolName: TOOL_NAME,
			data: { searches },
			receipt: {
				provider: OWNER_ID,
				queryCount: searches.length,
				sourceCount: searches.reduce(
					(total, search) => total + search.results.length,
					0,
				),
			},
		};
	} catch {
		return timedOut
			? failure("timeout", "Brave Web Search timed out.")
			: failure("provider-failure", "Brave Web Search could not be reached.");
	} finally {
		clearTimeout(timeout);
		controller.abort();
	}
};

export async function runBraveWebSearch(
	call: NeutralToolCall,
	options: BraveWebSearchOptions,
): Promise<CapabilityExecutionFact> {
	const apiKey = options.apiKey?.trim() ?? "";
	if (!apiKey) {
		return failure(
			"unavailable",
			"Web search is not configured for this workbench.",
		);
	}
	if (call.name !== TOOL_NAME) {
		return failure(
			"unavailable",
			"The requested capability is not available from this provider.",
		);
	}
	const input = readWebSearchInput(call.input);
	if (!input.ok) {
		return failure("validation", "The web search input is invalid.", {
			issues: input.issues,
		});
	}
	const fetcher = options.fetch ?? globalThis.fetch;
	if (typeof fetcher !== "function") {
		return failure(
			"unavailable",
			"The server does not provide web search transport.",
		);
	}

	const now = options.now ?? Date.now;
	const cacheTtlMs = boundedInteger(
		options.cacheTtlMs,
		DEFAULT_CACHE_TTL_MS,
		300_000,
	);
	const state = requestState(fetcher);
	const key = JSON.stringify([apiKey, input.value]);
	for (const [cacheKey, entry] of state.cache) {
		if (entry.expiresAt <= now()) state.cache.delete(cacheKey);
	}
	const cached = state.cache.get(key);
	if (cached && cached.expiresAt > now()) {
		return withCacheStatus(cached.fact, "hit", cacheTtlMs);
	}
	if (cached) state.cache.delete(key);
	const pending = state.inflight.get(key);
	if (pending) {
		const fact = await pending;
		return fact.type === "success"
			? withCacheStatus(fact, "coalesced", cacheTtlMs)
			: fact;
	}

	const execution = executeBraveWebSearch(
		call,
		input.value,
		apiKey,
		fetcher,
		options,
	);
	state.inflight.set(key, execution);
	try {
		const fact = await execution;
		if (fact.type !== "success") return fact;
		const cacheable = withCacheStatus(fact, "miss", cacheTtlMs);
		if (cacheTtlMs > 0) {
			while (state.cache.size >= MAX_CACHE_ENTRIES) {
				const oldestKey = state.cache.keys().next().value;
				if (typeof oldestKey !== "string") break;
				state.cache.delete(oldestKey);
			}
			state.cache.set(key, { expiresAt: now() + cacheTtlMs, fact: cacheable });
		}
		return cacheable;
	} finally {
		state.inflight.delete(key);
	}
}

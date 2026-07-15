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
		timeoutMs?: number;
		run(
			call: NeutralToolCall,
			context: { signal: AbortSignal },
		): Promise<CapabilityExecutionFact>;
	};
};

const OWNER_ID = "brave-web-search";
const TOOL_NAME = "searchWeb";
const DEFAULT_CACHE_TTL_MS = 15_000;
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_RETRY_AFTER_MS = 2_000;
const DEFAULT_MAX_RETRIES = 1;
const DEFAULT_FALLBACK_TIMEOUT_MS = 2_000;
const MAX_CACHE_ENTRIES = 32;
const RETRYABLE_STATUSES = new Set([429, 503]);

type SuccessfulCapabilityFact = Extract<
	CapabilityExecutionFact,
	{ type: "success" }
>;
type BraveRateLimitGate = { tail: Promise<void> };
type RequestState = {
	cache: Map<string, { expiresAt: number; fact: SuccessfulCapabilityFact }>;
	inflight: Map<string, Promise<CapabilityExecutionFact>>;
	gates: Map<string, BraveRateLimitGate>;
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
		gates: new Map<string, BraveRateLimitGate>(),
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

const numericHeaderValues = (header: string | null): number[] =>
	(header ?? "")
		.split(",")
		.map((value) => Number(value.trim()))
		.filter((value) => Number.isFinite(value));

const braveResetMilliseconds = (
	headers: Headers,
	maximum: number,
	requireExhaustedWindow: boolean,
): number => {
	const resets = numericHeaderValues(headers.get("X-RateLimit-Reset"));
	if (resets.length === 0) return 0;
	let resetIndex = 0;
	if (requireExhaustedWindow) {
		resetIndex = numericHeaderValues(
			headers.get("X-RateLimit-Remaining"),
		).findIndex((remaining) => remaining <= 0);
		if (resetIndex < 0) return 0;
	}
	const seconds = resets[resetIndex] ?? resets[0];
	return Math.min(Math.max(Math.ceil((seconds ?? 0) * 1_000), 0), maximum);
};

const responsePacingMilliseconds = (
	response: Response,
	now: number,
	maximum: number,
): number => {
	if (response.ok) {
		return braveResetMilliseconds(response.headers, maximum, true);
	}
	if (!RETRYABLE_STATUSES.has(response.status)) return 0;
	const retryAfter = response.headers.get("Retry-After");
	return retryAfter === null
		? braveResetMilliseconds(response.headers, maximum, false)
		: retryAfterMilliseconds(retryAfter, now, maximum);
};

const requestThroughGate = (
	gate: BraveRateLimitGate,
	fetcher: FetchLike,
	endpoint: URL,
	init: RequestInit,
	pacing: {
		maxDelayMs: number;
		now: () => number;
		sleep: (milliseconds: number) => Promise<void>;
	},
): Promise<Response> => {
	const signal = init.signal;
	let resolveResponse: (response: Response) => void = () => undefined;
	let rejectResponse: (error: unknown) => void = () => undefined;
	let settled = false;
	const response = new Promise<Response>((resolve, reject) => {
		resolveResponse = resolve;
		rejectResponse = reject;
	});
	const abortError = () => new DOMException("aborted", "AbortError");
	const cleanup = () => signal?.removeEventListener("abort", onAbort);
	const fulfill = (result: Response) => {
		if (settled) return;
		settled = true;
		cleanup();
		resolveResponse(result);
	};
	const reject = (error: unknown) => {
		if (settled) return;
		settled = true;
		cleanup();
		rejectResponse(error);
	};
	const onAbort = () => reject(abortError());
	if (signal?.aborted) onAbort();
	else signal?.addEventListener("abort", onAbort, { once: true });

	const scheduled = gate.tail
		.catch(() => undefined)
		.then(async () => {
			if (signal?.aborted) {
				reject(abortError());
				return;
			}
			try {
				const result = await fetcher(endpoint, init);
				fulfill(result);
				const delayMs = responsePacingMilliseconds(
					result,
					pacing.now(),
					pacing.maxDelayMs,
				);
				if (delayMs > 0) await pacing.sleep(delayMs);
			} catch (error) {
				reject(error);
			}
		});
	gate.tail = scheduled.then(
		() => undefined,
		() => undefined,
	);
	return response;
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
		fallback?: {
			from: string;
			provider: string;
			status: number;
			outcome: "success" | "failure" | "timeout" | "threw";
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

const runConfiguredFallback = async (
	call: NeutralToolCall,
	fallback: NonNullable<BraveWebSearchOptions["fallback"]>,
	status: number,
): Promise<CapabilityExecutionFact> => {
	const controller = new AbortController();
	const timeoutMs = Math.max(
		1,
		boundedInteger(fallback.timeoutMs, DEFAULT_FALLBACK_TIMEOUT_MS, 10_000),
	);
	type Outcome =
		| { type: "fact"; fact: CapabilityExecutionFact }
		| { type: "timeout" }
		| { type: "threw" };
	let timeout: ReturnType<typeof setTimeout> | undefined;
	const deadline = new Promise<Outcome>((resolve) => {
		timeout = setTimeout(() => {
			controller.abort();
			resolve({ type: "timeout" });
		}, timeoutMs);
	});
	const execution = Promise.resolve()
		.then(() => fallback.run(call, { signal: controller.signal }))
		.then(
			(fact): Outcome => ({ type: "fact", fact }),
			(): Outcome => ({ type: "threw" }),
		);
	const provenance = {
		from: OWNER_ID,
		provider: fallback.provider,
		status,
	} as const;
	try {
		const outcome = await Promise.race([execution, deadline]);
		if (outcome.type === "timeout") {
			return failure("timeout", "Configured fallback timed out.", {
				fallback: { ...provenance, outcome: "timeout" },
			});
		}
		if (outcome.type === "threw") {
			return failure(
				"provider-failure",
				"Configured fallback failed unexpectedly.",
				{ fallback: { ...provenance, outcome: "threw" } },
			);
		}
		if (outcome.fact.type === "success") {
			return {
				...outcome.fact,
				receipt: {
					...outcome.fact.receipt,
					provider: fallback.provider,
					fallback: { ...provenance, outcome: "success" },
				},
			};
		}
		return {
			...outcome.fact,
			fallback: { ...provenance, outcome: "failure" },
		};
	} finally {
		if (timeout) clearTimeout(timeout);
		controller.abort();
	}
};

const requestBraveQuery = async (
	request: WebSearchQuery,
	input: WebSearchInput,
	apiKey: string,
	fetcher: FetchLike,
	gate: BraveRateLimitGate,
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
			const response = await requestThroughGate(
				gate,
				fetcher,
				endpoint,
				{
					headers: {
						accept: "application/json",
						"X-Subscription-Token": apiKey,
					},
					signal,
				},
				{
					maxDelayMs: retry.maxRetryAfterMs,
					now: retry.now,
					sleep: retry.sleep,
				},
			);
			if (!response.ok) {
				const retryable = RETRYABLE_STATUSES.has(response.status);
				const retryAfterMs = responsePacingMilliseconds(
					response,
					retry.now(),
					retry.maxRetryAfterMs,
				);
				if (retryAfterMs > 0) {
					latestRetryAfterMs = retryAfterMs;
				}
				if (retryable && attempt < retry.maxRetries && !signal.aborted) {
					continue;
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
	gate: BraveRateLimitGate,
	options: BraveWebSearchOptions,
): Promise<CapabilityExecutionFact> => {
	const controller = new AbortController();
	let timedOut = false;
	const retry = {
		maxRetries: boundedInteger(options.maxRetries, DEFAULT_MAX_RETRIES, 3),
		maxRetryAfterMs: boundedInteger(
			options.maxRetryAfterMs,
			DEFAULT_MAX_RETRY_AFTER_MS,
			10_000,
		),
		now: options.now ?? Date.now,
		sleep: options.sleep ?? defaultSleep,
	};
	const timeout = setTimeout(
		() => {
			timedOut = true;
			controller.abort();
		},
		options.timeoutMs ??
			DEFAULT_TIMEOUT_MS +
				Math.max(input.queries.length - 1, 0) * retry.maxRetryAfterMs,
	);
	try {
		let firstFailure: CapabilityExecutionFact | null = null;
		const outcomes: SearchOutcome[] = [];
		for (const query of input.queries) {
			const outcome = await requestBraveQuery(
				query,
				input,
				apiKey,
				fetcher,
				gate,
				controller.signal,
				retry,
			);
			outcomes.push(outcome);
			if (!outcome.ok) {
				firstFailure = outcome.fact;
				break;
			}
		}
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
				return runConfiguredFallback(call, options.fallback, status);
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
	let gate = state.gates.get(apiKey);
	if (!gate) {
		gate = { tail: Promise.resolve() };
		state.gates.set(apiKey, gate);
	}
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
		gate,
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

import type { NeutralToolCall } from "ignite-element/tools";
import type { CapabilityExecutionFact } from "../src/capability-federation";
import {
	readWebSearchInput,
	sanitizeWebSearchResult,
	WEB_SEARCH_LIMITS,
	type WebSearchFact,
	type WebSearchInput,
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
};

const OWNER_ID = "brave-web-search";
const TOOL_NAME = "searchWeb";

const failure = (
	type: "unavailable" | "validation" | "timeout" | "provider-failure",
	message: string,
	extra: { issues?: readonly string[]; status?: number } = {},
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
	query: string,
	input: WebSearchInput,
	apiKey: string,
	fetcher: FetchLike,
	signal: AbortSignal,
): Promise<SearchOutcome> => {
	const endpoint = new URL("https://api.search.brave.com/res/v1/web/search");
	endpoint.searchParams.set("q", query);
	endpoint.searchParams.set("count", String(input.countPerQuery));
	endpoint.searchParams.set("safesearch", "moderate");
	if (input.country) endpoint.searchParams.set("country", input.country);

	try {
		const response = await fetcher(endpoint, {
			headers: {
				accept: "application/json",
				"X-Subscription-Token": apiKey,
			},
			signal,
		});
		if (!response.ok) {
			return {
				ok: false,
				fact: failure(
					"provider-failure",
					"Brave Web Search rejected the request.",
					{ status: response.status },
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
		return { ok: true, search: { query, results } };
	} catch {
		return {
			ok: false,
			fact: signal.aborted
				? failure("timeout", "Brave Web Search timed out.")
				: failure("provider-failure", "Brave Web Search could not be reached."),
		};
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

	const controller = new AbortController();
	let timedOut = false;
	const timeout = setTimeout(() => {
		timedOut = true;
		controller.abort();
	}, options.timeoutMs ?? 8_000);
	try {
		let firstFailure: CapabilityExecutionFact | null = null;
		const outcomes = await Promise.all(
			input.value.queries.map(async (query) => {
				const outcome = await requestBraveQuery(
					query,
					input.value,
					apiKey,
					fetcher,
					controller.signal,
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
}

import type { NeutralToolCall } from "ignite-element/tools";
import type { CapabilityExecutionFact } from "../src/capability-federation";
import {
	readWebSearchInput,
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

const safeSource = (value: unknown): WebSearchResult | null => {
	if (
		!isRecord(value) ||
		typeof value.title !== "string" ||
		typeof value.url !== "string"
	) {
		return null;
	}
	try {
		const url = new URL(value.url);
		if (url.protocol !== "https:" && url.protocol !== "http:") return null;
	} catch {
		return null;
	}
	return {
		title: value.title.trim(),
		url: value.url,
		description:
			typeof value.description === "string" ? value.description.trim() : "",
	};
};

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
		.map(safeSource)
		.filter((result): result is WebSearchResult => result !== null)
		.slice(0, input.countPerQuery);
	return { ok: true, search: { query, results } };
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
	const timeout = setTimeout(
		() => controller.abort(),
		options.timeoutMs ?? 8_000,
	);
	try {
		const outcomes = await Promise.all(
			input.value.queries.map((query) =>
				requestBraveQuery(
					query,
					input.value,
					apiKey,
					fetcher,
					controller.signal,
				),
			),
		);
		const unsuccessful = outcomes.find((outcome) => !outcome.ok);
		if (unsuccessful && !unsuccessful.ok) return unsuccessful.fact;
		const searches = outcomes.flatMap((outcome) =>
			outcome.ok ? [outcome.search] : [],
		);
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
		return controller.signal.aborted
			? failure("timeout", "Brave Web Search timed out.")
			: failure("provider-failure", "Brave Web Search could not be reached.");
	} finally {
		clearTimeout(timeout);
	}
}

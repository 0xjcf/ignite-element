import { afterEach, describe, expect, it, vi } from "vitest";
import { WEB_SEARCH_LIMITS } from "../src/web-search-capability";
import { runBraveWebSearch } from "./brave-web-search";

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("Brave Web Search server adapter", () => {
	const successfulResponse = (query = "coffee") =>
		new Response(
			JSON.stringify({
				web: {
					results: [
						{
							title: `${query} listing`,
							url: `https://example.com/${query}`,
							description: "Price: $8.99",
						},
					],
				},
			}),
			{ status: 200 },
		);

	it("keeps credentials server-side and returns bounded source facts", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const query = new URL(String(input)).searchParams.get("q") ?? "item";
			const slug = query.split(" ")[0];
			return new Response(
				JSON.stringify({
					web: {
						results: [
							{
								title: `${query} listing`,
								url: `https://example.com/${slug}`,
								description:
									slug === "coffee" ? "Price: $8.99" : "Typical price",
							},
							{
								title: "Unsafe",
								url: "javascript:alert(1)",
								description: "discard me",
							},
						],
					},
				}),
				{ status: 200 },
			);
		});

		await expect(
			runBraveWebSearch(
				{
					name: "searchWeb",
					input: {
						queries: [
							{ subject: "Coffee", query: "coffee Sarasota" },
							{ subject: "Bread", query: "bread Sarasota" },
						],
						country: "US",
						countPerQuery: 4,
					},
				},
				{ apiKey: "server-secret", fetch: fetchMock },
			),
		).resolves.toEqual({
			type: "success",
			ownerId: "brave-web-search",
			toolName: "searchWeb",
			data: {
				searches: [
					{
						subject: "Coffee",
						query: "coffee Sarasota",
						price: {
							status: "sourced",
							amount: 8.99,
							display: "$8.99",
							sourceUrl: "https://example.com/coffee",
						},
						results: [
							{
								title: "coffee Sarasota listing",
								url: "https://example.com/coffee",
								description: "Price: $8.99",
							},
						],
					},
					{
						subject: "Bread",
						query: "bread Sarasota",
						price: {
							status: "unverified",
							amount: null,
							sourceUrl: "https://example.com/bread",
							reason:
								"No single explicit price was found in the returned sources.",
						},
						results: [
							{
								title: "bread Sarasota listing",
								url: "https://example.com/bread",
								description: "Typical price",
							},
						],
					},
				],
			},
			receipt: {
				provider: "brave-web-search",
				queryCount: 2,
				sourceCount: 2,
				cache: { status: "miss", ttlMs: 15_000 },
			},
		});
		expect(fetchMock).toHaveBeenCalledTimes(2);
		for (const [url, init] of fetchMock.mock.calls) {
			expect(String(url)).toContain(
				"https://api.search.brave.com/res/v1/web/search?",
			);
			expect(String(url)).toContain("count=4");
			expect(String(url)).toContain("country=us");
			expect(init?.headers).toMatchObject({
				accept: "application/json",
				"X-Subscription-Token": "server-secret",
			});
			expect(JSON.stringify(url)).not.toContain("server-secret");
			expect(init?.signal?.aborted).toBe(true);
		}
	});

	it("paces one multi-query tool call from Brave rate-limit headers and aggregates every subject", async () => {
		vi.useFakeTimers();
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const query = new URL(String(input)).searchParams.get("q") ?? "item";
			return new Response(
				JSON.stringify({
					web: {
						results: [
							{
								title: `${query} listing`,
								url: `https://example.com/${query}`,
								description: "Price: $4.99",
							},
						],
					},
				}),
				{
					status: 200,
					headers: {
						"X-RateLimit-Remaining": "0, 1993",
						"X-RateLimit-Reset": "1, 1423102",
					},
				},
			);
		});

		const result = runBraveWebSearch(
			{
				name: "searchWeb",
				input: {
					queries: [
						{ subject: "Eggs", query: "eggs" },
						{ subject: "Bread", query: "bread" },
						{ subject: "Milk", query: "milk" },
					],
				},
			},
			{ apiKey: "key", fetch: fetchMock },
		);

		await vi.advanceTimersByTimeAsync(0);
		expect(fetchMock).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(999);
		expect(fetchMock).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(1);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(1_000);

		await expect(result).resolves.toMatchObject({
			type: "success",
			data: {
				searches: [
					{ subject: "Eggs", query: "eggs" },
					{ subject: "Bread", query: "bread" },
					{ subject: "Milk", query: "milk" },
				],
			},
			receipt: { queryCount: 3, sourceCount: 3 },
		});
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("shares Brave pacing across overlapping non-identical tool calls", async () => {
		vi.useFakeTimers();
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const query = new URL(String(input)).searchParams.get("q") ?? "item";
			return new Response(
				JSON.stringify({ web: { results: [] } }),
				query === "eggs"
					? {
							status: 200,
							headers: {
								"X-RateLimit-Remaining": "0, 1993",
								"X-RateLimit-Reset": "1, 1423102",
							},
						}
					: { status: 200 },
			);
		});
		const options = { apiKey: "key", fetch: fetchMock };
		const first = runBraveWebSearch(
			{
				name: "searchWeb",
				input: { queries: [{ subject: "Eggs", query: "eggs" }] },
			},
			options,
		);
		const second = runBraveWebSearch(
			{
				name: "searchWeb",
				input: { queries: [{ subject: "Bread", query: "bread" }] },
			},
			options,
		);

		await vi.advanceTimersByTimeAsync(0);
		expect(fetchMock).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(999);
		expect(fetchMock).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(1);

		await expect(Promise.all([first, second])).resolves.toEqual([
			expect.objectContaining({ type: "success" }),
			expect.objectContaining({ type: "success" }),
		]);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("bounds source fields and total evidence returned to the model", async () => {
		const longTitle = "T".repeat(WEB_SEARCH_LIMITS.titleLength + 20);
		const longDescription = "D".repeat(
			WEB_SEARCH_LIMITS.descriptionLength + 20,
		);
		const overlongUrl = `https://example.com/${"u".repeat(WEB_SEARCH_LIMITS.urlLength)}`;
		const fieldFetch = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						web: {
							results: [
								{
									title: longTitle,
									url: "https://example.com/bounded",
									description: longDescription,
								},
								{
									title: "Too long URL",
									url: overlongUrl,
									description: "discarded",
								},
							],
						},
					}),
					{ status: 200 },
				),
		);
		const boundedFields = await runBraveWebSearch(
			{
				name: "searchWeb",
				input: {
					queries: [{ subject: "Bounded", query: "bounded source" }],
					countPerQuery: 5,
				},
			},
			{ apiKey: "key", fetch: fieldFetch },
		);
		expect(boundedFields).toMatchObject({
			type: "success",
			data: {
				searches: [
					{
						results: [
							{
								url: "https://example.com/bounded",
							},
						],
					},
				],
			},
			receipt: { queryCount: 1, sourceCount: 1 },
		});
		if (boundedFields.type !== "success") return;
		const boundedSource = (
			boundedFields.data as {
				searches: Array<{
					results: Array<{ title: string; description: string }>;
				}>;
			}
		).searches[0]?.results[0];
		expect(boundedSource?.title).toHaveLength(WEB_SEARCH_LIMITS.titleLength);
		expect(boundedSource?.description).toHaveLength(
			WEB_SEARCH_LIMITS.descriptionLength,
		);

		const batchFetch = vi.fn(async (input: RequestInfo | URL) => {
			const query = new URL(String(input)).searchParams.get("q") ?? "item";
			return new Response(
				JSON.stringify({
					web: {
						results: Array.from({ length: 5 }, (_, index) => ({
							title: `${query} ${index}`,
							url: `https://example.com/${encodeURIComponent(query)}/${index}`,
							description: "price",
						})),
					},
				}),
				{ status: 200 },
			);
		});
		const boundedBatch = await runBraveWebSearch(
			{
				name: "searchWeb",
				input: {
					queries: Array.from({ length: 8 }, (_, index) => ({
						subject: `Item ${index}`,
						query: `item ${index}`,
					})),
					countPerQuery: 5,
				},
			},
			{ apiKey: "key", fetch: batchFetch },
		);
		expect(boundedBatch).toMatchObject({
			type: "success",
			receipt: {
				queryCount: 8,
				sourceCount: WEB_SEARCH_LIMITS.totalSources,
			},
		});
		if (boundedBatch.type !== "success") return;
		expect(
			(
				boundedBatch.data as {
					searches: Array<{ results: unknown[] }>;
				}
			).searches.map((search) => search.results.length),
		).toEqual([5, 5, 5, 5, 4, 0, 0, 0]);
	});

	it("omits the capability cleanly when no server credential is configured", async () => {
		const fetchMock = vi.fn();
		await expect(
			runBraveWebSearch(
				{
					name: "searchWeb",
					input: { queries: [{ subject: "Coffee", query: "coffee" }] },
				},
				{ apiKey: "", fetch: fetchMock },
			),
		).resolves.toEqual({
			type: "unavailable",
			ownerId: "brave-web-search",
			toolName: "searchWeb",
			message: "Web search is not configured for this workbench.",
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("returns invalid, timeout, provider, and malformed responses as facts", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
			.mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
			.mockResolvedValueOnce(new Response("not json", { status: 200 }));

		await expect(
			runBraveWebSearch(
				{ name: "searchWeb", input: { queries: [] } },
				{ apiKey: "key", fetch: fetchMock },
			),
		).resolves.toMatchObject({
			type: "validation",
			issues: ["queries: expected between 1 and 8 queries"],
		});
		await expect(
			runBraveWebSearch(
				{
					name: "searchWeb",
					input: { queries: [{ subject: "Coffee", query: "coffee" }] },
				},
				{ apiKey: "key", fetch: fetchMock },
			),
		).resolves.toMatchObject({ type: "provider-failure", status: 429 });
		await expect(
			runBraveWebSearch(
				{
					name: "searchWeb",
					input: { queries: [{ subject: "Coffee", query: "coffee" }] },
				},
				{ apiKey: "key", fetch: fetchMock },
			),
		).resolves.toMatchObject({ type: "provider-failure" });
	});

	it("returns a deterministic timeout fact for the bounded batch", async () => {
		vi.useFakeTimers();
		const fetchMock = vi.fn(
			async (_input: RequestInfo | URL, init?: RequestInit) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener(
						"abort",
						() => reject(new DOMException("aborted", "AbortError")),
						{ once: true },
					);
				}),
		);

		const result = runBraveWebSearch(
			{
				name: "searchWeb",
				input: {
					queries: [
						{ subject: "Bread", query: "bread price" },
						{ subject: "Eggs", query: "eggs price" },
					],
				},
			},
			{ apiKey: "key", fetch: fetchMock, timeoutMs: 25 },
		);
		await vi.advanceTimersByTimeAsync(25);

		await expect(result).resolves.toEqual({
			type: "timeout",
			ownerId: "brave-web-search",
			toolName: "searchWeb",
			message: "Brave Web Search timed out.",
		});
	});

	it("does not start later batch queries after an earlier query exhausts", async () => {
		const fetchMock = vi.fn(
			async () => new Response("rate limited", { status: 429 }),
		);

		await expect(
			runBraveWebSearch(
				{
					name: "searchWeb",
					input: {
						queries: [
							{ subject: "Reject", query: "reject" },
							{ subject: "Pending", query: "pending" },
						],
					},
				},
				{ apiKey: "key", fetch: fetchMock },
			),
		).resolves.toMatchObject({
			type: "provider-failure",
			status: 429,
		});
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(
			fetchMock.mock.calls.every(([url]) => String(url).includes("q=reject")),
		).toBe(true);
	});

	it("bounds Retry-After delays and exhausts after one retry by default", async () => {
		const sleep = vi.fn(async () => undefined);
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response("rate limited", {
					status: 429,
					headers: { "Retry-After": "30" },
				}),
			)
			.mockResolvedValueOnce(new Response("rate limited", { status: 429 }));

		await expect(
			runBraveWebSearch(
				{
					name: "searchWeb",
					input: { queries: [{ subject: "Coffee", query: "coffee" }] },
				},
				{
					apiKey: "key",
					fetch: fetchMock,
					sleep,
					maxRetryAfterMs: 1_500,
				},
			),
		).resolves.toMatchObject({
			type: "provider-failure",
			status: 429,
			retry: {
				attempts: 2,
				maxAttempts: 2,
				retryAfterMs: 1_500,
				exhausted: true,
			},
		});
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(sleep).toHaveBeenCalledOnce();
		expect(sleep).toHaveBeenCalledWith(1_500);
	});

	it("parses HTTP-date Retry-After and returns the eventual provider success", async () => {
		const now = Date.parse("2026-07-14T20:00:00.000Z");
		const sleep = vi.fn(async () => undefined);
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response("busy", {
					status: 503,
					headers: {
						"Retry-After": new Date(now + 1_000).toUTCString(),
					},
				}),
			)
			.mockResolvedValueOnce(successfulResponse());

		await expect(
			runBraveWebSearch(
				{
					name: "searchWeb",
					input: { queries: [{ subject: "Coffee", query: "coffee" }] },
				},
				{ apiKey: "key", fetch: fetchMock, sleep, now: () => now },
			),
		).resolves.toMatchObject({ type: "success" });
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(sleep).toHaveBeenCalledWith(1_000);
	});

	it("falls back to Brave reset guidance when Retry-After is absent", async () => {
		const sleep = vi.fn(async () => undefined);
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response("rate limited", {
					status: 429,
					headers: { "X-RateLimit-Reset": "1, 1423102" },
				}),
			)
			.mockResolvedValueOnce(successfulResponse());

		await expect(
			runBraveWebSearch(
				{
					name: "searchWeb",
					input: { queries: [{ subject: "Coffee", query: "coffee" }] },
				},
				{ apiKey: "key", fetch: fetchMock, sleep },
			),
		).resolves.toMatchObject({ type: "success" });
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(sleep).toHaveBeenCalledWith(1_000);
	});

	it("coalesces same-key storms and caches only exact successful requests", async () => {
		let now = 100;
		let release: ((response: Response) => void) | undefined;
		const fetchMock = vi.fn(
			async () =>
				new Promise<Response>((resolve) => {
					release = resolve;
				}),
		);
		const call = {
			name: "searchWeb",
			input: { queries: [{ subject: " Coffee ", query: " coffee " }] },
		};
		const options = {
			apiKey: "key",
			fetch: fetchMock,
			now: () => now,
			cacheTtlMs: 1_000,
		};

		const first = runBraveWebSearch(call, options);
		const coalesced = runBraveWebSearch(call, options);
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
		release?.(successfulResponse());

		await expect(first).resolves.toMatchObject({
			type: "success",
			receipt: { cache: { status: "miss", ttlMs: 1_000 } },
		});
		await expect(coalesced).resolves.toMatchObject({
			type: "success",
			receipt: { cache: { status: "coalesced", ttlMs: 1_000 } },
		});
		await expect(runBraveWebSearch(call, options)).resolves.toMatchObject({
			type: "success",
			receipt: { cache: { status: "hit", ttlMs: 1_000 } },
		});
		expect(fetchMock).toHaveBeenCalledOnce();

		now += 1_001;
		fetchMock.mockImplementationOnce(async () => successfulResponse("tea"));
		await runBraveWebSearch(call, options);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("does not cache provider failures for an exact normalized request", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response("failed", { status: 500 }))
			.mockResolvedValueOnce(successfulResponse());
		const call = {
			name: "searchWeb",
			input: { queries: [{ subject: "Coffee", query: "coffee" }] },
		};
		const options = { apiKey: "key", fetch: fetchMock };

		await expect(runBraveWebSearch(call, options)).resolves.toMatchObject({
			type: "provider-failure",
			status: 500,
		});
		await expect(runBraveWebSearch(call, options)).resolves.toMatchObject({
			type: "success",
			receipt: { cache: { status: "miss" } },
		});
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("uses only an explicitly injected eligible fallback after exhaustion", async () => {
		const fetchMock = vi.fn(async () => new Response("busy", { status: 503 }));
		const fallbackRun = vi.fn(async () => ({
			type: "success" as const,
			ownerId: "fixture-search",
			toolName: "searchWeb",
			data: { searches: [] },
			receipt: { provider: "fixture-search", queryCount: 1, sourceCount: 0 },
		}));
		const call = {
			name: "searchWeb",
			input: { queries: [{ subject: "Coffee", query: "coffee" }] },
		};

		await expect(
			runBraveWebSearch(call, {
				apiKey: "key",
				fetch: fetchMock,
				sleep: async () => undefined,
				fallback: {
					provider: "fixture-search",
					statuses: [503],
					run: fallbackRun,
				},
			}),
		).resolves.toMatchObject({
			type: "success",
			receipt: {
				provider: "fixture-search",
				fallback: {
					from: "brave-web-search",
					provider: "fixture-search",
					status: 503,
					outcome: "success",
				},
			},
		});
		expect(fallbackRun).toHaveBeenCalledOnce();

		const ineligibleFetch = vi.fn(
			async () => new Response("busy", { status: 503 }),
		);
		await expect(
			runBraveWebSearch(call, {
				apiKey: "key",
				fetch: ineligibleFetch,
				sleep: async () => undefined,
				fallback: {
					provider: "fixture-search",
					statuses: [429],
					run: fallbackRun,
				},
			}),
		).resolves.toMatchObject({ type: "provider-failure", status: 503 });
		expect(fallbackRun).toHaveBeenCalledOnce();
	});

	it("aborts a hanging configured fallback at its deterministic deadline", async () => {
		vi.useFakeTimers();
		const fetchMock = vi.fn(async () => new Response("busy", { status: 503 }));
		let fallbackSignal: AbortSignal | undefined;
		const fallbackRun = vi.fn(
			async (_call: unknown, context: { signal: AbortSignal }) => {
				fallbackSignal = context.signal;
				return new Promise<never>(() => undefined);
			},
		);
		const result = runBraveWebSearch(
			{
				name: "searchWeb",
				input: { queries: [{ subject: "Coffee", query: "coffee" }] },
			},
			{
				apiKey: "key",
				fetch: fetchMock,
				sleep: async () => undefined,
				fallback: {
					provider: "fixture-search",
					statuses: [503],
					timeoutMs: 25,
					run: fallbackRun,
				},
			},
		);

		await vi.advanceTimersByTimeAsync(0);
		expect(fallbackRun).toHaveBeenCalledOnce();
		expect(fallbackSignal?.aborted).toBe(false);
		await vi.advanceTimersByTimeAsync(25);
		await expect(result).resolves.toMatchObject({
			type: "timeout",
			message: "Configured fallback timed out.",
			fallback: {
				from: "brave-web-search",
				provider: "fixture-search",
				status: 503,
				outcome: "timeout",
			},
		});
		expect(fallbackSignal?.aborted).toBe(true);
	});

	it("returns structured provenance for failed and thrown fallback attempts", async () => {
		const call = {
			name: "searchWeb",
			input: { queries: [{ subject: "Coffee", query: "coffee" }] },
		};
		const failedFetch = vi.fn(
			async () => new Response("busy", { status: 503 }),
		);
		await expect(
			runBraveWebSearch(call, {
				apiKey: "key",
				fetch: failedFetch,
				sleep: async () => undefined,
				fallback: {
					provider: "fixture-search",
					statuses: [503],
					run: async () => ({
						type: "provider-failure",
						ownerId: "fixture-search",
						toolName: "searchWeb",
						message: "Fixture provider rejected the request.",
						status: 502,
					}),
				},
			}),
		).resolves.toMatchObject({
			type: "provider-failure",
			message: "Fixture provider rejected the request.",
			status: 502,
			fallback: {
				from: "brave-web-search",
				provider: "fixture-search",
				status: 503,
				outcome: "failure",
			},
		});

		const throwingFetch = vi.fn(
			async () => new Response("busy", { status: 503 }),
		);
		await expect(
			runBraveWebSearch(call, {
				apiKey: "key",
				fetch: throwingFetch,
				sleep: async () => undefined,
				fallback: {
					provider: "fixture-search",
					statuses: [503],
					run: async () => {
						throw new Error("secret fixture failure");
					},
				},
			}),
		).resolves.toMatchObject({
			type: "provider-failure",
			message: "Configured fallback failed unexpectedly.",
			fallback: {
				from: "brave-web-search",
				provider: "fixture-search",
				status: 503,
				outcome: "threw",
			},
		});
	});
});

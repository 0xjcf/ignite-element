import { afterEach, describe, expect, it, vi } from "vitest";
import { runBraveWebSearch } from "./brave-web-search";

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("Brave Web Search server adapter", () => {
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
								description: "Typical price",
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
						queries: ["coffee Sarasota", "bread Sarasota"],
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
						query: "coffee Sarasota",
						results: [
							{
								title: "coffee Sarasota listing",
								url: "https://example.com/coffee",
								description: "Typical price",
							},
						],
					},
					{
						query: "bread Sarasota",
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
		}
	});

	it("omits the capability cleanly when no server credential is configured", async () => {
		const fetchMock = vi.fn();
		await expect(
			runBraveWebSearch(
				{ name: "searchWeb", input: { queries: ["coffee"] } },
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
				{ name: "searchWeb", input: { queries: ["coffee"] } },
				{ apiKey: "key", fetch: fetchMock },
			),
		).resolves.toMatchObject({ type: "provider-failure", status: 429 });
		await expect(
			runBraveWebSearch(
				{ name: "searchWeb", input: { queries: ["coffee"] } },
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
				input: { queries: ["bread price", "eggs price"] },
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
});

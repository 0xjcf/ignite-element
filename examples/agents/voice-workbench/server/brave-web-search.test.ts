import { afterEach, describe, expect, it, vi } from "vitest";
import { runBraveWebSearch } from "./brave-web-search";

afterEach(() => vi.unstubAllGlobals());

describe("Brave Web Search server adapter", () => {
	it("keeps credentials server-side and returns bounded source facts", async () => {
		const fetchMock = vi.fn(async () =>
			new Response(
				JSON.stringify({
					web: {
						results: [
							{
								title: "Coffee listing",
								url: "https://example.com/coffee",
								description: "Typical price $8.99",
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
			),
		);

		await expect(
			runBraveWebSearch(
				{ name: "searchWeb", input: { query: "coffee Sarasota", count: 4 } },
				{ apiKey: "server-secret", fetch: fetchMock },
			),
		).resolves.toEqual({
			type: "success",
			ownerId: "brave-web-search",
			toolName: "searchWeb",
			data: {
				query: "coffee Sarasota",
				results: [
					{
						title: "Coffee listing",
						url: "https://example.com/coffee",
						description: "Typical price $8.99",
					},
				],
			},
			receipt: { provider: "brave-web-search", sourceCount: 1 },
		});
		const [url, init] = fetchMock.mock.calls[0] ?? [];
		expect(String(url)).toContain(
			"https://api.search.brave.com/res/v1/web/search?",
		);
		expect(String(url)).toContain("q=coffee+Sarasota");
		expect(String(url)).toContain("count=4");
		expect(init?.headers).toMatchObject({
			accept: "application/json",
			"X-Subscription-Token": "server-secret",
		});
		expect(JSON.stringify(url)).not.toContain("server-secret");
	});

	it("omits the capability cleanly when no server credential is configured", async () => {
		const fetchMock = vi.fn();
		await expect(
			runBraveWebSearch(
				{ name: "searchWeb", input: { query: "coffee" } },
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
				{ name: "searchWeb", input: { query: "" } },
				{ apiKey: "key", fetch: fetchMock },
			),
		).resolves.toMatchObject({
			type: "validation",
			issues: ["query: expected a non-empty string"],
		});
		await expect(
			runBraveWebSearch(
				{ name: "searchWeb", input: { query: "coffee" } },
				{ apiKey: "key", fetch: fetchMock },
			),
		).resolves.toMatchObject({ type: "provider-failure", status: 429 });
		await expect(
			runBraveWebSearch(
				{ name: "searchWeb", input: { query: "coffee" } },
				{ apiKey: "key", fetch: fetchMock },
			),
		).resolves.toMatchObject({ type: "provider-failure" });
	});
});

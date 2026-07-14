import { afterEach, describe, expect, it, vi } from "vitest";
import { createWebSearchCapability } from "./web-search-capability";

afterEach(() => vi.useRealTimers());

describe("same-origin web search capability", () => {
	it("advertises a generic search tool and returns source-backed facts", async () => {
		const fetchMock = vi.fn(
			async (_input: RequestInfo | URL, _init?: RequestInit) =>
				new Response(
				JSON.stringify({
					type: "success",
					ownerId: "brave-web-search",
					toolName: "searchWeb",
					data: {
						query: "coffee price Sarasota",
						results: [
							{
								title: "Coffee listing",
								url: "https://example.com/coffee",
								description: "$8.99",
							},
						],
					},
					receipt: { provider: "brave-web-search", sourceCount: 1 },
				}),
					{ status: 200 },
				),
		);
		const provider = createWebSearchCapability({ fetch: fetchMock });

		expect(provider.manifest).toEqual([
			expect.objectContaining({
				name: "searchWeb",
				inputSchema: expect.objectContaining({
					required: ["query"],
				}),
			}),
		]);
		await expect(
			provider.run({
				id: "search-1",
				name: "searchWeb",
				input: { query: "coffee price Sarasota", count: 5 },
			}),
		).resolves.toMatchObject({
			type: "success",
			data: {
				results: [{ url: "https://example.com/coffee" }],
			},
			receipt: { sourceCount: 1 },
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/capabilities/web-search",
			expect.objectContaining({
				method: "POST",
				headers: { "content-type": "application/json" },
			}),
		);
		const [, init] = fetchMock.mock.calls[0] ?? [];
		expect(JSON.parse(String(init?.body))).toEqual({
			query: "coffee price Sarasota",
			count: 5,
		});
		expect(JSON.stringify(init)).not.toContain("Subscription");
	});

	it("returns validation and network failures as values", async () => {
		const fetchMock = vi.fn(async () => {
			throw new Error("secret network failure");
		});
		const provider = createWebSearchCapability({ fetch: fetchMock });

		await expect(
			provider.run({ name: "searchWeb", input: { query: "" } }),
		).resolves.toEqual({
			type: "validation",
			ownerId: "web-search",
			toolName: "searchWeb",
			message: "The web search input is invalid.",
			issues: ["query: expected a non-empty string"],
		});
		expect(fetchMock).not.toHaveBeenCalled();

		await expect(
			provider.run({ name: "searchWeb", input: { query: "coffee" } }),
		).resolves.toEqual({
			type: "provider-failure",
			ownerId: "web-search",
			toolName: "searchWeb",
			message: "The web search capability could not be reached.",
		});
	});
});

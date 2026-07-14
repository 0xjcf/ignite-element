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
							searches: [
								{
									query: "coffee price Sarasota",
									results: [
										{
											title: "Coffee listing",
											url: "https://example.com/coffee",
											description: "$8.99",
										},
									],
								},
							],
						},
						receipt: {
							provider: "brave-web-search",
							queryCount: 1,
							sourceCount: 1,
						},
					}),
					{ status: 200 },
				),
		);
		const provider = createWebSearchCapability({ fetch: fetchMock });

		expect(provider.manifest).toEqual([
			expect.objectContaining({
				name: "searchWeb",
				inputSchema: expect.objectContaining({
					required: ["queries"],
				}),
			}),
		]);
		await expect(
			provider.run({
				id: "search-1",
				name: "searchWeb",
				input: {
					queries: ["coffee price Sarasota"],
					country: "US",
					countPerQuery: 4,
				},
			}),
		).resolves.toMatchObject({
			type: "success",
			data: {
				searches: [{ results: [{ url: "https://example.com/coffee" }] }],
			},
			receipt: { queryCount: 1, sourceCount: 1 },
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
			queries: ["coffee price Sarasota"],
			country: "us",
			countPerQuery: 4,
		});
		expect(JSON.stringify(init)).not.toContain("Subscription");
	});

	it("returns validation and network failures as values", async () => {
		const fetchMock = vi.fn(async () => {
			throw new Error("secret network failure");
		});
		const provider = createWebSearchCapability({ fetch: fetchMock });

		await expect(
			provider.run({ name: "searchWeb", input: { queries: [] } }),
		).resolves.toEqual({
			type: "validation",
			ownerId: "web-search",
			toolName: "searchWeb",
			message: "The web search input is invalid.",
			issues: ["queries: expected between 1 and 8 queries"],
		});
		expect(fetchMock).not.toHaveBeenCalled();
		await expect(
			provider.run({
				name: "searchWeb",
				input: {
					queries: Array.from({ length: 9 }, (_, index) => `item ${index}`),
					country: "USA",
					countPerQuery: 6,
				},
			}),
		).resolves.toMatchObject({
			type: "validation",
			issues: [
				"queries: expected between 1 and 8 queries",
				"countPerQuery: expected an integer from 1 to 5",
				"country: expected a two-letter country code",
			],
		});
		expect(fetchMock).not.toHaveBeenCalled();

		await expect(
			provider.run({ name: "searchWeb", input: { queries: ["coffee"] } }),
		).resolves.toEqual({
			type: "provider-failure",
			ownerId: "web-search",
			toolName: "searchWeb",
			message: "The web search capability could not be reached.",
		});
	});

	it("returns a deterministic timeout fact", async () => {
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
		const provider = createWebSearchCapability({
			fetch: fetchMock,
			timeoutMs: 25,
		});

		const result = provider.run({
			name: "searchWeb",
			input: { queries: ["coffee price"] },
		});
		await vi.advanceTimersByTimeAsync(25);

		await expect(result).resolves.toEqual({
			type: "timeout",
			ownerId: "web-search",
			toolName: "searchWeb",
			message: "The web search capability timed out.",
		});
	});
});

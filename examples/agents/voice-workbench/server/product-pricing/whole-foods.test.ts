import { describe, expect, it, vi } from "vitest";
import {
	createWholeFoodsProductPricingState,
	runWholeFoodsProductPricing,
	WHOLE_FOODS_DISCOVERY_CACHE_MAX_ENTRIES,
	WHOLE_FOODS_DISCOVERY_CACHE_TTL_MS,
} from "./whole-foods";

const nativeEnvelope = (...asins: string[]) => ({
	mainResultSet: {
		searchResults: asins.map((asin) => ({
			asin,
			injectionSource: "keywords,phrasedoc,knn,behavioral",
			productGroup: "grocery_display_on_website",
		})),
	},
});

const product = ({
	asin,
	name,
	price,
	availability = "IN_STOCK",
	currencyCode = "USD",
}: {
	asin: string;
	name: string;
	price: number;
	availability?: string;
	currencyCode?: string;
}) => ({
	asin,
	name,
	programType: "GROCERY",
	availability,
	offerDetails: { price: { priceAmount: price, currencyCode } },
});

const input = (...subjects: string[]) => ({
	retailer: "Whole Foods",
	location: "Sarasota",
	items: subjects.map((subject) => ({ subject })),
});

const nativeUrl = (value: RequestInfo | URL): URL => new URL(String(value));

describe("Whole Foods server price adapter", () => {
	it("discovers categories natively and makes one deduplicated offer batch", async () => {
		const asinsBySubject = new Map([
			["Bread", "B000000001"],
			["Eggs", "B000000002"],
			["Milk", "B000000003"],
		]);
		const records = new Map([
			[
				"B000000001",
				product({
					asin: "B000000001",
					name: "Organic Sourdough Bread, 24 oz",
					price: 4.99,
				}),
			],
			[
				"B000000002",
				product({
					asin: "B000000002",
					name: "Large Grade A Eggs, 12 ct",
					price: 4.39,
				}),
			],
			[
				"B000000003",
				product({
					asin: "B000000003",
					name: "Organic Whole Milk, 1 gallon",
					price: 6.29,
				}),
			],
		]);
		const fetchMock = vi.fn(async (request: RequestInfo | URL) => {
			const url = nativeUrl(request);
			if (url.pathname === "/api/wwos/rsi/search") {
				return new Response(
					JSON.stringify(
						nativeEnvelope(
							asinsBySubject.get(url.searchParams.get("text") ?? "") ?? "",
						),
					),
					{ status: 200 },
				);
			}
			expect(url.pathname).toBe("/api/wwos/products");
			const asins = (url.searchParams.get("asins") ?? "").split(",");
			return new Response(
				JSON.stringify(
					asins.flatMap((asin) =>
						records.has(asin) ? [records.get(asin)] : [],
					),
				),
				{ status: 200 },
			);
		});

		const fact = await runWholeFoodsProductPricing(
			{ name: "priceProducts", input: input("Bread", "Eggs", "Milk") },
			{ apiKey: "unused-free-plan-key", fetch: fetchMock },
		);

		expect(fact).toMatchObject({
			type: "success",
			data: {
				searches: [
					{
						subject: "Bread",
						selection: { product: "Organic Sourdough Bread", size: "24 oz" },
						price: { status: "sourced", amount: 4.99 },
						receipt: { cache: "miss", native: "hit", brave: "not-needed" },
					},
					{ subject: "Eggs", price: { status: "sourced", amount: 4.39 } },
					{ subject: "Milk", price: { status: "sourced", amount: 6.29 } },
				],
			},
			receipt: { queryCount: 3, sourceCount: 3, cache: { status: "miss" } },
		});
		expect(
			fetchMock.mock.calls.filter(
				([request]) => nativeUrl(request).pathname === "/api/wwos/products",
			),
		).toHaveLength(1);
		expect(
			fetchMock.mock.calls.some(([request]) =>
				String(request).includes("api.search.brave.com"),
			),
		).toBe(false);
	});

	it("caches only selected identities with the default TTL and LRU bounds", async () => {
		expect(WHOLE_FOODS_DISCOVERY_CACHE_TTL_MS).toBe(300_000);
		expect(WHOLE_FOODS_DISCOVERY_CACHE_MAX_ENTRIES).toBe(64);
		let now = 1_000;
		const state = createWholeFoodsProductPricingState({ now: () => now });
		const fetchMock = vi.fn(async (request: RequestInfo | URL) => {
			const url = nativeUrl(request);
			return url.pathname === "/api/wwos/rsi/search"
				? new Response(JSON.stringify(nativeEnvelope("B000000001")), {
						status: 200,
					})
				: new Response(
						JSON.stringify([
							product({
								asin: "B000000001",
								name: "Organic Sourdough Bread, 24 oz",
								price: 4.99,
							}),
						]),
						{ status: 200 },
					);
		});
		const call = { name: "priceProducts", input: input("Bread") };

		await runWholeFoodsProductPricing(call, { fetch: fetchMock, state });
		const cached = await runWholeFoodsProductPricing(call, {
			fetch: fetchMock,
			state,
		});
		expect(cached).toMatchObject({
			type: "success",
			receipt: { cache: { status: "hit", ttlMs: 300_000 } },
		});
		now += WHOLE_FOODS_DISCOVERY_CACHE_TTL_MS + 1;
		await runWholeFoodsProductPricing(call, { fetch: fetchMock, state });

		expect(
			fetchMock.mock.calls.filter(
				([request]) => nativeUrl(request).pathname === "/api/wwos/rsi/search",
			),
		).toHaveLength(2);
		expect(
			fetchMock.mock.calls.filter(
				([request]) => nativeUrl(request).pathname === "/api/wwos/products",
			),
		).toHaveLength(3);
	});

	it("evicts the least-recently-used selected identity at the 64-entry bound", async () => {
		const state = createWholeFoodsProductPricingState();
		const fetchMock = vi.fn(async (request: RequestInfo | URL) => {
			const url = nativeUrl(request);
			if (url.pathname === "/api/wwos/rsi/search") {
				const index = Number(
					(url.searchParams.get("text") ?? "").split(" ")[1],
				);
				return new Response(
					JSON.stringify(nativeEnvelope(`B${String(index).padStart(9, "0")}`)),
					{ status: 200 },
				);
			}
			const asin = (url.searchParams.get("asins") ?? "").split(",")[0] ?? "";
			const index = Number(asin.slice(1));
			return new Response(
				JSON.stringify([
					product({
						asin,
						name: `Item ${index}, 1 oz`,
						price: 1,
					}),
				]),
				{ status: 200 },
			);
		});
		const run = (index: number) =>
			runWholeFoodsProductPricing(
				{ name: "priceProducts", input: input(`Item ${index}`) },
				{ fetch: fetchMock, state },
			);

		for (let index = 0; index < 64; index += 1) await run(index);
		await run(0);
		await run(64);
		await run(0);
		await run(1);

		expect(state.selectedIdentities.size).toBe(64);
		expect(
			fetchMock.mock.calls.filter(
				([request]) => nativeUrl(request).pathname === "/api/wwos/rsi/search",
			),
		).toHaveLength(66);
	});

	it("coalesces concurrent identity discovery without caching prices", async () => {
		let releaseSearch: (() => void) | undefined;
		const searchGate = new Promise<void>((resolve) => {
			releaseSearch = resolve;
		});
		const state = createWholeFoodsProductPricingState();
		const fetchMock = vi.fn(async (request: RequestInfo | URL) => {
			const url = nativeUrl(request);
			if (url.pathname === "/api/wwos/rsi/search") {
				await searchGate;
				return new Response(JSON.stringify(nativeEnvelope("B000000001")), {
					status: 200,
				});
			}
			return new Response(
				JSON.stringify([
					product({
						asin: "B000000001",
						name: "Organic Sourdough Bread, 24 oz",
						price: 4.99,
					}),
				]),
				{ status: 200 },
			);
		});
		const options = { fetch: fetchMock, state };
		const first = runWholeFoodsProductPricing(
			{ name: "priceProducts", input: input("Bread") },
			options,
		);
		const second = runWholeFoodsProductPricing(
			{ name: "priceProducts", input: input("Bread") },
			options,
		);
		releaseSearch?.();
		const facts = await Promise.all([first, second]);

		expect(facts).toEqual([
			expect.objectContaining({ type: "success" }),
			expect.objectContaining({
				type: "success",
				receipt: expect.objectContaining({
					cache: { status: "coalesced", ttlMs: 300_000 },
				}),
			}),
		]);
		expect(
			fetchMock.mock.calls.filter(
				([request]) => nativeUrl(request).pathname === "/api/wwos/rsi/search",
			),
		).toHaveLength(1);
		expect(
			fetchMock.mock.calls.filter(
				([request]) => nativeUrl(request).pathname === "/api/wwos/products",
			),
		).toHaveLength(2);
	});

	it("uses zero-retry Brave only after a decoded HTTP-200 native miss", async () => {
		const fetchMock = vi.fn(async (request: RequestInfo | URL) => {
			const url = nativeUrl(request);
			if (url.pathname === "/api/wwos/rsi/search") {
				return new Response(JSON.stringify(nativeEnvelope()), { status: 200 });
			}
			if (url.hostname === "api.search.brave.com") {
				return new Response(
					JSON.stringify({
						web: {
							results: [
								{
									title: "Organic Ground Coffee",
									url: "https://www.wholefoodsmarket.com/grocery/product/organic-ground-coffee-b012345678",
									description: "Official product page",
								},
							],
						},
					}),
					{ status: 200 },
				);
			}
			return new Response(
				JSON.stringify([
					product({
						asin: "B012345678",
						name: "Organic Ground Coffee, 12 oz",
						price: 12.49,
					}),
				]),
				{ status: 200 },
			);
		});

		const fact = await runWholeFoodsProductPricing(
			{ name: "priceProducts", input: input("Coffee") },
			{ apiKey: "free-plan-key", fetch: fetchMock },
		);
		expect(fact).toMatchObject({
			type: "success",
			data: {
				searches: [
					{
						receipt: {
							cache: "miss",
							native: "miss",
							brave: "attempted-success",
						},
					},
				],
			},
			receipt: { queryCount: 2 },
		});
		expect(
			fetchMock.mock.calls.filter(([request]) =>
				String(request).includes("api.search.brave.com"),
			),
		).toHaveLength(1);
	});

	it.each([
		{
			name: "schema drift",
			response: () =>
				new Response(JSON.stringify({ results: [] }), { status: 200 }),
			native: "schema-drift",
		},
		{
			name: "transport error",
			response: () => new Response("unavailable", { status: 503 }),
			native: "transport-error",
		},
	])("does not use Brave after $name", async ({ response, native }) => {
		const fetchMock = vi.fn(async () => response());
		const fact = await runWholeFoodsProductPricing(
			{ name: "priceProducts", input: input("Coffee") },
			{ apiKey: "free-plan-key", fetch: fetchMock },
		);

		expect(fact).toMatchObject({
			type: "success",
			data: {
				searches: [
					{
						price: { status: "unverified", amount: null },
						receipt: { native, brave: "not-eligible" },
					},
				],
			},
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("returns ambiguity and invalid prices as explicit unverified facts without caching them", async () => {
		const state = createWholeFoodsProductPricingState();
		const fetchMock = vi.fn(async (request: RequestInfo | URL) => {
			const url = nativeUrl(request);
			if (url.pathname === "/api/wwos/rsi/search") {
				return new Response(
					JSON.stringify(nativeEnvelope("B000000001", "B000000002")),
					{ status: 200 },
				);
			}
			return new Response(
				JSON.stringify([
					product({
						asin: "B000000001",
						name: "Whole Milk, 64 fl oz",
						price: 5.99,
					}),
					product({
						asin: "B000000002",
						name: "Whole Milk, 1 gallon",
						price: 6.29,
					}),
				]),
				{ status: 200 },
			);
		});
		const call = { name: "priceProducts", input: input("Milk") };
		const first = await runWholeFoodsProductPricing(call, {
			apiKey: "free-plan-key",
			fetch: fetchMock,
			state,
		});
		await runWholeFoodsProductPricing(call, {
			apiKey: "free-plan-key",
			fetch: fetchMock,
			state,
		});

		expect(first).toMatchObject({
			type: "success",
			data: {
				searches: [
					{
						price: {
							status: "unverified",
							amount: null,
							reason: expect.stringContaining("ambiguous"),
						},
						receipt: { native: "hit", brave: "not-needed" },
					},
				],
			},
		});
		expect(
			fetchMock.mock.calls.filter(
				([request]) => nativeUrl(request).pathname === "/api/wwos/rsi/search",
			),
		).toHaveLength(2);
	});
});

import { describe, expect, it, vi } from "vitest";
import {
	createWholeFoodsProductPricingState,
	parseWholeFoodsProductOffers,
	runWholeFoodsProductPricing,
	WHOLE_FOODS_DISCOVERY_CACHE_MAX_ENTRIES,
	WHOLE_FOODS_DISCOVERY_CACHE_TTL_MS,
	WHOLE_FOODS_MAX_OFFER_RECORDS,
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
	price: unknown;
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
		expect(
			fetchMock.mock.calls
				.filter(
					([request]) => nativeUrl(request).pathname === "/api/wwos/rsi/search",
				)
				.every(
					([request]) => nativeUrl(request).searchParams.get("size") === "12",
				),
		).toBe(true);
	});

	it("keeps the eight-subject, twelve-candidate offer batch within one bounded request", async () => {
		const subjects = Array.from({ length: 8 }, (_, index) => `Item ${index}`);
		const asin = (index: number) => `B${String(index).padStart(9, "0")}`;
		const candidatesBySubject = new Map(
			subjects.map((subject, subjectIndex) => [
				subject,
				Array.from({ length: 12 }, (_, rank) => asin(subjectIndex * 12 + rank)),
			]),
		);
		const records = subjects.flatMap((subject, subjectIndex) =>
			Array.from({ length: 12 }, (_, rank) => {
				const recordAsin = asin(subjectIndex * 12 + rank);
				return product({
					asin: recordAsin,
					name:
						rank === 0
							? `${subject}, 1 oz`
							: `Unrelated Product ${subjectIndex}-${rank}, 1 oz`,
					price: subjectIndex + 1,
				});
			}),
		);
		const offerUrls: URL[] = [];
		const fetchMock = vi.fn(async (request: RequestInfo | URL) => {
			const url = nativeUrl(request);
			if (url.pathname === "/api/wwos/rsi/search") {
				return new Response(
					JSON.stringify(
						nativeEnvelope(
							...(candidatesBySubject.get(url.searchParams.get("text") ?? "") ??
								[]),
						),
					),
					{ status: 200 },
				);
			}
			offerUrls.push(url);
			return new Response(JSON.stringify(records), { status: 200 });
		});

		const fact = await runWholeFoodsProductPricing(
			{ name: "priceProducts", input: input(...subjects) },
			{ fetch: fetchMock },
		);
		const offerUrl = offerUrls[0];
		if (!offerUrl) throw new Error("Expected one offer request.");
		const requestedAsins = (offerUrl.searchParams.get("asins") ?? "").split(
			",",
		);

		expect(WHOLE_FOODS_MAX_OFFER_RECORDS).toBe(96);
		expect(offerUrls).toHaveLength(1);
		expect(requestedAsins).toHaveLength(WHOLE_FOODS_MAX_OFFER_RECORDS);
		expect(new Set(requestedAsins).size).toBe(WHOLE_FOODS_MAX_OFFER_RECORDS);
		expect(offerUrl.toString().length).toBeLessThan(2_048);
		expect(
			parseWholeFoodsProductOffers(records, new Set(requestedAsins)),
		).toHaveProperty("size", WHOLE_FOODS_MAX_OFFER_RECORDS);
		expect(
			parseWholeFoodsProductOffers(
				[
					...records,
					product({
						asin: "B999999999",
						name: "Overflow Product, 1 oz",
						price: 1,
					}),
				],
				new Set([...requestedAsins, "B999999999"]),
			),
		).toBeNull();
		expect(fact).toMatchObject({
			type: "success",
			data: {
				searches: subjects.map((subject) => ({
					subject,
					price: { status: "sourced" },
				})),
			},
			receipt: { sourceCount: 8 },
		});
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

	it("clears in-flight ownership after offer-body rejection and retries successfully", async () => {
		const state = createWholeFoodsProductPricingState();
		let rejectOfferBody = true;
		const fetchMock = vi.fn(async (request: RequestInfo | URL) => {
			const url = nativeUrl(request);
			if (url.pathname === "/api/wwos/rsi/search") {
				return new Response(JSON.stringify(nativeEnvelope("B000000001")), {
					status: 200,
				});
			}
			if (rejectOfferBody) {
				rejectOfferBody = false;
				const response = new Response("unreadable", { status: 200 });
				vi.spyOn(response, "text").mockRejectedValue(
					new Error("fixture body stream rejected"),
				);
				return response;
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
		const call = { name: "priceProducts", input: input("Bread") };

		const first = await runWholeFoodsProductPricing(call, {
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
							reason: expect.stringContaining("could not be decoded"),
						},
					},
				],
			},
		});
		expect(JSON.stringify(first)).not.toContain("fixture body stream rejected");
		expect(state.inFlight.size).toBe(0);

		await expect(
			runWholeFoodsProductPricing(call, { fetch: fetchMock, state }),
		).resolves.toMatchObject({
			type: "success",
			data: {
				searches: [{ price: { status: "sourced", amount: 4.99 } }],
			},
		});
		expect(state.inFlight.size).toBe(0);
		expect(
			fetchMock.mock.calls.filter(
				([request]) => nativeUrl(request).pathname === "/api/wwos/rsi/search",
			),
		).toHaveLength(2);
	});

	it("keeps response-body consumption under the native request deadline", async () => {
		let activeSignal: AbortSignal | undefined;
		const state = createWholeFoodsProductPricingState();
		const fetchMock = vi.fn(
			async (_request: RequestInfo | URL, init?: RequestInit) => {
				activeSignal = init?.signal ?? undefined;
				const response = new Response("pending", { status: 200 });
				vi.spyOn(response, "text").mockImplementation(
					() =>
						new Promise<string>((_resolve, reject) => {
							if (activeSignal?.aborted) {
								reject(new Error("fixture body aborted"));
								return;
							}
							activeSignal?.addEventListener(
								"abort",
								() => reject(new Error("fixture body aborted")),
								{ once: true },
							);
						}),
				);
				return response;
			},
		);

		const fact = await runWholeFoodsProductPricing(
			{ name: "priceProducts", input: input("Bread") },
			{ fetch: fetchMock, state, timeoutMs: 5 },
		);
		expect(fact).toMatchObject({
			type: "success",
			data: {
				searches: [
					{
						price: { status: "unverified" },
						receipt: { native: "transport-error", brave: "not-eligible" },
					},
				],
			},
		});
		expect(JSON.stringify(fact)).not.toContain("fixture body aborted");
		expect(activeSignal?.aborted).toBe(true);
		expect(state.inFlight.size).toBe(0);
	});

	it("reports miss when one aggregate contains hit, coalesced, and miss subjects", async () => {
		let releaseMilkSearch: (() => void) | undefined;
		const milkSearchGate = new Promise<void>((resolve) => {
			releaseMilkSearch = resolve;
		});
		const state = createWholeFoodsProductPricingState();
		const asinsBySubject = new Map([
			["Bread", "B000000001"],
			["Milk", "B000000002"],
			["Eggs", "B000000003"],
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
					name: "Organic Whole Milk, 1 gallon",
					price: 6.29,
				}),
			],
			[
				"B000000003",
				product({
					asin: "B000000003",
					name: "Large Grade A Eggs, 12 ct",
					price: 4.39,
				}),
			],
		]);
		const fetchMock = vi.fn(async (request: RequestInfo | URL) => {
			const url = nativeUrl(request);
			if (url.pathname === "/api/wwos/rsi/search") {
				const subject = url.searchParams.get("text") ?? "";
				if (subject === "Milk") await milkSearchGate;
				return new Response(
					JSON.stringify(nativeEnvelope(asinsBySubject.get(subject) ?? "")),
					{ status: 200 },
				);
			}
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
		const options = { fetch: fetchMock, state };

		await runWholeFoodsProductPricing(
			{ name: "priceProducts", input: input("Bread") },
			options,
		);
		const milkOwner = runWholeFoodsProductPricing(
			{ name: "priceProducts", input: input("Milk") },
			options,
		);
		const aggregate = runWholeFoodsProductPricing(
			{ name: "priceProducts", input: input("Bread", "Milk", "Eggs") },
			options,
		);
		releaseMilkSearch?.();
		await milkOwner;
		const fact = await aggregate;

		expect(fact).toMatchObject({
			type: "success",
			data: {
				searches: [
					{ subject: "Bread", receipt: { cache: "hit" } },
					{ subject: "Milk", receipt: { cache: "coalesced" } },
					{ subject: "Eggs", receipt: { cache: "miss" } },
				],
			},
			receipt: { cache: { status: "miss" }, sourceCount: 3 },
		});
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
			name: "malformed JSON",
			response: () => new Response("{", { status: 200 }),
			native: "schema-drift",
		},
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
		{
			name: "fetch rejection",
			response: () => Promise.reject(new Error("fixture fetch rejected")),
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
		expect(JSON.stringify(fact)).not.toContain("fixture fetch rejected");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("returns ambiguous candidate selection as unverified without caching an identity", async () => {
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
						name: "Organic Whole Beverage, 1 gallon",
						price: 5.99,
					}),
					product({
						asin: "B000000002",
						name: "Organic Whole Milk Gallon, 1 gallon",
						price: 6.29,
					}),
				]),
				{ status: 200 },
			);
		});
		const call = {
			name: "priceProducts",
			input: input("Organic Whole Milk Gallon"),
		};
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
							reasonCode: "candidate-ambiguous",
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

	it.each([
		{
			name: "non-USD currency",
			record: product({
				asin: "B000000001",
				name: "Organic Sourdough Bread, 24 oz",
				price: 4.99,
				currencyCode: "CAD",
			}),
		},
		{
			name: "zero price",
			record: product({
				asin: "B000000001",
				name: "Organic Sourdough Bread, 24 oz",
				price: 0,
			}),
		},
		{
			name: "negative price",
			record: product({
				asin: "B000000001",
				name: "Organic Sourdough Bread, 24 oz",
				price: -1,
			}),
		},
		{
			name: "malformed price",
			record: product({
				asin: "B000000001",
				name: "Organic Sourdough Bread, 24 oz",
				price: "4.99",
			}),
		},
		{
			name: "out-of-stock offer",
			record: product({
				asin: "B000000001",
				name: "Organic Sourdough Bread, 24 oz",
				price: 4.99,
				availability: "OUT_OF_STOCK",
			}),
		},
	])(
		"keeps a selected identity but never sources a $name",
		async ({ record }) => {
			const state = createWholeFoodsProductPricingState();
			const fetchMock = vi.fn(async (request: RequestInfo | URL) => {
				const url = nativeUrl(request);
				return url.pathname === "/api/wwos/rsi/search"
					? new Response(JSON.stringify(nativeEnvelope("B000000001")), {
							status: 200,
						})
					: new Response(JSON.stringify([record]), { status: 200 });
			});
			const call = { name: "priceProducts", input: input("Bread") };

			const first = await runWholeFoodsProductPricing(call, {
				fetch: fetchMock,
				state,
			});
			const second = await runWholeFoodsProductPricing(call, {
				fetch: fetchMock,
				state,
			});

			expect(first).toMatchObject({
				type: "success",
				data: {
					searches: [
						{
							selection: { asin: "B000000001" },
							price: {
								status: "unverified",
								amount: null,
								reasonCode: "offer-unavailable",
							},
						},
					],
				},
				receipt: { sourceCount: 0 },
			});
			expect(second).toMatchObject({ receipt: { cache: { status: "hit" } } });
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
		},
	);

	it.each([
		{
			name: "malformed",
			offerResponse: () => new Response("{", { status: 200 }),
		},
		{
			name: "failed",
			offerResponse: () => new Response("unavailable", { status: 503 }),
		},
	])(
		"returns unverified and does not cache after a $name offer response",
		async ({ offerResponse }) => {
			const state = createWholeFoodsProductPricingState();
			const fetchMock = vi.fn(async (request: RequestInfo | URL) => {
				const url = nativeUrl(request);
				return url.pathname === "/api/wwos/rsi/search"
					? new Response(JSON.stringify(nativeEnvelope("B000000001")), {
							status: 200,
						})
					: offerResponse();
			});
			const call = { name: "priceProducts", input: input("Bread") };

			const first = await runWholeFoodsProductPricing(call, {
				fetch: fetchMock,
				state,
			});
			await runWholeFoodsProductPricing(call, { fetch: fetchMock, state });

			expect(first).toMatchObject({
				type: "success",
				data: {
					searches: [
						{
							price: {
								status: "unverified",
								amount: null,
								reasonCode: "provider-response-invalid",
								reason: expect.stringContaining("could not be decoded"),
							},
						},
					],
				},
				receipt: { sourceCount: 0 },
			});
			expect(
				fetchMock.mock.calls.filter(
					([request]) => nativeUrl(request).pathname === "/api/wwos/rsi/search",
				),
			).toHaveLength(2);
		},
	);

	it("reports mixed sourced and unverified offers from one batch", async () => {
		const fetchMock = vi.fn(async (request: RequestInfo | URL) => {
			const url = nativeUrl(request);
			if (url.pathname === "/api/wwos/rsi/search") {
				return new Response(
					JSON.stringify(
						nativeEnvelope(
							url.searchParams.get("text") === "Bread"
								? "B000000001"
								: "B000000002",
						),
					),
					{ status: 200 },
				);
			}
			return new Response(
				JSON.stringify([
					product({
						asin: "B000000001",
						name: "Organic Sourdough Bread, 24 oz",
						price: 4.99,
					}),
					product({
						asin: "B000000002",
						name: "Organic Whole Milk, 1 gallon",
						price: 6.29,
						currencyCode: "CAD",
					}),
				]),
				{ status: 200 },
			);
		});

		const fact = await runWholeFoodsProductPricing(
			{ name: "priceProducts", input: input("Bread", "Milk") },
			{ fetch: fetchMock },
		);

		expect(fact).toMatchObject({
			type: "success",
			data: {
				searches: [
					{ subject: "Bread", price: { status: "sourced", amount: 4.99 } },
					{ subject: "Milk", price: { status: "unverified", amount: null } },
				],
			},
			receipt: { sourceCount: 1 },
		});
		expect(
			fetchMock.mock.calls.filter(
				([request]) => nativeUrl(request).pathname === "/api/wwos/products",
			),
		).toHaveLength(1);
	});
});

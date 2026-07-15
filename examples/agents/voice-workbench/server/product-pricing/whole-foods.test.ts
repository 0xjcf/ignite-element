import { describe, expect, it, vi } from "vitest";
import {
	asinFromWholeFoodsProductUrl,
	parseWholeFoodsProductOffers,
	runWholeFoodsProductPricing,
} from "./whole-foods";

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
	brandName: "365 by Whole Foods Market",
	programType: "GROCERY",
	availability,
	offerDetails: { price: { priceAmount: price, currencyCode } },
});

const representativeInput = {
	retailer: "Whole Foods",
	location: "Sarasota",
	items: [
		{
			subject: "Bread",
			product: "365 Organic Sourdough Bread",
			size: "24 oz loaf",
		},
		{
			subject: "Eggs",
			product: "365 Large White Grade A Eggs",
			size: "12 count",
		},
		{
			subject: "Milk",
			product: "365 Whole Milk",
			size: "1 gallon",
		},
	],
};

const representativeProducts = [
	product({
		asin: "B0DPXKXV31",
		name: "365 by Whole Foods Market Organic Sourdough Bread, 24 OZ",
		price: 4.99,
	}),
	product({
		asin: "B074H73HVJ",
		name: "Large White Grade A Eggs, 12 ct",
		price: 4.39,
	}),
	product({
		asin: "B074VDFX51",
		name: "365 by Whole Foods Market Whole Milk, 128 fl oz",
		price: 6.29,
	}),
];

describe("Whole Foods server price adapter", () => {
	it("resolves the representative Sarasota list with zero Brave requests and one retailer batch", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(String(input));
			expect(url.hostname).toBe("www.wholefoodsmarket.com");
			expect(url.pathname).toBe("/api/wwos/products");
			return new Response(JSON.stringify(representativeProducts), {
				status: 200,
			});
		});

		const fact = await runWholeFoodsProductPricing(
			{ name: "priceProducts", input: representativeInput },
			{ apiKey: "unused-free-plan-key", fetch: fetchMock },
		);

		expect(fact).toMatchObject({
			type: "success",
			data: {
				searches: [
					{ subject: "Bread", price: { status: "sourced", amount: 4.99 } },
					{ subject: "Eggs", price: { status: "sourced", amount: 4.39 } },
					{ subject: "Milk", price: { status: "sourced", amount: 6.29 } },
				],
			},
			receipt: { queryCount: 0, sourceCount: 3 },
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const endpoint = new URL(String(fetchMock.mock.calls[0]?.[0]));
		expect(endpoint.searchParams.get("offerListingDiscriminator")).toBe("A0H6");
		expect(endpoint.searchParams.get("asins")?.split(",")).toEqual([
			"B0DPXKXV31",
			"B074H73HVJ",
			"B074VDFX51",
		]);
	});

	it("uses one provider-owned Brave discovery request for an uncatalogued item", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(String(input));
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
			{
				name: "priceProducts",
				input: {
					retailer: "Whole Foods",
					location: "Sarasota, FL",
					items: [
						{
							subject: "Coffee",
							product: "Organic Ground Coffee",
							size: "12 oz",
						},
					],
				},
			},
			{ apiKey: "free-plan-key", fetch: fetchMock },
		);

		expect(fact).toMatchObject({
			type: "success",
			data: {
				searches: [
					{ subject: "Coffee", price: { status: "sourced", amount: 12.49 } },
				],
			},
			receipt: { queryCount: 1, sourceCount: 1 },
		});
		const braveRequests = fetchMock.mock.calls.filter(([input]) =>
			String(input).includes("api.search.brave.com"),
		);
		expect(braveRequests).toHaveLength(1);
		expect(new URL(String(braveRequests[0]?.[0])).searchParams.get("q")).toBe(
			'site:wholefoodsmarket.com "Organic Ground Coffee" "12 oz" Whole Foods Market product',
		);
	});

	it("extracts ASINs only from official product URLs", () => {
		expect(
			asinFromWholeFoodsProductUrl(
				"https://www.wholefoodsmarket.com/grocery/product/organic-ground-coffee-b012345678",
			),
		).toBe("B012345678");
		expect(
			asinFromWholeFoodsProductUrl(
				"https://example.com/grocery/product/organic-ground-coffee-b012345678",
			),
		).toBeNull();
	});

	it("fails closed for wrong currency, availability, identity, or malformed payloads", () => {
		const item = representativeInput.items[0];
		const items = new Map([["B0DPXKXV31", item]]);
		const offers = parseWholeFoodsProductOffers(
			[
				product({
					asin: "B0DPXKXV31",
					name: "365 Organic Sourdough Bread",
					price: 4.99,
					currencyCode: "CAD",
				}),
				product({
					asin: "B0DPXKXV31",
					name: "365 Organic Sourdough Bread",
					price: 4.99,
					availability: "OUT_OF_STOCK",
				}),
				product({
					asin: "B0DPXKXV31",
					name: "Chocolate Cake",
					price: 2.79,
				}),
				product({
					asin: "B0DPXKXV31",
					name: "365 Organic Sourdough Bread, 48 oz",
					price: 6.99,
				}),
			],
			items,
		);
		expect(offers).toEqual(new Map());
		expect(parseWholeFoodsProductOffers({ products: [] }, items)).toBeNull();
	});

	it("returns unverified evidence instead of admitting an unrelated numeric offer", async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify([
						product({
							asin: "B0DPXKXV31",
							name: "Chocolate Cake",
							price: 2.79,
						}),
					]),
					{ status: 200 },
				),
		);
		await expect(
			runWholeFoodsProductPricing(
				{
					name: "priceProducts",
					input: {
						...representativeInput,
						items: representativeInput.items.slice(0, 1),
					},
				},
				{ fetch: fetchMock },
			),
		).resolves.toMatchObject({
			type: "success",
			data: {
				searches: [
					{
						price: { status: "unverified", amount: null },
						results: [{ description: expect.not.stringMatching(/\$\s*2\.79/) }],
					},
				],
			},
		});
	});

	it("spends at most one Brave request for an uncatalogued item", async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(JSON.stringify({ message: "rate limited" }), {
					status: 429,
				}),
		);
		const fact = await runWholeFoodsProductPricing(
			{
				name: "priceProducts",
				input: {
					retailer: "Whole Foods",
					location: "Sarasota",
					items: [
						{
							subject: "Coffee",
							product: "Organic Ground Coffee",
							size: "12 oz",
						},
					],
				},
			},
			{ apiKey: "free-plan-key", fetch: fetchMock },
		);

		expect(fact).toMatchObject({
			type: "provider-failure",
			status: 429,
			retry: { attempts: 1, maxAttempts: 1, exhausted: true },
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

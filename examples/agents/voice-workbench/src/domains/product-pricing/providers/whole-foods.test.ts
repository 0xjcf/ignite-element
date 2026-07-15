import { describe, expect, it } from "vitest";
import {
	buildWholeFoodsDiscoveryQuery,
	isWholeFoodsProductUrl,
	resolveWholeFoodsCatalogProduct,
	resolveWholeFoodsStorePolicy,
	scopeWholeFoodsProductUrl,
} from "./whole-foods";

describe("Whole Foods product-pricing policy", () => {
	it("maps the admitted representative products without numeric price constants", () => {
		expect(
			resolveWholeFoodsCatalogProduct({
				subject: "breads",
				product: "365 Organic Sourdough Bread",
				size: "24 oz loaf",
			}),
		).toMatchObject({
			subject: "Bread",
			productUrl: expect.stringContaining("organic-sourdough-bread"),
		});
		expect(
			JSON.stringify(
				resolveWholeFoodsCatalogProduct({
					subject: "Milk",
					product: "365 Whole Milk",
					size: "1 gallon",
				}),
			),
		).not.toMatch(/\$\d|"price"/i);
	});

	it("canonicalizes the supported store aliases and rejects other locations", () => {
		expect(
			resolveWholeFoodsStorePolicy("wholefoods", "Sarasota, FL"),
		).toMatchObject({
			storeId: "10189",
			storeName: "Sarasota",
		});
		expect(resolveWholeFoodsStorePolicy("Whole Foods", "Tampa")).toBeNull();
	});

	it("owns exact official product URL and deterministic discovery rules", () => {
		const query = buildWholeFoodsDiscoveryQuery({
			subject: "Coffee",
			product: "Organic Ground Coffee",
			size: "12 oz",
		});
		expect(query).toBe(
			'site:wholefoodsmarket.com "Organic Ground Coffee" "12 oz" Whole Foods Market product',
		);
		expect(
			isWholeFoodsProductUrl("https://www.wholefoodsmarket.com/product/coffee"),
		).toBe(true);
		expect(isWholeFoodsProductUrl("https://example.com/product/coffee")).toBe(
			false,
		);
		expect(
			scopeWholeFoodsProductUrl(
				"https://www.wholefoodsmarket.com/grocery/product/coffee?utm_source=test#offer",
			),
		).toBe(
			"https://www.wholefoodsmarket.com/grocery/product/coffee?store=10189",
		);
	});
});

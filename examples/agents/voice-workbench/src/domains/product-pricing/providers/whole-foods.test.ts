import { describe, expect, it } from "vitest";
import nativeSearchFixture from "./fixtures/whole-foods-native-search.json";
import {
	asinFromWholeFoodsProductUrl,
	buildWholeFoodsDiscoveryQuery,
	parseWholeFoodsNativeSearch,
	rankWholeFoodsCandidates,
	resolveWholeFoodsStorePolicy,
	scopeWholeFoodsProductUrl,
	WHOLE_FOODS_CANDIDATE_POLICY_VERSION,
} from "./whole-foods";

describe("Whole Foods product-pricing policy", () => {
	it("decodes only the bounded retailer-native search envelope", () => {
		expect(parseWholeFoodsNativeSearch(nativeSearchFixture)).toEqual({
			ok: true,
			candidates: [
				{ asin: "B074H5SR5S", searchRank: 0 },
				{ asin: "B000O6K8TI", searchRank: 1 },
				{ asin: "B074VDFX51", searchRank: 2 },
			],
		});
		expect(
			parseWholeFoodsNativeSearch({
				data: nativeSearchFixture,
			}),
		).toEqual({ ok: false, reason: "schema-drift" });
		expect(
			parseWholeFoodsNativeSearch({
				mainResultSet: { searchResults: [{ product: { asin: "B074H5SR5S" } }] },
			}),
		).toEqual({ ok: false, reason: "schema-drift" });
	});

	it("ranks candidates deterministically with versioned score, tie, and margin rules", () => {
		const selection = rankWholeFoodsCandidates("Milk", [
			{
				asin: "B000000001",
				name: "Organic Whole Milk, 1 gallon",
				searchRank: 0,
			},
			{
				asin: "B000000002",
				name: "Chocolate Oat Beverage, 32 fl oz",
				searchRank: 1,
			},
		]);

		expect(selection).toMatchObject({
			outcome: "selected",
			policyVersion: WHOLE_FOODS_CANDIDATE_POLICY_VERSION,
			candidate: {
				asin: "B000000001",
				product: "Organic Whole Milk",
				size: "1 gallon",
			},
		});
		if (selection.outcome === "selected") {
			expect(selection.margin).toBeGreaterThanOrEqual(15);
		}
	});

	it("distinguishes ambiguity from a deterministic miss", () => {
		expect(
			rankWholeFoodsCandidates("Milk", [
				{
					asin: "B000000002",
					name: "Whole Milk, 64 fl oz",
					searchRank: 0,
				},
				{
					asin: "B000000001",
					name: "Whole Milk, 1 gallon",
					searchRank: 0,
				},
			]),
		).toMatchObject({
			outcome: "ambiguous",
			candidateAsins: ["B000000001", "B000000002"],
		});
		expect(
			rankWholeFoodsCandidates("Milk", [
				{
					asin: "B000000003",
					name: "Chocolate Cake, 16 oz",
					searchRank: 0,
				},
			]),
		).toMatchObject({ outcome: "miss", reason: "low-confidence" });
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

	it("keeps provider-owned query and official product URL/ASIN helpers", () => {
		expect(buildWholeFoodsDiscoveryQuery(" Coffee ")).toBe(
			'site:wholefoodsmarket.com "Coffee" Whole Foods Market product',
		);
		expect(
			asinFromWholeFoodsProductUrl(
				"https://www.wholefoodsmarket.com/grocery/product/coffee-b012345678",
			),
		).toBe("B012345678");
		expect(
			scopeWholeFoodsProductUrl(
				"https://www.wholefoodsmarket.com/grocery/product/coffee-b012345678?utm_source=test#offer",
			),
		).toBe(
			"https://www.wholefoodsmarket.com/grocery/product/coffee-b012345678?store=10189",
		);
	});
});

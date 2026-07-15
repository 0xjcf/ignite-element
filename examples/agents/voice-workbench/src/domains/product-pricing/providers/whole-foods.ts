import type { ProductPricingSelectedItem } from "../policy";

export type WholeFoodsStorePolicy = {
	retailer: "Whole Foods Market";
	storeId: string;
	storeName: string;
	offerListingDiscriminator: string;
	country: "us";
};

export type WholeFoodsCatalogProduct = ProductPricingSelectedItem & {
	asin: string;
	productUrl: string;
	productAliases: readonly string[];
	sizeAliases: readonly string[];
};

export const WHOLE_FOODS_SARASOTA: WholeFoodsStorePolicy = Object.freeze({
	retailer: "Whole Foods Market",
	storeId: "10189",
	storeName: "Sarasota",
	offerListingDiscriminator: "A0H6",
	country: "us",
});

const CATALOG: readonly WholeFoodsCatalogProduct[] = [
	{
		subject: "Bread",
		product: "365 Organic Sourdough Bread",
		size: "24 oz loaf",
		asin: "B0DPXKXV31",
		productUrl:
			"https://www.wholefoodsmarket.com/grocery/product/365-by-whole-foods-market-organic-sourdough-bread-24-oz-b0dpxkxv31",
		productAliases: ["365 Organic Sourdough Bread", "Organic Sourdough Bread"],
		sizeAliases: ["24 oz loaf", "24 oz"],
	},
	{
		subject: "Eggs",
		product: "365 Large White Grade A Eggs",
		size: "12 count",
		asin: "B074H73HVJ",
		productUrl:
			"https://www.wholefoodsmarket.com/grocery/product/365-by-whole-foods-market-large-white-grade-a-eggs-12-ct-b074h73hvj",
		productAliases: [
			"365 Large White Grade A Eggs",
			"Large White Grade A Eggs",
			"Large Grade A Eggs",
		],
		sizeAliases: ["12 count", "dozen"],
	},
	{
		subject: "Milk",
		product: "365 Whole Milk",
		size: "1 gallon",
		asin: "B074VDFX51",
		productUrl:
			"https://www.wholefoodsmarket.com/grocery/product/365-by-whole-foods-market-whole-milk-gallon-128-fl-oz-b074vdfx51",
		productAliases: ["365 Whole Milk", "Whole Milk"],
		sizeAliases: ["1 gallon", "gallon", "128 fl oz"],
	},
];

const identity = (value: string): string =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "");

const subjectIdentity = (value: string): string => {
	const normalized = identity(value);
	return normalized.endsWith("s") ? normalized.slice(0, -1) : normalized;
};

const aliasesInclude = (aliases: readonly string[], value: string): boolean =>
	aliases.some((alias) => identity(alias) === identity(value));

export const resolveWholeFoodsStorePolicy = (
	retailer: string,
	location: string,
): WholeFoodsStorePolicy | null => {
	const retailerKey = identity(retailer);
	const locationKey = identity(location);
	const retailerMatches =
		retailerKey === "wholefoods" || retailerKey === "wholefoodsmarket";
	const locationMatches = [
		"sarasota",
		"sarasotafl",
		"sarasotaflorida",
	].includes(locationKey);
	return retailerMatches && locationMatches ? WHOLE_FOODS_SARASOTA : null;
};

export const resolveWholeFoodsCatalogProduct = (
	item: ProductPricingSelectedItem,
): WholeFoodsCatalogProduct | null =>
	CATALOG.find(
		(candidate) =>
			subjectIdentity(candidate.subject) === subjectIdentity(item.subject) &&
			aliasesInclude(candidate.productAliases, item.product) &&
			aliasesInclude(candidate.sizeAliases, item.size),
	) ?? null;

const quotedQueryValue = (value: string): string =>
	`"${value
		.trim()
		.replace(/["\\]+/g, " ")
		.replace(/\s+/g, " ")}"`;

export const buildWholeFoodsDiscoveryQuery = (
	item: ProductPricingSelectedItem,
): string =>
	[
		"site:wholefoodsmarket.com",
		quotedQueryValue(item.product),
		quotedQueryValue(item.size),
		"Whole Foods Market product",
	].join(" ");

export const isWholeFoodsProductUrl = (value: string): boolean => {
	try {
		const url = new URL(value);
		return (
			url.protocol === "https:" &&
			url.hostname === "www.wholefoodsmarket.com" &&
			/^\/(?:grocery\/)?product\//.test(url.pathname)
		);
	} catch {
		return false;
	}
};

export const scopeWholeFoodsProductUrl = (
	value: string,
	storeId = WHOLE_FOODS_SARASOTA.storeId,
): string | null => {
	if (!isWholeFoodsProductUrl(value)) return null;
	const url = new URL(value);
	url.search = "";
	url.hash = "";
	url.searchParams.set("store", storeId);
	return url.toString();
};

export const wholeFoodsCatalog = (): readonly WholeFoodsCatalogProduct[] =>
	CATALOG;

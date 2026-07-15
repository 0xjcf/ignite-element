import type { NeutralToolCall } from "ignite-element/tools";
import type { CapabilityExecutionFact } from "../../src/capability-federation";
import type { ProductPricingSelectedItem } from "../../src/domains/product-pricing/policy";
import {
	PRODUCT_PRICE_OWNER_ID,
	PRODUCT_PRICE_TOOL_NAME,
	type ProductPriceInput,
	readProductPriceInput,
} from "../../src/domains/product-pricing/price-capability";
import {
	buildWholeFoodsDiscoveryQuery,
	isWholeFoodsProductUrl,
	resolveWholeFoodsCatalogProduct,
	resolveWholeFoodsStorePolicy,
	scopeWholeFoodsProductUrl,
	type WholeFoodsStorePolicy,
} from "../../src/domains/product-pricing/providers/whole-foods";
import type {
	WebSearchFact,
	WebSearchResult,
} from "../../src/web-search-capability";
import {
	type BraveWebSearchOptions,
	runBraveWebSearch,
} from "../brave-web-search";

type FetchLike = (
	input: RequestInfo | URL,
	init?: RequestInit,
) => Promise<Response>;

export type WholeFoodsProductPricingOptions = {
	apiKey?: string;
	fetch?: FetchLike;
	timeoutMs?: number;
	brave?: Omit<BraveWebSearchOptions, "apiKey" | "fetch" | "maxRetries">;
};

export type WholeFoodsProductOffer = {
	asin: string;
	name: string;
	price: number;
	currency: "USD";
	availability: "IN_STOCK";
};

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_PRODUCT_RESPONSE_BYTES = 1_000_000;
const ASIN_PATTERN = /(?:^|[-/])([a-z0-9]{10})(?:$|[/?#])/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const failure = (
	type: "unavailable" | "validation" | "timeout" | "provider-failure",
	message: string,
	extra: { issues?: readonly string[]; status?: number } = {},
): CapabilityExecutionFact => ({
	type,
	ownerId: PRODUCT_PRICE_OWNER_ID,
	toolName: PRODUCT_PRICE_TOOL_NAME,
	message,
	...extra,
});

const meaningfulTokens = (value: string): string[] => {
	const ignored = new Set([
		"365",
		"a",
		"by",
		"foods",
		"grade",
		"market",
		"the",
		"whole",
	]);
	return value
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((token) => token.length > 1 && !ignored.has(token));
};

type NormalizedSize = {
	kind: "count" | "volume-ounce" | "weight-ounce";
	amount: number;
};

const normalizedSize = (value: string): NormalizedSize | null => {
	const text = value.trim().toLowerCase();
	if (/\b(?:a\s+)?dozen\b/.test(text)) return { kind: "count", amount: 12 };
	const match = text.match(
		/(\d+(?:\.\d+)?)\s*(fl\s*oz|fluid\s+ounces?|gallons?|gal|ounces?|oz|pounds?|lbs?|counts?|ct)\b/,
	);
	if (!match) return null;
	const amount = Number(match[1]);
	const unit = match[2]?.replace(/\s+/g, " ");
	if (!Number.isFinite(amount) || amount <= 0 || !unit) return null;
	if (unit === "fl oz" || unit.startsWith("fluid ounce")) {
		return { kind: "volume-ounce", amount };
	}
	if (unit === "gal" || unit.startsWith("gallon")) {
		return { kind: "volume-ounce", amount: amount * 128 };
	}
	if (unit === "oz" || unit.startsWith("ounce")) {
		return { kind: "weight-ounce", amount };
	}
	if (unit.startsWith("lb") || unit.startsWith("pound")) {
		return { kind: "weight-ounce", amount: amount * 16 };
	}
	return { kind: "count", amount };
};

const sizeMatches = (actualName: string, requestedSize: string): boolean => {
	const actual = normalizedSize(actualName);
	const requested = normalizedSize(requestedSize);
	return (
		actual !== null &&
		requested !== null &&
		actual.kind === requested.kind &&
		actual.amount === requested.amount
	);
};

const productMatches = (
	actualName: string,
	item: ProductPricingSelectedItem,
): boolean => {
	const actual = new Set(meaningfulTokens(actualName));
	const expected = meaningfulTokens(item.product);
	if (expected.length === 0) return false;
	const matches = expected.filter((token) => actual.has(token)).length;
	return (
		matches >= Math.min(expected.length, 2) &&
		sizeMatches(actualName, item.size)
	);
};

export const asinFromWholeFoodsProductUrl = (value: string): string | null => {
	if (!isWholeFoodsProductUrl(value)) return null;
	const asin = new URL(value).pathname.match(ASIN_PATTERN)?.[1];
	return asin ? asin.toUpperCase() : null;
};

export const parseWholeFoodsProductOffers = (
	value: unknown,
	itemsByAsin: ReadonlyMap<string, ProductPricingSelectedItem>,
): ReadonlyMap<string, WholeFoodsProductOffer> | null => {
	if (!Array.isArray(value) || value.length > 8) return null;
	const offers = new Map<string, WholeFoodsProductOffer>();
	for (const candidate of value) {
		if (!isRecord(candidate) || typeof candidate.asin !== "string") continue;
		const asin = candidate.asin.trim().toUpperCase();
		const item = itemsByAsin.get(asin);
		if (
			!item ||
			typeof candidate.name !== "string" ||
			candidate.programType !== "GROCERY" ||
			candidate.availability !== "IN_STOCK" ||
			!productMatches(candidate.name, item) ||
			!isRecord(candidate.offerDetails) ||
			!isRecord(candidate.offerDetails.price)
		) {
			continue;
		}
		const price = candidate.offerDetails.price.priceAmount;
		if (
			typeof price !== "number" ||
			!Number.isFinite(price) ||
			price <= 0 ||
			price > 10_000 ||
			candidate.offerDetails.price.currencyCode !== "USD"
		) {
			continue;
		}
		offers.set(asin, {
			asin,
			name: candidate.name,
			price,
			currency: "USD",
			availability: "IN_STOCK",
		});
	}
	return offers;
};

const discoveredProductUrl = (fact: CapabilityExecutionFact): string | null => {
	if (
		fact.type !== "success" ||
		!isRecord(fact.data) ||
		!Array.isArray(fact.data.searches)
	) {
		return null;
	}
	for (const search of fact.data.searches) {
		if (!isRecord(search) || !Array.isArray(search.results)) continue;
		for (const result of search.results) {
			if (!isRecord(result) || typeof result.url !== "string") continue;
			if (asinFromWholeFoodsProductUrl(result.url)) return result.url;
		}
	}
	return null;
};

type ResolvedProduct = {
	item: ProductPricingSelectedItem;
	query: string;
	asin: string | null;
	url: string | null;
};

const resolveProducts = async (
	input: ProductPriceInput,
	options: WholeFoodsProductPricingOptions,
): Promise<
	| { ok: true; products: ResolvedProduct[]; queryCount: number }
	| { ok: false; fact: CapabilityExecutionFact }
> => {
	const products: ResolvedProduct[] = [];
	let queryCount = 0;
	for (const item of input.items) {
		const query = buildWholeFoodsDiscoveryQuery(item);
		const catalogProduct = resolveWholeFoodsCatalogProduct(item);
		if (catalogProduct) {
			products.push({
				item,
				query,
				asin: catalogProduct.asin,
				url: catalogProduct.productUrl,
			});
			continue;
		}
		if (!options.apiKey?.trim()) {
			return {
				ok: false,
				fact: failure(
					"unavailable",
					"Brave discovery is not configured for this uncatalogued product.",
				),
			};
		}
		queryCount += 1;
		const discovery = await runBraveWebSearch(
			{
				name: "searchWeb",
				input: {
					queries: [{ subject: item.subject, query }],
					countPerQuery: 5,
					country: "us",
				},
			},
			{
				...options.brave,
				apiKey: options.apiKey,
				fetch: options.fetch,
				maxRetries: 0,
			},
		);
		if (discovery.type !== "success") {
			return {
				ok: false,
				fact: {
					...discovery,
					ownerId: PRODUCT_PRICE_OWNER_ID,
					toolName: PRODUCT_PRICE_TOOL_NAME,
				},
			};
		}
		const url = discoveredProductUrl(discovery);
		products.push({
			item,
			query,
			asin: url ? asinFromWholeFoodsProductUrl(url) : null,
			url,
		});
	}
	return { ok: true, products, queryCount };
};

const productDetailsEndpoint = (
	store: WholeFoodsStorePolicy,
	asins: readonly string[],
): URL => {
	const endpoint = new URL(
		"https://www.wholefoodsmarket.com/api/wwos/products",
	);
	endpoint.searchParams.set(
		"offerListingDiscriminator",
		store.offerListingDiscriminator,
	);
	endpoint.searchParams.set("programType", "GROCERY");
	endpoint.searchParams.set("asins", asins.join(","));
	return endpoint;
};

const fetchProductOffers = async (
	products: readonly ResolvedProduct[],
	store: WholeFoodsStorePolicy,
	options: WholeFoodsProductPricingOptions,
): Promise<
	| { ok: true; offers: ReadonlyMap<string, WholeFoodsProductOffer> }
	| { ok: false; fact: CapabilityExecutionFact }
> => {
	const fetcher = options.fetch ?? globalThis.fetch;
	if (typeof fetcher !== "function") {
		return {
			ok: false,
			fact: failure(
				"unavailable",
				"The server does not provide retailer transport.",
			),
		};
	}
	const itemsByAsin = new Map<string, ProductPricingSelectedItem>();
	for (const product of products) {
		if (product.asin) itemsByAsin.set(product.asin, product.item);
	}
	if (itemsByAsin.size === 0) return { ok: true, offers: new Map() };
	const controller = new AbortController();
	const timeout = setTimeout(
		() => controller.abort(),
		options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
	);
	try {
		const response = await fetcher(
			productDetailsEndpoint(store, [...itemsByAsin.keys()]),
			{
				headers: { accept: "application/json" },
				signal: controller.signal,
			},
		);
		if (!response.ok) {
			return {
				ok: false,
				fact: failure(
					"provider-failure",
					"Whole Foods rejected the store-scoped product request.",
					{ status: response.status },
				),
			};
		}
		const contentLength = Number(response.headers.get("content-length"));
		if (
			Number.isFinite(contentLength) &&
			contentLength > MAX_PRODUCT_RESPONSE_BYTES
		) {
			return {
				ok: false,
				fact: failure(
					"provider-failure",
					"Whole Foods returned an oversized product response.",
				),
			};
		}
		const body = await response.text();
		if (Buffer.byteLength(body, "utf8") > MAX_PRODUCT_RESPONSE_BYTES) {
			return {
				ok: false,
				fact: failure(
					"provider-failure",
					"Whole Foods returned an oversized product response.",
				),
			};
		}
		const payload: unknown = JSON.parse(body);
		const offers = parseWholeFoodsProductOffers(payload, itemsByAsin);
		return offers
			? { ok: true, offers }
			: {
					ok: false,
					fact: failure(
						"provider-failure",
						"Whole Foods returned an invalid product response.",
					),
				};
	} catch {
		return {
			ok: false,
			fact: controller.signal.aborted
				? failure("timeout", "Whole Foods product pricing timed out.")
				: failure(
						"provider-failure",
						"Whole Foods product pricing could not be reached.",
					),
		};
	} finally {
		clearTimeout(timeout);
		controller.abort();
	}
};

const unverifiedPrice = (sourceUrl: string | null) => ({
	status: "unverified" as const,
	amount: null,
	sourceUrl,
	reason:
		"No matching in-stock USD offer was returned for the requested store and product." as const,
});

const resultForProduct = (
	product: ResolvedProduct,
	store: WholeFoodsStorePolicy,
	offers: ReadonlyMap<string, WholeFoodsProductOffer>,
): WebSearchFact["searches"][number] => {
	const sourceUrl = product.url
		? scopeWholeFoodsProductUrl(product.url, store.storeId)
		: null;
	const offer =
		product.asin && sourceUrl ? offers.get(product.asin) : undefined;
	const results: WebSearchResult[] = sourceUrl
		? [
				{
					title: offer?.name ?? `${product.item.product} (${store.storeName})`,
					url: sourceUrl,
					description: offer
						? `Official ${store.storeName} listed price: $${offer.price.toFixed(2)}.`
						: `Official ${store.storeName} offer is unavailable or unverified.`,
				},
			]
		: [];
	return {
		subject: product.item.subject,
		query: product.query,
		price:
			offer && sourceUrl
				? {
						status: "sourced",
						amount: offer.price,
						display: `$${offer.price.toFixed(2)}`,
						sourceUrl,
					}
				: unverifiedPrice(sourceUrl),
		results,
	};
};

export async function runWholeFoodsProductPricing(
	call: NeutralToolCall,
	options: WholeFoodsProductPricingOptions = {},
): Promise<CapabilityExecutionFact> {
	if (call.name !== PRODUCT_PRICE_TOOL_NAME) {
		return failure(
			"unavailable",
			"The requested product-pricing tool is unavailable.",
		);
	}
	const input = readProductPriceInput(call.input);
	if (!input.ok) {
		return failure("validation", "The product-pricing input is invalid.", {
			issues: input.issues,
		});
	}
	const store = resolveWholeFoodsStorePolicy(
		input.value.retailer,
		input.value.location,
	);
	if (!store) {
		return failure(
			"validation",
			"This example has no product-pricing provider for the requested retailer and location.",
			{
				issues: [
					"Supported scope: Whole Foods Market, Sarasota, Florida (store 10189).",
				],
			},
		);
	}
	const resolved = await resolveProducts(input.value, options);
	if (!resolved.ok) return resolved.fact;
	const productOffers = await fetchProductOffers(
		resolved.products,
		store,
		options,
	);
	if (!productOffers.ok) return productOffers.fact;
	const searches = resolved.products.map((product) =>
		resultForProduct(product, store, productOffers.offers),
	);
	return {
		type: "success",
		ownerId: PRODUCT_PRICE_OWNER_ID,
		toolName: PRODUCT_PRICE_TOOL_NAME,
		data: { searches },
		receipt: {
			provider: "whole-foods-product-pricing",
			queryCount: resolved.queryCount,
			sourceCount: searches.reduce(
				(total, search) => total + search.results.length,
				0,
			),
		},
	};
}

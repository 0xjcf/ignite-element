import type { NeutralToolCall } from "ignite-element/tools";
import type { CapabilityExecutionFact } from "../../src/capability-federation";
import {
	PRODUCT_PRICE_OWNER_ID,
	PRODUCT_PRICE_TOOL_NAME,
	readProductPriceInput,
} from "../../src/domains/product-pricing/price-capability";
import {
	asinFromWholeFoodsProductUrl,
	buildWholeFoodsDiscoveryQuery,
	buildWholeFoodsNativeSearchQuery,
	parseWholeFoodsNativeSearch,
	rankWholeFoodsCandidates,
	resolveWholeFoodsStorePolicy,
	scopeWholeFoodsProductUrl,
	WHOLE_FOODS_CANDIDATE_POLICY,
	WHOLE_FOODS_CANDIDATE_POLICY_CACHE_KEY,
	WHOLE_FOODS_CANDIDATE_POLICY_VERSION,
	type WholeFoodsNativeSearchCandidate,
	type WholeFoodsSelectedCandidate,
	type WholeFoodsStorePolicy,
} from "../../src/domains/product-pricing/providers/whole-foods";
import {
	type BraveWebSearchOptions,
	runBraveWebSearch,
} from "../brave-web-search";

type FetchLike = (
	input: RequestInfo | URL,
	init?: RequestInit,
) => Promise<Response>;

type DiscoveryReceipt = {
	cache: "hit" | "miss" | "coalesced";
	native:
		| "hit"
		| "miss"
		| "schema-drift"
		| "transport-error"
		| "coalesced"
		| "not-needed";
	brave:
		| "not-needed"
		| "not-configured"
		| "not-eligible"
		| "attempted-success"
		| "attempted-miss"
		| "attempted-failure"
		| "coalesced";
};

type IdentityOutcome =
	| {
			kind: "selected";
			identity: WholeFoodsSelectedCandidate;
			receipt: DiscoveryReceipt;
			queryCount: number;
	  }
	| {
			kind: "unverified";
			reason: string;
			receipt: DiscoveryReceipt;
			queryCount: number;
	  };

type CacheEntry = {
	identity: WholeFoodsSelectedCandidate;
	expiresAt: number;
};

export type WholeFoodsProductPricingState = {
	selectedIdentities: Map<string, CacheEntry>;
	inFlight: Map<string, Promise<IdentityOutcome>>;
	now: () => number;
	ttlMs: number;
	maxEntries: number;
};

export type WholeFoodsProductPricingOptions = {
	apiKey?: string;
	fetch?: FetchLike;
	timeoutMs?: number;
	brave?: Omit<BraveWebSearchOptions, "apiKey" | "fetch" | "maxRetries">;
	state?: WholeFoodsProductPricingState;
};

type ProductRecord = {
	asin: string;
	name: string;
	availability: string;
	price: number | null;
	currency: string | null;
};

type NativeDiscovery =
	| {
			kind: "candidates";
			candidates: WholeFoodsNativeSearchCandidate[];
			receipt: DiscoveryReceipt;
			queryCount: number;
	  }
	| Extract<IdentityOutcome, { kind: "unverified" }>;

type OwnedPlan = {
	kind: "owned";
	key: string;
	subject: string;
	query: string;
	promise: Promise<IdentityOutcome>;
	resolve: (outcome: IdentityOutcome) => void;
	discovery?: NativeDiscovery;
	outcome?: IdentityOutcome;
};

type PricingPlan =
	| OwnedPlan
	| {
			kind: "cached";
			key: string;
			subject: string;
			query: string;
			outcome: IdentityOutcome;
	  }
	| {
			kind: "coalesced";
			key: string;
			subject: string;
			query: string;
			promise: Promise<IdentityOutcome>;
			outcome?: IdentityOutcome;
	  };

export const WHOLE_FOODS_DISCOVERY_CACHE_TTL_MS = 300_000;
export const WHOLE_FOODS_DISCOVERY_CACHE_MAX_ENTRIES = 64;

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_OFFER_RECORDS = 64;

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

export const createWholeFoodsProductPricingState = (
	options: { now?: () => number; ttlMs?: number; maxEntries?: number } = {},
): WholeFoodsProductPricingState => ({
	selectedIdentities: new Map(),
	inFlight: new Map(),
	now: options.now ?? Date.now,
	ttlMs: options.ttlMs ?? WHOLE_FOODS_DISCOVERY_CACHE_TTL_MS,
	maxEntries: options.maxEntries ?? WHOLE_FOODS_DISCOVERY_CACHE_MAX_ENTRIES,
});

const normalizedIdentity = (value: string): string =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "");

const discoveryKey = (
	store: WholeFoodsStorePolicy,
	subject: string,
	query: string,
): string =>
	JSON.stringify([
		store.storeId,
		normalizedIdentity(subject),
		normalizedIdentity(query),
		WHOLE_FOODS_CANDIDATE_POLICY_CACHE_KEY,
	]);

const pruneExpired = (state: WholeFoodsProductPricingState): void => {
	const now = state.now();
	for (const [key, entry] of state.selectedIdentities) {
		if (entry.expiresAt <= now) state.selectedIdentities.delete(key);
	}
};

const readCachedIdentity = (
	state: WholeFoodsProductPricingState,
	key: string,
): WholeFoodsSelectedCandidate | null => {
	pruneExpired(state);
	const entry = state.selectedIdentities.get(key);
	if (!entry) return null;
	state.selectedIdentities.delete(key);
	state.selectedIdentities.set(key, entry);
	return entry.identity;
};

const writeCachedIdentity = (
	state: WholeFoodsProductPricingState,
	key: string,
	identity: WholeFoodsSelectedCandidate,
): void => {
	pruneExpired(state);
	state.selectedIdentities.delete(key);
	state.selectedIdentities.set(key, {
		identity,
		expiresAt: state.now() + state.ttlMs,
	});
	while (state.selectedIdentities.size > state.maxEntries) {
		const oldest = state.selectedIdentities.keys().next().value;
		if (typeof oldest !== "string") break;
		state.selectedIdentities.delete(oldest);
	}
};

const deferredIdentity = (): {
	promise: Promise<IdentityOutcome>;
	resolve: (outcome: IdentityOutcome) => void;
} => {
	let resolve!: (outcome: IdentityOutcome) => void;
	const promise = new Promise<IdentityOutcome>((settle) => {
		resolve = settle;
	});
	return { promise, resolve };
};

const nativeSearchEndpoint = (
	store: WholeFoodsStorePolicy,
	query: string,
): URL => {
	const endpoint = new URL(
		"https://www.wholefoodsmarket.com/api/wwos/rsi/search",
	);
	endpoint.searchParams.set("text", query);
	endpoint.searchParams.set("old", store.offerListingDiscriminator);
	endpoint.searchParams.set("offset", "0");
	endpoint.searchParams.set(
		"size",
		String(WHOLE_FOODS_CANDIDATE_POLICY.maxCandidates),
	);
	endpoint.searchParams.set("sort", "relevanceblender");
	endpoint.searchParams.set("programType", "GROCERY");
	endpoint.searchParams.set("filters", "");
	return endpoint;
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

const readResponsePayload = async (
	response: Response,
): Promise<{ ok: true; value: unknown } | { ok: false }> => {
	const contentLength = Number(response.headers.get("content-length"));
	if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
		return { ok: false };
	}
	const body = await response.text();
	if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) {
		return { ok: false };
	}
	try {
		return { ok: true, value: JSON.parse(body) };
	} catch {
		return { ok: false };
	}
};

const withTimeout = async (
	url: URL,
	options: WholeFoodsProductPricingOptions,
): Promise<
	{ ok: true; response: Response } | { ok: false; reason: "transport-error" }
> => {
	const fetcher = options.fetch ?? globalThis.fetch;
	if (typeof fetcher !== "function")
		return { ok: false, reason: "transport-error" };
	const controller = new AbortController();
	const timeout = setTimeout(
		() => controller.abort(),
		options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
	);
	try {
		return {
			ok: true,
			response: await fetcher(url, { signal: controller.signal }),
		};
	} catch {
		return { ok: false, reason: "transport-error" };
	} finally {
		clearTimeout(timeout);
		controller.abort();
	}
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

const discoverNatively = async (
	subject: string,
	query: string,
	store: WholeFoodsStorePolicy,
	options: WholeFoodsProductPricingOptions,
): Promise<NativeDiscovery> => {
	const native = await withTimeout(nativeSearchEndpoint(store, query), options);
	if (!native.ok || !native.response.ok) {
		return {
			kind: "unverified",
			reason: "Retailer-native discovery could not be reached.",
			receipt: {
				cache: "miss",
				native: "transport-error",
				brave: "not-eligible",
			},
			queryCount: 1,
		};
	}
	const payload = await readResponsePayload(native.response);
	const decoded = payload.ok
		? parseWholeFoodsNativeSearch(payload.value)
		: null;
	if (!decoded || !decoded.ok) {
		return {
			kind: "unverified",
			reason:
				"Retailer-native discovery returned an unsupported response shape.",
			receipt: { cache: "miss", native: "schema-drift", brave: "not-eligible" },
			queryCount: 1,
		};
	}
	if (decoded.candidates.length > 0) {
		return {
			kind: "candidates",
			candidates: decoded.candidates,
			receipt: { cache: "miss", native: "hit", brave: "not-needed" },
			queryCount: 1,
		};
	}
	if (!options.apiKey?.trim()) {
		return {
			kind: "unverified",
			reason:
				"Retailer-native discovery returned no candidate and Brave is not configured.",
			receipt: { cache: "miss", native: "miss", brave: "not-configured" },
			queryCount: 1,
		};
	}
	const discovery = await runBraveWebSearch(
		{
			name: "searchWeb",
			input: {
				queries: [{ subject, query: buildWholeFoodsDiscoveryQuery(subject) }],
				countPerQuery: 5,
				country: store.country,
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
			kind: "unverified",
			reason: "The clean retailer-native miss could not be resolved by Brave.",
			receipt: { cache: "miss", native: "miss", brave: "attempted-failure" },
			queryCount: 2,
		};
	}
	const url = discoveredProductUrl(discovery);
	const asin = url ? asinFromWholeFoodsProductUrl(url) : null;
	if (!asin) {
		return {
			kind: "unverified",
			reason: "Brave returned no official Whole Foods product candidate.",
			receipt: { cache: "miss", native: "miss", brave: "attempted-miss" },
			queryCount: 2,
		};
	}
	return {
		kind: "candidates",
		candidates: [{ asin, searchRank: 0 }],
		receipt: { cache: "miss", native: "miss", brave: "attempted-success" },
		queryCount: 2,
	};
};

export const parseWholeFoodsProductOffers = (
	value: unknown,
	allowedAsins: ReadonlySet<string>,
): ReadonlyMap<string, ProductRecord> | null => {
	if (!Array.isArray(value) || value.length > MAX_OFFER_RECORDS) return null;
	const products = new Map<string, ProductRecord>();
	for (const candidate of value) {
		if (
			!isRecord(candidate) ||
			typeof candidate.asin !== "string" ||
			typeof candidate.name !== "string" ||
			candidate.programType !== "GROCERY"
		) {
			continue;
		}
		const asin = candidate.asin.trim().toUpperCase();
		if (!allowedAsins.has(asin)) continue;
		const rawPrice =
			isRecord(candidate.offerDetails) && isRecord(candidate.offerDetails.price)
				? candidate.offerDetails.price
				: null;
		const amount = rawPrice?.priceAmount;
		const currency = rawPrice?.currencyCode;
		const validPrice =
			typeof amount === "number" &&
			Number.isFinite(amount) &&
			amount > 0 &&
			amount <= 10_000 &&
			currency === "USD";
		products.set(asin, {
			asin,
			name: candidate.name.trim(),
			availability:
				typeof candidate.availability === "string"
					? candidate.availability
					: "UNKNOWN",
			price: validPrice ? amount : null,
			currency: typeof currency === "string" ? currency : null,
		});
	}
	return products;
};

const fetchProductRecords = async (
	asins: readonly string[],
	store: WholeFoodsStorePolicy,
	options: WholeFoodsProductPricingOptions,
): Promise<ReadonlyMap<string, ProductRecord> | null> => {
	if (asins.length === 0) return new Map();
	const response = await withTimeout(
		productDetailsEndpoint(store, asins),
		options,
	);
	if (!response.ok || !response.response.ok) return null;
	const payload = await readResponsePayload(response.response);
	return payload.ok
		? parseWholeFoodsProductOffers(payload.value, new Set(asins))
		: null;
};

const settleOwned = (
	plan: OwnedPlan,
	outcome: IdentityOutcome,
	state: WholeFoodsProductPricingState,
): void => {
	plan.outcome = outcome;
	if (outcome.kind === "selected") {
		writeCachedIdentity(state, plan.key, outcome.identity);
	}
	plan.resolve(outcome);
	if (state.inFlight.get(plan.key) === plan.promise) {
		state.inFlight.delete(plan.key);
	}
};

const unverifiedPrice = (reason: string, sourceUrl: string | null) => ({
	status: "unverified" as const,
	amount: null,
	sourceUrl,
	reason,
});

const resultForPlan = (
	plan: PricingPlan,
	products: ReadonlyMap<string, ProductRecord>,
	store: WholeFoodsStorePolicy,
) => {
	const outcome = plan.outcome;
	if (!outcome || outcome.kind === "unverified") {
		const reason =
			outcome?.kind === "unverified"
				? outcome.reason
				: "Product identity discovery did not complete.";
		return {
			subject: plan.subject,
			query: plan.query,
			price: unverifiedPrice(reason, null),
			results: [],
			receipt:
				outcome?.receipt ??
				({
					cache: "miss",
					native: "transport-error",
					brave: "not-eligible",
				} as const),
		};
	}
	const { identity } = outcome;
	const product = products.get(identity.asin);
	const sourceUrl = scopeWholeFoodsProductUrl(
		identity.productUrl,
		store.storeId,
	);
	const sourced =
		product?.availability === "IN_STOCK" &&
		product.currency === "USD" &&
		product.price !== null &&
		sourceUrl !== null;
	return {
		subject: plan.subject,
		query: plan.query,
		selection: {
			asin: identity.asin,
			product: identity.product,
			size: identity.size,
			rankingPolicy: WHOLE_FOODS_CANDIDATE_POLICY_VERSION,
		},
		price: sourced
			? {
					status: "sourced" as const,
					amount: product.price,
					display: `$${product.price?.toFixed(2)}`,
					sourceUrl,
				}
			: unverifiedPrice(
					"The selected product has no matching current in-stock USD offer.",
					sourceUrl,
				),
		results: sourceUrl
			? [
					{
						title: product?.name ?? identity.name,
						url: sourceUrl,
						description: sourced
							? `Official ${store.storeName} listed price: $${product.price?.toFixed(2)}.`
							: `Official ${store.storeName} product selection; current price is unverified.`,
					},
				]
			: [],
		receipt: outcome.receipt,
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
	const state = options.state ?? createWholeFoodsProductPricingState();
	const plans: PricingPlan[] = input.value.items.map((item) => {
		const query = buildWholeFoodsNativeSearchQuery(item.subject);
		const key = discoveryKey(store, item.subject, query);
		const cached = readCachedIdentity(state, key);
		if (cached) {
			return {
				kind: "cached",
				key,
				subject: item.subject,
				query,
				outcome: {
					kind: "selected",
					identity: cached,
					receipt: { cache: "hit", native: "not-needed", brave: "not-needed" },
					queryCount: 0,
				},
			};
		}
		const existing = state.inFlight.get(key);
		if (existing) {
			return {
				kind: "coalesced",
				key,
				subject: item.subject,
				query,
				promise: existing,
			};
		}
		const deferred = deferredIdentity();
		state.inFlight.set(key, deferred.promise);
		return {
			kind: "owned",
			key,
			subject: item.subject,
			query,
			promise: deferred.promise,
			resolve: deferred.resolve,
		};
	});

	await Promise.all(
		plans.map(async (plan) => {
			if (plan.kind !== "coalesced") return;
			const outcome = await plan.promise;
			plan.outcome =
				outcome.kind === "selected"
					? {
							...outcome,
							receipt: {
								cache: "coalesced",
								native: "coalesced",
								brave: "coalesced",
							},
							queryCount: 0,
						}
					: {
							...outcome,
							receipt: {
								cache: "coalesced",
								native: "coalesced",
								brave: "coalesced",
							},
							queryCount: 0,
						};
		}),
	);

	const owned = plans.filter(
		(plan): plan is OwnedPlan => plan.kind === "owned",
	);
	await Promise.all(
		owned.map(async (plan) => {
			plan.discovery = await discoverNatively(
				plan.subject,
				plan.query,
				store,
				options,
			);
		}),
	);

	const asins = new Set<string>();
	for (const plan of plans) {
		if (plan.kind !== "owned" && plan.outcome?.kind === "selected") {
			asins.add(plan.outcome.identity.asin);
		}
		if (plan.kind === "owned" && plan.discovery?.kind === "candidates") {
			for (const candidate of plan.discovery.candidates)
				asins.add(candidate.asin);
		}
	}
	const products = await fetchProductRecords([...asins], store, options);

	for (const plan of owned) {
		const discovery = plan.discovery;
		if (!discovery || discovery.kind === "unverified") {
			settleOwned(
				plan,
				discovery ?? {
					kind: "unverified",
					reason: "Retailer-native discovery did not complete.",
					receipt: {
						cache: "miss",
						native: "transport-error",
						brave: "not-eligible",
					},
					queryCount: 0,
				},
				state,
			);
			continue;
		}
		if (!products) {
			settleOwned(
				plan,
				{
					kind: "unverified",
					reason: "Whole Foods offer details could not be decoded.",
					receipt: discovery.receipt,
					queryCount: discovery.queryCount,
				},
				state,
			);
			continue;
		}
		const selection = rankWholeFoodsCandidates(
			plan.subject,
			discovery.candidates.flatMap((candidate) => {
				const product = products.get(candidate.asin);
				return product ? [{ ...candidate, name: product.name }] : [];
			}),
		);
		if (selection.outcome === "selected") {
			settleOwned(
				plan,
				{
					kind: "selected",
					identity: selection.candidate,
					receipt: discovery.receipt,
					queryCount: discovery.queryCount,
				},
				state,
			);
		} else {
			settleOwned(
				plan,
				{
					kind: "unverified",
					reason:
						selection.outcome === "ambiguous"
							? "Retailer-native candidate selection is ambiguous."
							: "Retailer-native discovery returned no compatible product identity.",
					receipt: discovery.receipt,
					queryCount: discovery.queryCount,
				},
				state,
			);
		}
	}

	const productMap = products ?? new Map<string, ProductRecord>();
	const searches = plans.map((plan) => resultForPlan(plan, productMap, store));
	const cacheStatuses = searches.map((search) => search.receipt.cache);
	const cacheStatus = cacheStatuses.includes("miss")
		? "miss"
		: cacheStatuses.includes("coalesced")
			? "coalesced"
			: "hit";
	return {
		type: "success",
		ownerId: PRODUCT_PRICE_OWNER_ID,
		toolName: PRODUCT_PRICE_TOOL_NAME,
		data: { searches },
		receipt: {
			provider: "whole-foods-product-pricing",
			queryCount: plans.reduce(
				(total, plan) => total + (plan.outcome?.queryCount ?? 0),
				0,
			),
			sourceCount: searches.filter(
				(search) => search.price.status === "sourced",
			).length,
			cache: { status: cacheStatus, ttlMs: state.ttlMs },
		},
	};
}

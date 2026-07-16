import type { NeutralToolCall } from "ignite-element/tools";
import type { CapabilityExecutionFact } from "../../src/capability-federation";
import { PRODUCT_PRICING_MAX_ITEMS } from "../../src/domains/product-pricing/policy";
import {
	PRODUCT_PRICE_OWNER_ID,
	PRODUCT_PRICE_TOOL_NAME,
	type ProductPriceReasonCode,
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
			reasonCode: ProductPriceReasonCode;
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
export const WHOLE_FOODS_MAX_OFFER_RECORDS =
	PRODUCT_PRICING_MAX_ITEMS * WHOLE_FOODS_CANDIDATE_POLICY.maxCandidates;

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 1_000_000;

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

type BoundedJsonResponse =
	| { ok: true; value: unknown }
	| { ok: false; reason: "transport-error" | "schema-drift" };

const fetchBoundedJson = async (
	url: URL,
	options: WholeFoodsProductPricingOptions,
): Promise<BoundedJsonResponse> => {
	const fetcher = options.fetch ?? globalThis.fetch;
	if (typeof fetcher !== "function")
		return { ok: false, reason: "transport-error" };
	const controller = new AbortController();
	let timeout: ReturnType<typeof setTimeout> | undefined;
	const deadline = new Promise<{ kind: "deadline" }>((resolve) => {
		timeout = setTimeout(() => {
			controller.abort();
			resolve({ kind: "deadline" });
		}, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
	});
	try {
		const fetched = await Promise.race([
			Promise.resolve()
				.then(() => fetcher(url, { signal: controller.signal }))
				.then(
					(response) => ({ kind: "response" as const, response }),
					() => ({ kind: "transport-error" as const }),
				),
			deadline,
		]);
		if (fetched.kind !== "response" || !fetched.response.ok) {
			return { ok: false, reason: "transport-error" };
		}
		const contentLength = Number(
			fetched.response.headers.get("content-length"),
		);
		if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
			return { ok: false, reason: "schema-drift" };
		}
		const consumed = await Promise.race([
			Promise.resolve()
				.then(() => fetched.response.text())
				.then(
					(body) => ({ kind: "body" as const, body }),
					() => ({ kind: "transport-error" as const }),
				),
			deadline,
		]);
		if (consumed.kind !== "body") {
			return { ok: false, reason: "transport-error" };
		}
		if (Buffer.byteLength(consumed.body, "utf8") > MAX_RESPONSE_BYTES) {
			return { ok: false, reason: "schema-drift" };
		}
		try {
			return { ok: true, value: JSON.parse(consumed.body) };
		} catch {
			return { ok: false, reason: "schema-drift" };
		}
	} finally {
		if (timeout !== undefined) clearTimeout(timeout);
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
	const native = await fetchBoundedJson(
		nativeSearchEndpoint(store, query),
		options,
	);
	if (!native.ok) {
		return {
			kind: "unverified",
			reasonCode:
				native.reason === "transport-error"
					? "provider-unavailable"
					: "provider-response-invalid",
			reason:
				native.reason === "transport-error"
					? "Retailer-native discovery could not be reached."
					: "Retailer-native discovery returned an unsupported response shape.",
			receipt: {
				cache: "miss",
				native: native.reason,
				brave: "not-eligible",
			},
			queryCount: 1,
		};
	}
	const decoded = parseWholeFoodsNativeSearch(native.value);
	if (!decoded.ok) {
		return {
			kind: "unverified",
			reasonCode: "provider-response-invalid",
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
			reasonCode: "product-not-found",
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
			reasonCode: "provider-unavailable",
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
			reasonCode: "product-not-found",
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
	if (!Array.isArray(value) || value.length > WHOLE_FOODS_MAX_OFFER_RECORDS)
		return null;
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
	if (asins.length > WHOLE_FOODS_MAX_OFFER_RECORDS) return null;
	const response = await fetchBoundedJson(
		productDetailsEndpoint(store, asins),
		options,
	);
	return response.ok
		? parseWholeFoodsProductOffers(response.value, new Set(asins))
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

const unresolvedOwnedOutcome = (plan: OwnedPlan): IdentityOutcome => {
	const discovery = plan.discovery;
	if (discovery?.kind === "unverified") return discovery;
	if (discovery?.kind === "candidates") {
		return {
			kind: "unverified",
			reasonCode: "provider-response-invalid",
			reason: "Whole Foods offer details could not be decoded.",
			receipt: discovery.receipt,
			queryCount: discovery.queryCount,
		};
	}
	return {
		kind: "unverified",
		reasonCode: "provider-unavailable",
		reason: "Retailer-native discovery did not complete.",
		receipt: {
			cache: "miss",
			native: "transport-error",
			brave: "not-eligible",
		},
		queryCount: 0,
	};
};

const unverifiedPrice = (
	reasonCode: ProductPriceReasonCode,
	reason: string,
	sourceUrl: string | null,
) => ({
	status: "unverified" as const,
	amount: null,
	sourceUrl,
	reasonCode,
	reason,
});

const resultForPlan = (
	plan: PricingPlan,
	products: ReadonlyMap<string, ProductRecord>,
	store: WholeFoodsStorePolicy,
) => {
	const outcome = plan.outcome;
	if (!outcome || outcome.kind === "unverified") {
		const reasonCode =
			outcome?.kind === "unverified"
				? outcome.reasonCode
				: "provider-unavailable";
		const reason =
			outcome?.kind === "unverified"
				? outcome.reason
				: "Product identity discovery did not complete.";
		return {
			subject: plan.subject,
			query: plan.query,
			price: unverifiedPrice(reasonCode, reason, null),
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
					"offer-unavailable",
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
	const owned = plans.filter(
		(plan): plan is OwnedPlan => plan.kind === "owned",
	);
	let products: ReadonlyMap<string, ProductRecord> | null = null;

	try {
		await Promise.all(
			plans.map(async (plan) => {
				if (plan.kind !== "coalesced") return;
				const outcome = await plan.promise;
				plan.outcome = {
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
		products = await fetchProductRecords([...asins], store, options);

		for (const plan of owned) {
			const discovery = plan.discovery;
			if (!discovery || discovery.kind === "unverified" || !products) {
				settleOwned(plan, unresolvedOwnedOutcome(plan), state);
				continue;
			}
			const selection = rankWholeFoodsCandidates(
				plan.subject,
				discovery.candidates.flatMap((candidate) => {
					const product = products?.get(candidate.asin);
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
						reasonCode:
							selection.outcome === "ambiguous"
								? "candidate-ambiguous"
								: "candidate-low-confidence",
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
	} catch {
		products = null;
	} finally {
		for (const plan of owned) {
			if (!plan.outcome) settleOwned(plan, unresolvedOwnedOutcome(plan), state);
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

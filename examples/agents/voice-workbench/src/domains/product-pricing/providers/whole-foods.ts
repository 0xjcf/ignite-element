export type WholeFoodsStorePolicy = {
	retailer: "Whole Foods Market";
	storeId: string;
	storeName: string;
	offerListingDiscriminator: string;
	country: "us";
};

export type WholeFoodsNativeSearchCandidate = {
	asin: string;
	searchRank: number;
};

export type WholeFoodsCandidate = WholeFoodsNativeSearchCandidate & {
	name: string;
};

export type WholeFoodsSelectedCandidate = WholeFoodsCandidate & {
	product: string;
	size: string;
	productUrl: string;
};

export type WholeFoodsCandidateSelection =
	| {
			outcome: "selected";
			policyVersion: typeof WHOLE_FOODS_CANDIDATE_POLICY_VERSION;
			candidate: WholeFoodsSelectedCandidate;
			score: number;
			margin: number | null;
	  }
	| {
			outcome: "ambiguous";
			policyVersion: typeof WHOLE_FOODS_CANDIDATE_POLICY_VERSION;
			candidateAsins: string[];
			margin: number;
	  }
	| {
			outcome: "miss";
			policyVersion: typeof WHOLE_FOODS_CANDIDATE_POLICY_VERSION;
			reason: "no-candidates" | "low-confidence";
	  };

export const WHOLE_FOODS_SARASOTA: WholeFoodsStorePolicy = Object.freeze({
	retailer: "Whole Foods Market",
	storeId: "10189",
	storeName: "Sarasota",
	offerListingDiscriminator: "A0H6",
	country: "us",
});

export const WHOLE_FOODS_CANDIDATE_POLICY_VERSION =
	"whole-foods-candidate-v1" as const;

const MAX_NATIVE_SEARCH_RESULTS = 8;
const MIN_CANDIDATE_SCORE = 140;
const MIN_CANDIDATE_MARGIN = 15;
const ASIN = /^[A-Z0-9]{10}$/;
const ASIN_IN_PATH = /(?:^|[-/])([a-z0-9]{10})(?:$|[/?#])/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const compactIdentity = (value: string): string =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "");

const normalizedWords = (value: string): string[] =>
	value
		.trim()
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter(Boolean)
		.map((word) =>
			word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word,
		);

const quotedQueryValue = (value: string): string =>
	`"${value
		.trim()
		.replace(/["\\]+/g, " ")
		.replace(/\s+/g, " ")}"`;

const productIdentity = (
	name: string,
): { product: string; size: string } | null => {
	const comma = name.lastIndexOf(",");
	if (comma < 1) return null;
	const product = name.slice(0, comma).trim();
	const size = name.slice(comma + 1).trim();
	if (
		!product ||
		!/^\d+(?:\.\d+)?\s*(?:fl\s*oz|fluid\s+ounces?|gallons?|gal|ounces?|oz|pounds?|lbs?|counts?|ct|each|pack)\b/i.test(
			size,
		)
	) {
		return null;
	}
	return { product, size };
};

export const resolveWholeFoodsStorePolicy = (
	retailer: string,
	location: string,
): WholeFoodsStorePolicy | null => {
	const retailerKey = compactIdentity(retailer);
	const locationKey = compactIdentity(location);
	const retailerMatches =
		retailerKey === "wholefoods" || retailerKey === "wholefoodsmarket";
	const locationMatches = [
		"sarasota",
		"sarasotafl",
		"sarasotaflorida",
	].includes(locationKey);
	return retailerMatches && locationMatches ? WHOLE_FOODS_SARASOTA : null;
};

/**
 * Transitional compatibility for the server shell while it moves to native
 * discovery in the next implementation slice. No catalog data is retained.
 */
export const parseWholeFoodsNativeSearch = (
	value: unknown,
):
	| { ok: true; candidates: WholeFoodsNativeSearchCandidate[] }
	| { ok: false; reason: "schema-drift" } => {
	if (!isRecord(value) || !isRecord(value.mainResultSet)) {
		return { ok: false, reason: "schema-drift" };
	}
	const results = value.mainResultSet.searchResults;
	if (!Array.isArray(results) || results.length > MAX_NATIVE_SEARCH_RESULTS) {
		return { ok: false, reason: "schema-drift" };
	}
	const candidates: WholeFoodsNativeSearchCandidate[] = [];
	const seen = new Set<string>();
	for (const [searchRank, result] of results.entries()) {
		if (!isRecord(result) || typeof result.asin !== "string") {
			return { ok: false, reason: "schema-drift" };
		}
		const asin = result.asin.trim().toUpperCase();
		if (!ASIN.test(asin)) return { ok: false, reason: "schema-drift" };
		if (seen.has(asin)) continue;
		seen.add(asin);
		candidates.push({ asin, searchRank });
	}
	return { ok: true, candidates };
};

const scoreCandidate = (subject: string, candidate: WholeFoodsCandidate) => {
	const subjectWords = normalizedWords(subject);
	const candidateWords = normalizedWords(candidate.name);
	const candidateSet = new Set(candidateWords);
	const matched = subjectWords.filter((word) => candidateSet.has(word)).length;
	const coverage =
		subjectWords.length === 0 ? 0 : matched / subjectWords.length;
	const phrase = subjectWords.join(" ");
	const phraseMatch = candidateWords.join(" ").includes(phrase);
	const score =
		Math.round(coverage * 100) +
		(phraseMatch ? 40 : 0) +
		Math.max(0, MAX_NATIVE_SEARCH_RESULTS - candidate.searchRank) * 12;
	return { candidate, score };
};

export const rankWholeFoodsCandidates = (
	subject: string,
	candidates: readonly WholeFoodsCandidate[],
): WholeFoodsCandidateSelection => {
	const ranked = candidates
		.filter(
			(candidate) =>
				ASIN.test(candidate.asin) &&
				candidate.searchRank >= 0 &&
				candidate.searchRank < MAX_NATIVE_SEARCH_RESULTS &&
				productIdentity(candidate.name) !== null,
		)
		.map((candidate) => scoreCandidate(subject, candidate))
		.sort(
			(left, right) =>
				right.score - left.score ||
				left.candidate.searchRank - right.candidate.searchRank ||
				left.candidate.asin.localeCompare(right.candidate.asin),
		);
	const top = ranked[0];
	if (!top) {
		return {
			outcome: "miss",
			policyVersion: WHOLE_FOODS_CANDIDATE_POLICY_VERSION,
			reason: "no-candidates",
		};
	}
	if (top.score < MIN_CANDIDATE_SCORE) {
		return {
			outcome: "miss",
			policyVersion: WHOLE_FOODS_CANDIDATE_POLICY_VERSION,
			reason: "low-confidence",
		};
	}
	const runnerUp = ranked[1];
	const margin = runnerUp ? top.score - runnerUp.score : null;
	if (margin !== null && margin < MIN_CANDIDATE_MARGIN) {
		return {
			outcome: "ambiguous",
			policyVersion: WHOLE_FOODS_CANDIDATE_POLICY_VERSION,
			candidateAsins: ranked
				.filter((entry) => top.score - entry.score < MIN_CANDIDATE_MARGIN)
				.map((entry) => entry.candidate.asin),
			margin,
		};
	}
	const identity = productIdentity(top.candidate.name);
	if (!identity) {
		return {
			outcome: "miss",
			policyVersion: WHOLE_FOODS_CANDIDATE_POLICY_VERSION,
			reason: "low-confidence",
		};
	}
	return {
		outcome: "selected",
		policyVersion: WHOLE_FOODS_CANDIDATE_POLICY_VERSION,
		candidate: {
			...top.candidate,
			...identity,
			productUrl: wholeFoodsProductUrl(top.candidate.asin),
		},
		score: top.score,
		margin,
	};
};

export const buildWholeFoodsNativeSearchQuery = (subject: string): string =>
	subject.trim().replace(/\s+/g, " ");

export const buildWholeFoodsDiscoveryQuery = (subject: string): string =>
	[
		"site:wholefoodsmarket.com",
		quotedQueryValue(buildWholeFoodsNativeSearchQuery(subject)),
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

export const asinFromWholeFoodsProductUrl = (value: string): string | null => {
	if (!isWholeFoodsProductUrl(value)) return null;
	const asin = new URL(value).pathname.match(ASIN_IN_PATH)?.[1];
	return asin ? asin.toUpperCase() : null;
};

export const wholeFoodsProductUrl = (asin: string): string =>
	`https://www.wholefoodsmarket.com/product/${asin.toLowerCase()}`;

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

import { NOT_FOUND, type RouteDef, type RouteName, routes } from "./routes";

// A pure path matcher — no History, no DOM, no framework. Turning a pathname
// into a matched route + params is a deterministic function, which is exactly
// why the router's core can be tested headlessly (see matchRoute.test.ts) and
// why History I/O lives in the shell, not here.

export type RouteParams = Record<string, string>;

export type RouteMatch = {
	name: RouteName;
	params: RouteParams;
	/** The normalized pathname that matched (no trailing slash except root). */
	path: string;
};

const normalize = (pathname: string): string => {
	const [withoutQuery] = pathname.split("?");
	const [clean] = withoutQuery.split("#");
	if (clean.length > 1 && clean.endsWith("/")) {
		return clean.slice(0, -1);
	}
	return clean || "/";
};

const matchOne = (def: RouteDef, segments: string[]): RouteParams | null => {
	const patternSegments = def.path.split("/").filter(Boolean);
	if (patternSegments.length !== segments.length) {
		return null;
	}

	const params: RouteParams = {};
	for (let i = 0; i < patternSegments.length; i += 1) {
		const pattern = patternSegments[i];
		const actual = segments[i];
		if (pattern.startsWith(":")) {
			params[pattern.slice(1)] = decodeURIComponent(actual);
		} else if (pattern !== actual) {
			return null;
		}
	}
	return params;
};

/**
 * Match a pathname against the route table. Returns the first matching route
 * with its captured params, or a `not-found` match when nothing matches.
 */
export const matchRoute = (pathname: string): RouteMatch => {
	const path = normalize(pathname);
	const segments = path.split("/").filter(Boolean);

	for (const def of routes) {
		const params = matchOne(def, segments);
		if (params) {
			return { name: def.name, params, path };
		}
	}

	return { name: NOT_FOUND, params: {}, path };
};

import routes from "./route-map.json" with { type: "json" };
/** @type {Record<string, string>} */
const redirects = routes.redirects;
/** @type {Record<string, string>} */
const counterparts = routes.counterparts;
/** @param {string} route */
export function currentRoute(route) {
	return redirects[route] ?? route;
}
/** @param {string} route @param {boolean} archive */
export function versionDestination(route, archive) {
	const plain = route.replace(/^2\.x(?:\/|$)/, "");
	const current = currentRoute(plain);
	if (!archive) return current;
	return (
		counterparts[current] ??
		(routes.archive.includes(`2.x/${plain}`) ? `2.x/${plain}` : "2.x")
	);
}
/** @param {string} route */
export function routeUrl(route) {
	return `/ignite-element/${route ? `${route}/` : ""}`;
}

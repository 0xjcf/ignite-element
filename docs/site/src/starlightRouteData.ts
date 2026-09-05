// Starlight route-data middleware. The frozen 2.x archive keeps the stable
// cyan favicon while current (v3 beta) pages use the green one configured in
// astro.config.mjs — matching the per-version accent ramp and logo (see
// styles/theme.css and components/SiteTitle.astro).
// DELETE this middleware (and the -stable favicon) at stable v3.
import { defineRouteMiddleware } from "@astrojs/starlight/route-data";

export const onRequest = defineRouteMiddleware((context) => {
	const base = import.meta.env.BASE_URL.replace(/\/$/, "");
	if (!context.url.pathname.startsWith(`${base}/2.x/`)) return;

	for (const entry of context.locals.starlightRoute.head) {
		// Starlight emits the configured favicon as rel="shortcut icon".
		if (
			entry.tag === "link" &&
			(entry.attrs?.rel === "icon" || entry.attrs?.rel === "shortcut icon")
		) {
			entry.attrs.href = `${base}/ignite-element-favicon-stable.svg`;
		}
	}
});

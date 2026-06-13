// The route table — plain data, no framework imports. A route maps a URL
// pattern (with optional `:param` segments) to a logical name, and may require
// authentication. This is the single source of truth both the matcher and the
// router machine read from.

export type RouteName =
	| "home"
	| "about"
	| "users"
	| "user"
	| "login"
	| "dashboard"
	| "not-found";

export type RouteDef = {
	name: RouteName;
	/** Pattern like `/users/:id`. `:name` segments capture into params. */
	path: string;
	/** When true, navigating here while unauthenticated redirects to `/login`. */
	requiresAuth?: boolean;
};

export const routes: readonly RouteDef[] = [
	{ name: "home", path: "/" },
	{ name: "about", path: "/about" },
	{ name: "users", path: "/users" },
	{ name: "user", path: "/users/:id" },
	{ name: "login", path: "/login" },
	{ name: "dashboard", path: "/dashboard", requiresAuth: true },
];

export const NOT_FOUND: RouteName = "not-found";
export const LOGIN_PATH = "/login";

import { assign, emit, setup } from "xstate";
import { matchRoute, type RouteParams } from "./matchRoute";
import { LOGIN_PATH, type RouteName, routes } from "./routes";

// The router's functional core: an XState machine that holds the logical route
// state and computes the next route (including auth guards) as a pure function
// of the requested path. It never touches `window.history` or `location` — that
// I/O lives in the shell (history.ts) and the component's effect. Keeping the
// core pure is what makes navigation testable without a browser.

export type NavSource = "init" | "navigate" | "popstate";

export type RouterContext = {
	/** The effective pathname after guards (what the URL should show). */
	path: string;
	/** The matched (or guard-redirected) route name. */
	route: RouteName;
	params: RouteParams;
	authed: boolean;
	/** What drove the last transition — the History effect only writes for `navigate`. */
	source: NavSource;
	/** True when an auth guard rewrote the requested destination. */
	redirected: boolean;
};

export type RouterEvent =
	| { type: "NAVIGATE"; to: string }
	| { type: "POPSTATE"; path: string }
	| { type: "LOGIN" }
	| { type: "LOGOUT" };

// Emitted on every committed navigation. Surfaces through the headless runtime
// (`on('navigated')`, `execute().events`) via the adapter's subscribeEvents seam.
export type RouterEmitted = {
	type: "navigated";
	path: string;
	route: RouteName;
};

const requiresAuth = (name: RouteName): boolean =>
	routes.find((route) => route.name === name)?.requiresAuth ?? false;

type Resolved = Pick<RouterContext, "path" | "route" | "params" | "redirected">;

/**
 * Pure navigation resolution: match the path, then apply the auth guard. A
 * guarded route requested while unauthenticated resolves to `/login` instead.
 */
export const resolveNavigation = (
	toPath: string,
	authed: boolean,
): Resolved => {
	const match = matchRoute(toPath);
	if (requiresAuth(match.name) && !authed) {
		const login = matchRoute(LOGIN_PATH);
		return {
			path: login.path,
			route: login.name,
			params: login.params,
			redirected: true,
		};
	}
	return {
		path: match.path,
		route: match.name,
		params: match.params,
		redirected: false,
	};
};

export const createInitialContext = (
	initialPath = "/",
	authed = false,
): RouterContext => ({
	...resolveNavigation(initialPath, authed),
	authed,
	source: "init",
});

export const routerMachine = setup({
	types: {
		context: {} as RouterContext,
		events: {} as RouterEvent,
		emitted: {} as RouterEmitted,
		input: {} as { path?: string; authed?: boolean } | undefined,
	},
	actions: {
		applyNavigation: assign(
			({ context, event }, params: { source: NavSource }) => {
				const requested =
					event.type === "NAVIGATE"
						? event.to
						: event.type === "POPSTATE"
							? event.path
							: context.path;
				return {
					...resolveNavigation(requested, context.authed),
					source: params.source,
				};
			},
		),
		announceNavigation: emit(({ context }) => ({
			type: "navigated" as const,
			path: context.path,
			route: context.route,
		})),
	},
}).createMachine({
	context: ({ input }) =>
		createInitialContext(input?.path ?? "/", input?.authed ?? false),
	on: {
		NAVIGATE: {
			actions: [
				{ type: "applyNavigation", params: { source: "navigate" } },
				"announceNavigation",
			],
		},
		POPSTATE: {
			actions: [
				{ type: "applyNavigation", params: { source: "popstate" } },
				"announceNavigation",
			],
		},
		LOGIN: { actions: assign({ authed: true }) },
		LOGOUT: { actions: assign({ authed: false }) },
	},
});

import { assign, emit, fromCallback, setup } from "xstate";
import { matchRoute, type RouteParams } from "./matchRoute";
import { LOGIN_PATH, type RouteName, routes } from "./routes";

export type NavSource = "init" | "navigate" | "observed";

export type RouterContext = {
	path: string;
	route: RouteName;
	params: RouteParams;
	authed: boolean;
	source: NavSource;
	redirected: boolean;
	lastCommitError: string | null;
	requestedPath: string | null;
};

export type RouterEvent =
	| { type: "NAVIGATE_REQUESTED"; to: string }
	| { type: "NAVIGATION_OBSERVED"; path: string }
	| { type: "LOGIN" }
	| { type: "LOGOUT" }
	| { type: "NAVIGATION_COMMIT_FAILED"; path: string; message: string };

export type RouterEmitted = {
	type: "navigated";
	path: string;
	route: RouteName;
};

const requiresAuth = (name: RouteName): boolean =>
	routes.find((route) => route.name === name)?.requiresAuth ?? false;

type Resolved = Pick<RouterContext, "path" | "route" | "params" | "redirected">;

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
	lastCommitError: null,
	requestedPath: initialPath,
});

export const routerMachine = setup({
	types: {
		context: {} as RouterContext,
		events: {} as RouterEvent,
		emitted: {} as RouterEmitted,
		input: {} as { path?: string; authed?: boolean } | undefined,
	},
	actors: {
		observeNavigation: fromCallback<RouterEvent>(() => () => {}),
	},
	actions: {
		applyNavigation: assign(
			({ context, event }, params: { source: NavSource }) => {
				const requested =
					event.type === "NAVIGATE_REQUESTED"
						? event.to
						: event.type === "NAVIGATION_OBSERVED"
							? event.path
							: context.path;

				return {
					...resolveNavigation(requested, context.authed),
					source: params.source,
					lastCommitError: null,
					requestedPath: requested,
				};
			},
		),
		announceNavigation: emit(({ context }) => ({
			type: "navigated" as const,
			path: context.path,
			route: context.route,
		})),
		captureCommitFailure: assign(({ context, event }) =>
			event.type === "NAVIGATION_COMMIT_FAILED"
				? { ...context, lastCommitError: event.message }
				: context,
		),
		commitAcceptedNavigation: () => {},
	},
}).createMachine({
	context: ({ input }) =>
		createInitialContext(input?.path ?? "/", input?.authed ?? false),
	invoke: {
		id: "observeNavigation",
		src: "observeNavigation",
	},
	on: {
		NAVIGATE_REQUESTED: {
			actions: [
				{ type: "applyNavigation", params: { source: "navigate" } },
				"announceNavigation",
				{
					type: "commitAcceptedNavigation",
					params: ({
						context,
						event,
					}: {
						context: RouterContext;
						event: Extract<RouterEvent, { type: "NAVIGATE_REQUESTED" }>;
					}) => ({
						acceptedPath: resolveNavigation(event.to, context.authed).path,
						previousPath: context.path,
						requestedPath: event.to,
					}),
				},
			],
		},
		NAVIGATION_OBSERVED: {
			actions: [
				{ type: "applyNavigation", params: { source: "observed" } },
				"announceNavigation",
			],
		},
		LOGIN: { actions: assign({ authed: true }) },
		LOGOUT: { actions: assign({ authed: false }) },
		NAVIGATION_COMMIT_FAILED: { actions: "captureCommitFailure" },
	},
});

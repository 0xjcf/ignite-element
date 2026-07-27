import { createActor, fromCallback } from "xstate";
import type { NavigationHistoryMode, NavigationPort } from "./navigation";
import {
	type NestedRouteEvent,
	resolveNestedRoute,
	routerMachine,
} from "./routerMachine";

const toErrorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

export const createRouterSource = ({
	navigation,
}: {
	navigation: NavigationPort;
}) => {
	const source = createActor(
		routerMachine.provide({
			actors: {
				observeNavigation: fromCallback<NestedRouteEvent>(({ sendBack }) =>
					navigation.observe((path) =>
						sendBack({ type: "NAVIGATION_OBSERVED", path }),
					),
				),
			},
			actions: {
				commitAcceptedNavigation: ({ self }, params) => {
					const navigationParams = params as {
						acceptedPath: string;
						previousPath: string;
						requestedPath: string;
					};
					const currentAcceptedPath = resolveNestedRoute(
						navigation.currentPath(),
					).path;
					if (navigationParams.acceptedPath === currentAcceptedPath) {
						return;
					}

					const history: NavigationHistoryMode =
						navigationParams.acceptedPath === navigationParams.requestedPath
							? "push"
							: "replace";
					void navigation
						.commit(navigationParams.acceptedPath, history)
						.catch((error) => {
							self.send({
								type: "NAVIGATION_COMMIT_FAILED",
								path: navigationParams.acceptedPath,
								message: toErrorMessage(error),
							});
						});
				},
			},
		}),
		{
			input: {
				path: navigation.currentPath(),
			},
		},
	);

	return source.start();
};

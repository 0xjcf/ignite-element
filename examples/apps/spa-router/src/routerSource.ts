import { createActor, fromCallback } from "xstate";
import type { NavigationHistoryMode, NavigationPort } from "./navigation";
import {
	resolveNavigation,
	routerMachine,
	type RouterEvent,
} from "./routerMachine";

const toErrorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

export const createRouterSource = ({
	navigation,
	authed = false,
}: {
	navigation: NavigationPort;
	authed?: boolean;
}) => {
	const source = createActor(
		routerMachine.provide({
			actors: {
				observeNavigation: fromCallback<RouterEvent>(({ sendBack }) =>
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
					const currentPath = navigation.currentPath();
					const currentAcceptedPath = resolveNavigation(
						currentPath,
						authed,
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
				authed,
			},
		},
	);

	return source.start();
};

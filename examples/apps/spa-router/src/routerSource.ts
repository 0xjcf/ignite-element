import { createActor } from "xstate";
import type { NavigationPort } from "./navigation";
import { routerMachine } from "./routerMachine";

export const createRouterSource = ({
	navigation,
	authed = false,
}: {
	navigation: NavigationPort;
	authed?: boolean;
}) =>
	createActor(routerMachine, {
		input: {
			path: navigation.currentPath(),
			authed,
		},
	}).start();

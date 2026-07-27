import { createActor } from "xstate";
import type { NavigationPort } from "./navigation";
import { routerMachine } from "./routerMachine";

export const createRouterSource = ({
	navigation,
}: {
	navigation: NavigationPort;
}) =>
	createActor(routerMachine, {
		input: {
			path: navigation.currentPath(),
		},
	}).start();

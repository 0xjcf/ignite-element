import { createActor } from "xstate";
import { routerMachine } from "./routerMachine";

export const routerActor = createActor(routerMachine, {
	input: { path: "/" },
}).start();

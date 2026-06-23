import { createActor } from "xstate";
import { currentPath, onPopState } from "./history";
import { routerMachine } from "./routerMachine";

// One router actor, shared by the outlet and every page element (all register
// with this same source, so they project the same live route state). Created
// from the current URL so a deep link / refresh lands on the right route.
export const routerActor = createActor(routerMachine, {
	input: { path: currentPath() },
}).start();

// Shell wiring: browser back/forward feeds the machine. POPSTATE must not push a
// new history entry — the browser already moved the URL — which is why the
// machine tags the transition `popstate` and the outlet's effect skips it.
onPopState((path) => routerActor.send({ type: "POPSTATE", path }));

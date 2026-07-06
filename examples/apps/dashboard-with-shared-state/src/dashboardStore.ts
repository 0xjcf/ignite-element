import { createActor } from "xstate";
import { dashboardMachine } from "./dashboardModel";

export const dashboardActor = createActor(dashboardMachine).start();

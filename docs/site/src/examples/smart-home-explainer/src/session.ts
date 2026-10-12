import { igniteTools } from "ignite-element/tools";
import {
	allowHomeCommands,
	type createHome,
	createLocalHomeSession,
} from "../../../../../../examples/agents/smart-home/src/home";
import { explainerToolSchema } from "./schema";

const session = createLocalHomeSession();

/** Same core the view registers and the scripted tool loop binds. */
export const home = session.home as ReturnType<typeof createHome>;

export const tools = igniteTools({
	core: home,
	schema: explainerToolSchema,
	canExecute: allowHomeCommands,
});

export const offeredToolNames = tools.manifest.map((tool) => tool.name);

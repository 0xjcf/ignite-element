import type { Core } from "./owner.js";
import type { States } from "./states.js";
export function observe(
	core: Core,
	render: (states: States) => void,
): () => void {
	// watch delivers the current states on subscribe, including a throwing render.
	const subscription = core.watch((next) => render(next));
	return () => subscription.unsubscribe();
}
export async function inspectPreference(core: Core): Promise<States> {
	const stop = observe(core, (state) => console.log(state.message));
	try {
		await core.execute({ command: "check" });
		await core.execute({
			command: "choose",
			input: "compact",
		});
		return core.get("states"); // Current projection after the awaited command.
	} finally {
		stop();
	} // Borrower cleanup, not session disposal.
}

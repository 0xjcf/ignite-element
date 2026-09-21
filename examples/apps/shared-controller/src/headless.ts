import type { Core } from "./owner.js";
import type { States } from "./states.js";
export function observe(
	core: Core,
	render: (states: States) => void,
): () => void {
	const subscription = core.watch((next) => render(next));
	try {
		render(core.get("states"));
	} catch (error) {
		subscription.unsubscribe();
		throw error;
	}
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

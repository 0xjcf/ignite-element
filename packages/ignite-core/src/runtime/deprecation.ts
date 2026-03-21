import type { EmitFromEvents, EventMap } from "../RenderArgs";

const COMMAND_EMIT_DEPRECATION_MESSAGE =
	"emit inside commands is deprecated. Move to effects().";

export function createDeprecatedCommandEmit<Events extends EventMap>(
	emit: EmitFromEvents<Events>,
): EmitFromEvents<Events> {
	let warned = false;

	return ((type, ...args) => {
		if (!warned) {
			warned = true;
			console.warn(COMMAND_EMIT_DEPRECATION_MESSAGE);
		}

		return emit(type, ...args);
	}) as EmitFromEvents<Events>;
}

export { COMMAND_EMIT_DEPRECATION_MESSAGE };

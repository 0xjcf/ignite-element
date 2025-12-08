import type { EventBuilder, EventDescriptor } from "./RenderArgs";

export const event: EventBuilder = <Payload>() =>
	({ __payload: undefined as unknown as Payload }) as EventDescriptor<Payload>;

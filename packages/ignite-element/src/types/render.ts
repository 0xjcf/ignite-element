import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandResult,
} from "@ignite-element/core";

export type BaseRenderArgs<State, Event> = {
	state: State;
	send: (event: Event) => void;
};

export type RendererObject<RenderArgs, View> = {
	render: (args: RenderArgs) => View;
};

export type ComponentRenderer<RenderArgs, View = unknown> =
	| ((args: RenderArgs) => View)
	| RendererObject<RenderArgs, View>
	| (new () => RendererObject<RenderArgs, View>);

export type PublicFacadeRenderArgs<
	StatesResult,
	CommandActor,
	CommandsResult,
	Additional extends Record<string, unknown> = Record<never, never>,
	Events extends EventMap = EmptyEventMap,
> = Additional &
	([StatesResult] extends [Record<string, unknown>]
		? StatesResult
		: Record<never, never>) &
	([CommandsResult] extends [FacadeCommandResult]
		? CommandsResult
		: Record<never, never>) &
	Record<never, CommandActor> &
	Record<never, Events>;

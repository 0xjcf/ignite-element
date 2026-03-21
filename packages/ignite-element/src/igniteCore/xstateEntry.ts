import type {
	ExtendedState,
	ProjectionFactory,
	XStateCommandActor,
} from "ignite-core";
import { igniteCore as igniteCoreProjection } from "ignite-core";
import type { AnyStateMachine, EventFrom } from "xstate";
import igniteElementFactory, {
	type ComponentFactory,
	type IgniteRenderArgs,
} from "../IgniteElementFactory";
import type {
	EmitFromEvents,
	EmitPayloadArgs,
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
} from "../RenderArgs";
import type { IgniteCoreReturn, XStateConfig } from "./types";

const createDomEmit = <Events extends EventMap>(
	host: HTMLElement,
): EmitFromEvents<Events> => {
	return <Type extends keyof Events & string>(
		type: Type,
		...args: EmitPayloadArgs<Events, Type>
	) => {
		const detail = args[0];
		const customEvent = new CustomEvent(type, {
			detail,
			bubbles: true,
			composed: true,
		});
		host.dispatchEvent(customEvent);
	};
};

function bindProjectionToElements<
	State,
	Event,
	RenderArgs extends IgniteRenderArgs<State, Event>,
	Events extends EventMap,
>(
	projection: ProjectionFactory<State, Event, RenderArgs, HTMLElement, Events>,
): ComponentFactory<State, Event, RenderArgs> {
	return igniteElementFactory(projection.createAdapter, {
		scope: projection.scope,
		cleanup: projection.cleanup,
		createAdditionalArgs: (adapter, host) => {
			if (!host) {
				throw new Error(
					"[igniteCore] Host element is required for projection.",
				);
			}
			return projection.createAdditionalArgs(
				adapter,
				host,
				createDomEmit<Events>(host),
			);
		},
	});
}

export function igniteCoreXState<
	Machine extends AnyStateMachine,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
>(
	options: XStateConfig<Machine, Events, StatesResult, CommandsResult>,
): IgniteCoreReturn<
	ExtendedState<Machine>,
	EventFrom<Machine>,
	ExtendedState<Machine>,
	StatesResult,
	XStateCommandActor<Machine>,
	CommandsResult,
	Events
> {
	const projection = igniteCoreProjection(options);
	return bindProjectionToElements(projection);
}

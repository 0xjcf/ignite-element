import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
	ProjectionFactory,
} from "ignite-core";
import { igniteCore as igniteCoreMobxProjection } from "ignite-store/mobx";
import igniteElementFactory, {
	type ComponentFactory,
	type IgniteRenderArgs,
} from "../IgniteElementFactory";
import type {
	EventMap as ElementEventMap,
	EmitFromEvents,
	EmitPayloadArgs,
} from "../RenderArgs";
import type { IgniteCoreReturn, MobxConfig, MobxEvent } from "./types";

const createDomEmit = <Events extends ElementEventMap>(
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
	State extends object,
	Event,
	RenderArgs extends IgniteRenderArgs<State, Event>,
	Events extends ElementEventMap,
>(
	projection: ProjectionFactory<State, Event, RenderArgs, HTMLElement, Events>,
): ComponentFactory<State, Event, RenderArgs> {
	return igniteElementFactory(projection.createAdapter, {
		scope: projection.scope,
		cleanup: projection.cleanup,
		eventTypes: projection.eventTypes,
		resolveView: projection.resolveView,
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

export function igniteCoreMobx<
	State extends object,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
>(
	options: MobxConfig<State, Events, StatesResult, CommandsResult>,
): IgniteCoreReturn<
	State,
	MobxEvent<State>,
	State,
	StatesResult,
	State,
	CommandsResult,
	Events
> {
	const projection = igniteCoreMobxProjection(options);
	return bindProjectionToElements(projection) as IgniteCoreReturn<
		State,
		MobxEvent<State>,
		State,
		StatesResult,
		State,
		CommandsResult,
		Events
	>;
}

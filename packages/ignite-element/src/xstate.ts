import type {
	XStateConfig as AdapterXStateConfig,
	XStateCommandActor,
} from "@ignite-element/adapters/xstate";
import type {
	EmptyEventMap,
	EventMap,
	EventsDefinition,
	FacadeCommandFunction,
	FacadeCommandResult,
	FacadeEffectsObjectCallback,
} from "@ignite-element/core";
import type {
	AnyStateMachine,
	EmittedFrom,
	EventFrom,
	StateFrom,
} from "xstate";
import type {
	DisjointBindings,
	IgniteCoreReturn,
	WithEmittedEvents,
} from "./igniteCore/publicTypes";
import type {
	CompatibleEvents,
	EffectEvents,
} from "./igniteCore/eventProducerTypes";
import type { XStateConfig as CheckedXStateConfig } from "./igniteCore/xstateTypes";

// A machine's declared `emitted` types fold into the headless runtime's events
// on this adapter entry the same way they do on the bare `ignite-element`
// entry, so `on(type)` / `execute().events` are typed from the machine's emit
// union with no manual type arguments. Mirrors the threading in `IgniteCore.ts`.
type XStateRuntimeEvents<
	Machine extends AnyStateMachine,
	Events extends EventMap,
> = WithEmittedEvents<Events, EmittedFrom<Machine>, never>;

export { matchState } from "@ignite-element/core";
export type { IgniteCoreReturn } from "./igniteCore/publicTypes";

import { igniteCoreXState as baseIgniteCoreXState } from "./igniteCore/xstate";

export {
	createProjectionDocumentTarget,
	createProjectionSpeechTarget,
} from "./runtime/projectionTargets";
export type {
	IgniteAgentEventListener,
	IgniteAgentExecutionResult,
	IgniteAgentRuntime,
	IgniteAgentSubscription,
	IgniteCommandCall,
	RuntimeEvent,
} from "./types/agent";
export type {
	IgniteAgentCommandSchema,
	IgniteAgentEventSchema,
	IgniteAgentSchema,
	IgniteSchemaValue,
} from "./types/schema";

type XStateConfigBase<
	Machine extends AnyStateMachine,
	Events extends EventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
> = Omit<
	AdapterXStateConfig<Machine, Events, StatesResult, CommandsResult, unknown>,
	"events" | "effects"
> & {
	effects?: FacadeEffectsObjectCallback<
		StateFrom<Machine>,
		unknown,
		EffectEvents<NoInfer<Events>, NoInfer<EmittedFrom<Machine>>>
	>;
} & DisjointBindings<NoInfer<StatesResult>, NoInfer<CommandsResult>>;

type XStateConfigWithEvents<
	Machine extends AnyStateMachine,
	EventDefinition extends EventsDefinition<EventMap>,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
> = XStateConfigBase<
	Machine,
	EventDefinition extends EventsDefinition<infer Events>
		? Events extends EventMap
			? Events
			: EmptyEventMap
		: EmptyEventMap,
	StatesResult,
	CommandsResult
> & {
	// Infer the author callback once, then validate it. Wrapping this entire
	// check preserves contextual payload inference in non-strict consumers;
	// wrapping Emitted itself would obstruct native-union distribution.
	events: EventDefinition &
		NoInfer<
			EventsDefinition<
				CompatibleEvents<ReturnType<EventDefinition>, EmittedFrom<Machine>>
			>
		>;
};

type XStateConfigWithoutEvents<
	Machine extends AnyStateMachine,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
> = XStateConfigBase<Machine, EmptyEventMap, StatesResult, CommandsResult> & {
	events?: undefined;
};

export type XStateConfig<
	Machine extends AnyStateMachine,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
> = Events extends EmptyEventMap
	? XStateConfigWithoutEvents<Machine, StatesResult, CommandsResult>
	: XStateConfigWithEvents<
			Machine,
			EventsDefinition<Events>,
			StatesResult,
			CommandsResult
		>;

export function igniteCore<
	Machine extends AnyStateMachine,
	EventDefinition extends EventsDefinition<EventMap>,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
>(
	options: XStateConfigWithEvents<
		Machine,
		EventDefinition,
		StatesResult,
		CommandsResult
	>,
): IgniteCoreReturn<
	StateFrom<Machine>,
	EventFrom<Machine>,
	StateFrom<Machine>,
	StatesResult,
	XStateCommandActor<Machine>,
	CommandsResult,
	XStateRuntimeEvents<
		Machine,
		EventDefinition extends EventsDefinition<infer Events>
			? Events extends EventMap
				? Events
				: EmptyEventMap
			: EmptyEventMap
	>
>;

export function igniteCore<
	Machine extends AnyStateMachine,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
>(
	options: XStateConfigWithoutEvents<Machine, StatesResult, CommandsResult>,
): IgniteCoreReturn<
	StateFrom<Machine>,
	EventFrom<Machine>,
	StateFrom<Machine>,
	StatesResult,
	XStateCommandActor<Machine>,
	CommandsResult,
	XStateRuntimeEvents<Machine, EmptyEventMap>
>;

export function igniteCore<
	Machine extends AnyStateMachine,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
>(
	options: AdapterXStateConfig<
		Machine,
		EventMap,
		StatesResult,
		CommandsResult,
		unknown
	> &
		DisjointBindings<NoInfer<StatesResult>, NoInfer<CommandsResult>>,
) {
	// The overloads check producer/payload compatibility. Assembly receives the
	// same callbacks; the narrowed emitter exposes a subset of its capabilities.
	return baseIgniteCoreXState(
		options as CheckedXStateConfig<
			Machine,
			EventMap,
			StatesResult,
			CommandsResult
		>,
	);
}

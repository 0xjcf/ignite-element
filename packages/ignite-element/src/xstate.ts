import "./internal/setupDomPolyfill";

import type {
	XStateConfig as AdapterXStateConfig,
	ExtendedState,
	XStateCommandActor,
} from "@ignite-element/adapters/xstate";
import type {
	EmptyEventMap,
	EventMap,
	EventsDefinition,
	FacadeCommandFunction,
	FacadeCommandResult,
} from "@ignite-element/core";
import type { AnyStateMachine, EmittedFrom, EventFrom } from "xstate";
import type { IgniteCoreReturn, WithEmittedEvents } from "./igniteCore/types";

// A machine's declared `emitted` types fold into the headless runtime's events
// on this adapter entry the same way they do on the bare `ignite-element`
// entry, so `on(type)` / `execute().events` are typed from the machine's emit
// union with no manual type arguments. Mirrors the threading in `IgniteCore.ts`.
type XStateRuntimeEvents<
	Machine extends AnyStateMachine,
	Events extends EventMap,
> = WithEmittedEvents<Events, EmittedFrom<Machine>, EventFrom<Machine>>;

export type {
	CommandHelper,
	CommandMetadata,
	CommandMetadataValue,
	CommandWithMetadata,
	NumberCommandInputMetadata,
	NumberCommandInputOptions,
} from "@ignite-element/core";
export { matchState } from "@ignite-element/core";
export type { IgniteCoreReturn } from "./igniteCore/types";

import { igniteCoreXState as baseIgniteCoreXState } from "./igniteCore/xstate";

export type {
	IgniteDomBridge,
	IgniteDomRoleExpectation,
	IgniteEventExpectation,
	IgniteEventPayloadExpectation,
	IgniteStateExpectation,
	IgniteTestHelpers,
	IgniteTestScenario,
} from "./testing";
export { test } from "./testing";
export type {
	IgniteAgentEventListener,
	IgniteAgentExecutionResult,
	IgniteAgentRuntime,
	IgniteAgentSubscription,
	IgniteStory,
	IgniteStoryCommandTraceEntry,
	IgniteStoryEventTraceEntry,
	IgniteStoryLifecycleEntry,
	IgniteStoryLifecycleScope,
	IgniteStoryLifecycleStage,
	IgniteStorySnapshot,
	IgniteStorySnapshotEvent,
	IgniteStoryStateTraceEntry,
	IgniteStorySummary,
	IgniteStorySummarySnapshot,
	IgniteStoryTraceEntry,
	IgniteStoryTraceKind,
	IgniteStoryTracePhase,
	IgniteStoryTraceSnapshot,
	IgniteStoryTraceSnapshotEntry,
	IgniteStoryUntilOptions,
	IgniteStoryViewPredicate,
	IgniteStoryViewTraceEntry,
	RuntimeEvent,
} from "./types/agent";
export type {
	IgniteAgentCommandSchema,
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
	AdapterXStateConfig<
		Machine,
		Events,
		StatesResult,
		CommandsResult,
		HTMLElement
	>,
	"events"
>;

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
	events: EventDefinition;
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
	ExtendedState<Machine>,
	EventFrom<Machine>,
	ExtendedState<Machine>,
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
	ExtendedState<Machine>,
	EventFrom<Machine>,
	ExtendedState<Machine>,
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
		HTMLElement
	>,
): IgniteCoreReturn<
	ExtendedState<Machine>,
	EventFrom<Machine>,
	ExtendedState<Machine>,
	StatesResult,
	XStateCommandActor<Machine>,
	CommandsResult,
	EmptyEventMap
> {
	return baseIgniteCoreXState(options) as IgniteCoreReturn<
		ExtendedState<Machine>,
		EventFrom<Machine>,
		ExtendedState<Machine>,
		StatesResult,
		XStateCommandActor<Machine>,
		CommandsResult,
		EmptyEventMap
	>;
}

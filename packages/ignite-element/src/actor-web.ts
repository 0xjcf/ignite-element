import "./internal/setupDomPolyfill";

export type {
	ActorWebAddress,
	ActorWebCommandActor,
	ActorWebEventSubscriptionOptions,
	ActorWebExtendedState,
	ActorWebSource,
	ActorWebSourceHandle,
	ActorWebSourceSnapshot,
	ActorWebTransportState,
	ActorWebTransportStatus,
} from "ignite-adapters/actor-web";
export type {
	CommandHelper,
	CommandMetadata,
	CommandMetadataValue,
	CommandWithMetadata,
	NumberCommandInputMetadata,
	NumberCommandInputOptions,
} from "ignite-core";
export { igniteCoreActorWeb as igniteCore } from "./igniteCore/actor-web";
export type { ActorWebConfig, IgniteCoreReturn } from "./igniteCore/types";
export type {
	IgniteEventExpectation,
	IgniteEventPayloadExpectation,
	IgniteStateExpectation,
	IgniteTestScenario,
} from "./testing";
export { test } from "./testing";
export type {
	IgniteAgentEventListener,
	IgniteAgentExecutionResult,
	IgniteAgentRuntime,
	IgniteAgentStateListener,
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

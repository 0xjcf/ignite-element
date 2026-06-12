import "./internal/setupDomPolyfill";

// Thin public bridge: stable Actor-Web types come from ignite-adapters, while
// Ignite-specific component assembly stays behind the local actor-web igniteCore.
export type {
	ActorWebAddress,
	ActorWebCommandActor,
	ActorWebCommandSource,
	ActorWebEventSubscriptionOptions,
	ActorWebExtendedState,
	ActorWebReadModelSource,
	ActorWebSource,
	ActorWebSourceHandle,
	ActorWebSourceSnapshot,
	ActorWebTransportState,
	ActorWebTransportStatus,
} from "@ignite-element/adapters/actor-web";
export type {
	CommandHelper,
	CommandMetadata,
	CommandMetadataValue,
	CommandWithMetadata,
	NumberCommandInputMetadata,
	NumberCommandInputOptions,
} from "@ignite-element/core";
export { igniteCoreActorWeb as igniteCore } from "./igniteCore/actor-web";
export type { ActorWebConfig, IgniteCoreReturn } from "./igniteCore/types";
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

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
export {
	createProjectionDocumentTarget,
	createProjectionSpeechTarget,
} from "./runtime/projectionTargets";
export type {
	IgniteDomBridge,
	IgniteDomRoleExpectation,
	IgniteEventExpectation,
	IgniteSnapshotExpectation,
	IgniteTestHelpers,
	IgniteTestScenario,
	IgniteTestScenarioOptions,
} from "./testing";
export { test } from "./testing";
export type {
	IgniteAgentEventListener,
	IgniteAgentExecutionResult,
	IgniteAgentRuntime,
	IgniteAgentSubscription,
	IgniteCommandCall,
	IgniteStory,
	IgniteStoryBehaviorTraceEntry,
	IgniteStoryCommandTraceEntry,
	IgniteStoryEventTraceEntry,
	IgniteStoryLifecycleEntry,
	IgniteStoryLifecycleScope,
	IgniteStoryLifecycleStage,
	IgniteStorySnapshot,
	IgniteStorySnapshotEvent,
	IgniteStorySnapshotTraceEntry,
	IgniteStorySummary,
	IgniteStorySummarySnapshot,
	IgniteStoryTraceEntry,
	IgniteStoryTraceKind,
	IgniteStoryTracePhase,
	IgniteStoryTraceSnapshot,
	IgniteStoryTraceSnapshotEntry,
	IgniteStoryUntilOptions,
	IgniteStoryStatesPredicate,
	IgniteStoryStatesTraceEntry,
	RuntimeEvent,
} from "./types/agent";
export type {
	IgniteAgentCommandSchema,
	IgniteAgentEventSchema,
	IgniteAgentSchema,
	IgniteSchemaValue,
} from "./types/schema";

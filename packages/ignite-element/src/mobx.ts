import "./internal/setupDomPolyfill";

export type {
	CommandHelper,
	CommandMetadata,
	CommandMetadataValue,
	CommandWithMetadata,
	NumberCommandInputMetadata,
	NumberCommandInputOptions,
} from "@ignite-element/core";
export { igniteCoreMobx as igniteCore } from "./igniteCore/mobx";
export type {
	IgniteCoreReturn,
	MobxConfig,
	MobxEvent,
} from "./igniteCore/types";
export type {
	IgniteDomBridge,
	IgniteDomRoleExpectation,
	IgniteEventExpectation,
	IgniteEventPayloadExpectation,
	IgniteStateExpectation,
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

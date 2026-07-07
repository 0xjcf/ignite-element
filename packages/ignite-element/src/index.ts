import "./internal/setupDomPolyfill";

// The low-level factories `createComponentFactory`, `createProjectionFactory`,
// and `igniteElementFactory` are intentionally NOT re-exported here. They are
// `igniteCore`'s internal building blocks and are marked `@internal` at their
// source; the public surface is the adapter `igniteCore` entrypoints
// (ignite-element/xstate|redux|mobx|actor-web). See .fas/memory/decisions.md
// (2026-06-04).

export type {
	CommandHelper,
	CommandMetadata,
	CommandMetadataValue,
	CommandWithMetadata,
	NumberCommandInputMetadata,
	NumberCommandInputOptions,
} from "@ignite-element/core";
export { event, StateScope } from "@ignite-element/core";
export {
	type IgniteShellConfig,
	type IgniteShellHost,
	type IgniteShellRegistrar,
	type IgniteShellTeardown,
	igniteShell,
} from "./igniteShell";
export type {
	IgniteDomBridge,
	IgniteDomRoleExpectation,
	IgniteEventExpectation,
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
	IgniteAgentEventSchema,
	IgniteAgentSchema,
	IgniteSchemaValue,
} from "./types/schema";

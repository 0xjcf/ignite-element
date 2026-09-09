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
	createProjectionDocumentTarget,
	createProjectionSpeechTarget,
} from "./runtime/projectionTargets";
export { igniteCore } from "./sourceFreeCore";
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

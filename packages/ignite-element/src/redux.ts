import "./internal/setupDomPolyfill";

export { igniteCoreRedux as igniteCore } from "./IgniteCore";
export { test } from "./testing";
export type {
	IgniteCoreReturn,
	ReduxBlueprintConfig,
	ReduxInstanceConfig,
	ReduxSliceCommandActor,
	ReduxStoreCommandActor,
} from "./igniteCore/types";
export type {
	IgniteAgentEventListener,
	IgniteAgentExecutionResult,
	IgniteAgentRuntime,
	IgniteAgentStateListener,
	IgniteAgentSubscription,
	RuntimeEvent,
} from "./types/agent";
export type { IgniteAgentSchema, IgniteSchemaValue } from "./types/schema";
export type {
	IgniteEventExpectation,
	IgniteEventPayloadExpectation,
	IgniteStateExpectation,
	IgniteTestScenario,
} from "./testing";

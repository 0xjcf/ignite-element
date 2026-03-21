import "./internal/setupDomPolyfill";

export { igniteCoreMobx as igniteCore } from "./igniteCore/mobxEntry";
export { test } from "./testing";
export type {
	IgniteCoreReturn,
	MobxConfig,
	MobxEvent,
} from "./igniteCore/types";
export type {
	IgniteAgentExecutionResult,
	IgniteAgentRuntime,
	RuntimeEvent,
} from "./types/agent";
export type { IgniteAgentSchema, IgniteSchemaValue } from "./types/schema";
export type {
	IgniteEventExpectation,
	IgniteEventPayloadExpectation,
	IgniteStateExpectation,
	IgniteTestScenario,
} from "./testing";

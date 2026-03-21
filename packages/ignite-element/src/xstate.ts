import "./internal/setupDomPolyfill";

export { matchState } from "ignite-core";
export type { IgniteCoreReturn, XStateConfig } from "./igniteCore/types";
export type {
	IgniteAgentExecutionResult,
	IgniteAgentRuntime,
	RuntimeEvent,
} from "./types/agent";
export type { IgniteAgentSchema, IgniteSchemaValue } from "./types/schema";
export { igniteCoreXState as igniteCore } from "./igniteCore/xstateEntry";

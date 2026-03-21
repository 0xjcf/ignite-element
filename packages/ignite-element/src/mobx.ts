import "./internal/setupDomPolyfill";

export { igniteCoreMobx as igniteCore } from "./igniteCore/mobxEntry";
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

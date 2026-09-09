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
export {
	createProjectionDocumentTarget,
	createProjectionSpeechTarget,
} from "./runtime/projectionTargets";
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

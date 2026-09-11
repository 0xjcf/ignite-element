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
export { igniteCoreActorWeb as igniteCore } from "./igniteCore/actor-web";
export type {
	ActorWebConfig,
	IgniteCoreReturn,
} from "./igniteCore/actorWebTypes";
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

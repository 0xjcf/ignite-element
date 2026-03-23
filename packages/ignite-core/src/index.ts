export type {
	ExtendedState,
	XStateActorInstance,
	XStateCommandActor,
	XStateSnapshot,
} from "./adapters/XStateAdapter";
export { default as createXStateAdapter } from "./adapters/XStateAdapter";
export type {
	AdapterFactory,
	ProjectionFactory,
	WithFacadeRenderArgs,
} from "./createProjectionFactory";
export { createProjectionFactory } from "./createProjectionFactory";
export { event } from "./events";
export type { default as IgniteAdapter } from "./IgniteAdapter";
export { StateScope } from "./IgniteAdapter";
export { igniteCore } from "./igniteCore";
export type {
	BaseRenderArgs,
	CommandContext,
	EffectContext,
	EffectSelection,
	EffectSelector,
	EmitFromEvents,
	EmitPayloadArgs,
	EmptyEventMap,
	EventBuilder,
	EventDescriptor,
	EventMap,
	EventPayload,
	FacadeEffectArgs,
	FacadeEffectsCallback,
	FacadeEffectsLike,
	FacadeEffectsObjectCallback,
	FacadeCommandFunction,
	FacadeCommandResult,
	FacadeCommandsCallback,
	FacadeStatesCallback,
	FacadeViewCallback,
	RenderArgs,
	ViewContext,
} from "./RenderArgs";
export type {
	AnyCommandsCallback,
	AnyEffectsCallback,
	AnyStatesCallback,
	AnyViewCallback,
	EventsDefinition,
	IgniteCoreReturn,
	InferEvents,
	XStateConfig,
} from "./types";
export { facadeCleanupSymbol } from "./runtime/effects";
export {
	isFunction,
	isXStateActor,
	isXStateMachine,
} from "./utils/adapterGuards";
export { matchState } from "./utils/matchState";

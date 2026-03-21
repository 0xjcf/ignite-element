import "./internal/setupDomPolyfill";

export { event, StateScope } from "ignite-core";
export type {
	IgniteConfig,
	IgniteLoggingLevel,
	IgniteRendererId,
	IgniteRenderStrategyId,
} from "ignite-renderer";
export {
	defineIgniteConfig,
	getIgniteConfig,
	setGlobalStyles,
} from "ignite-renderer";
export { loadIgniteConfig } from "./config/loadIgniteConfig";
export {
	type AdapterPack,
	type BaseRenderArgs as IgniteRenderArgs,
	type ComponentFactory,
	default as igniteElementFactory,
} from "./IgniteElementFactory";
export type { RenderArgs } from "./RenderArgs";
export {
	registerRenderStrategy,
	resolveConfiguredRenderStrategy,
} from "./renderers/resolveConfiguredRenderStrategy";
export { test } from "./testing";
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

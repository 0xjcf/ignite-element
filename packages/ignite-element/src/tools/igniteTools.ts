import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandResult,
} from "../RenderArgs";
import type { IgniteAgentExecutionResult } from "../types/agent";
import { buildManifest, resolveCall } from "./core";
import { err, ok, type Result } from "./result";
import type {
	AvailabilityPredicate,
	IgniteToolsComponent,
	NeutralManifest,
	NeutralToolCall,
	NeutralToolResult,
	Route,
	ToolDialect,
	ToolError,
	ToolObservation,
} from "./types";

/** The neutral core surface, usable directly without a provider dialect. */
export type IgniteToolsNeutral<State, Events extends EventMap> = {
	manifest: NeutralManifest;
	resolveCall(name: string, input: unknown): Result<Route, ToolError>;
	invoke(
		call: NeutralToolCall,
	): Promise<Result<ToolObservation<State, Events>, ToolError>>;
};

/** The neutral core plus a dialect's provider-shaped tools + translators. */
export type IgniteToolsWithDialect<
	State,
	Events extends EventMap,
	Tools,
	Response,
	ResultBlock,
> = IgniteToolsNeutral<State, Events> & {
	tools: Tools;
	parseToolCalls(response: Response): NeutralToolCall[];
	toToolResult(result: NeutralToolResult<State, Events>): ResultBlock;
};

export function igniteTools<
	State,
	Commands extends FacadeCommandResult,
	Events extends EventMap,
	SchemaState,
	View extends Record<string, unknown>,
>(
	component: IgniteToolsComponent<State, Commands, Events, SchemaState, View>,
): IgniteToolsNeutral<State, Events>;
export function igniteTools<
	State,
	Commands extends FacadeCommandResult,
	Events extends EventMap,
	SchemaState,
	View extends Record<string, unknown>,
	Tools,
	Response,
	ResultBlock,
>(
	component: IgniteToolsComponent<State, Commands, Events, SchemaState, View>,
	dialect: ToolDialect<Tools, Response, ResultBlock>,
): IgniteToolsWithDialect<State, Events, Tools, Response, ResultBlock>;
/**
 * Bridge the agent-runtime contract to LLM tool-use. The pure core builds a
 * neutral manifest from `getSchema()` and routes validated calls; the shell
 * (`invoke`) performs the single `execute` side effect. With a `ToolDialect`,
 * the result also carries provider-shaped `tools` and the parse/result
 * translators — the consumer brings the SDK and runs the model loop.
 */
export function igniteTools(
	component: IgniteToolsComponent,
	dialect?: ToolDialect,
) {
	const canExecute: AvailabilityPredicate | undefined =
		typeof component.canExecute === "function"
			? component.canExecute.bind(component)
			: undefined;

	const manifest = buildManifest(component.getSchema(), canExecute);

	// The model supplies dynamic command names, so treat `execute` as the loose
	// runtime contract at this boundary.
	const execute = component.execute as unknown as (
		name: string,
		payload?: unknown,
	) => Promise<IgniteAgentExecutionResult<unknown, EmptyEventMap>>;

	const boundResolveCall = (
		name: string,
		input: unknown,
	): Result<Route, ToolError> => resolveCall(manifest, name, input, canExecute);

	const invoke = async (
		call: NeutralToolCall,
	): Promise<Result<ToolObservation<unknown, EmptyEventMap>, ToolError>> => {
		const routed = boundResolveCall(call.name, call.input);
		if (!routed.ok) {
			return routed;
		}

		try {
			const { state, events } = await execute(
				routed.value.command,
				routed.value.payload,
			);
			return ok({ snapshot: state, events });
		} catch (cause) {
			return err({
				kind: "ExecuteFailed",
				name: call.name,
				message: cause instanceof Error ? cause.message : String(cause),
				cause,
			});
		}
	};

	const neutral = { manifest, resolveCall: boundResolveCall, invoke };

	if (!dialect) {
		return neutral;
	}

	return {
		...neutral,
		tools: dialect.toToolDefs(manifest),
		parseToolCalls: (response: unknown) => dialect.parseToolCalls(response),
		toToolResult: (result: NeutralToolResult) => dialect.toToolResult(result),
	};
}

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
	IgniteToolsRuntime,
	NeutralManifest,
	NeutralToolCall,
	NeutralToolResult,
	Route,
	ToolDialect,
	ToolError,
	ToolObservation,
} from "./types";

/** The neutral core surface, usable directly without a provider dialect. */
export type IgniteToolsNeutral<State, View, Events extends EventMap> = {
	manifest: NeutralManifest;
	resolveCall(name: string, input: unknown): Result<Route, ToolError>;
	run(
		call: NeutralToolCall,
	): Promise<Result<ToolObservation<State, View, Events>, ToolError>>;
};

/** The neutral core plus a dialect's provider-shaped tools + translators. */
export type IgniteToolsWithDialect<
	State,
	View,
	Events extends EventMap,
	Tools,
	Response,
	ResultBlock,
> = IgniteToolsNeutral<State, View, Events> & {
	tools: Tools;
	toolCalls(response: Response): NeutralToolCall[];
	toolResult(result: NeutralToolResult<State, View, Events>): ResultBlock;
};

export function igniteTools<
	State,
	Commands extends FacadeCommandResult,
	Events extends EventMap,
	SchemaState,
	View extends Record<string, unknown>,
>(
	runtime: IgniteToolsRuntime<State, Commands, Events, SchemaState, View>,
): IgniteToolsNeutral<State, View, Events>;
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
	runtime: IgniteToolsRuntime<State, Commands, Events, SchemaState, View>,
	dialect: ToolDialect<Tools, Response, ResultBlock>,
): IgniteToolsWithDialect<State, View, Events, Tools, Response, ResultBlock>;
/**
 * Bridge the agent-runtime contract to LLM tool-use. The pure core builds a
 * neutral manifest from `getSchema()` and routes validated calls; the shell
 * (`run`) performs the single `execute` side effect. With a `ToolDialect`,
 * the result also carries provider-shaped `tools` and the parse/result
 * translators — the consumer brings the SDK and runs the model loop.
 */
export function igniteTools(
	runtime: IgniteToolsRuntime,
	dialect?: ToolDialect,
) {
	const canExecute: AvailabilityPredicate | undefined =
		typeof runtime.canExecute === "function"
			? runtime.canExecute.bind(runtime)
			: undefined;

	const manifest = buildManifest(runtime.getSchema(), canExecute);

	// The model supplies dynamic command names, so treat `execute` as the loose
	// runtime contract at this boundary.
	const execute = runtime.execute as unknown as (
		name: string,
		payload?: unknown,
	) => Promise<IgniteAgentExecutionResult<unknown, EmptyEventMap>>;

	// Captured post-command (at acknowledgement) into each observation so the
	// agent grounds on the derived view, not just the raw snapshot.
	const getView = runtime.getView as unknown as () => unknown;

	const boundResolveCall = (
		name: string,
		input: unknown,
	): Result<Route, ToolError> => resolveCall(manifest, name, input, canExecute);

	const run = async (
		call: NeutralToolCall,
	): Promise<
		Result<ToolObservation<unknown, unknown, EmptyEventMap>, ToolError>
	> => {
		const routed = boundResolveCall(call.name, call.input);
		if (!routed.ok) {
			return routed;
		}

		try {
			const { state, events } = await execute(
				routed.value.command,
				routed.value.payload,
			);
			return ok({ snapshot: state, view: getView(), events });
		} catch (cause) {
			return err({
				kind: "ExecuteFailed",
				name: call.name,
				message: cause instanceof Error ? cause.message : String(cause),
				cause,
			});
		}
	};

	const neutral = { manifest, resolveCall: boundResolveCall, run };

	if (!dialect) {
		return neutral;
	}

	return {
		...neutral,
		tools: dialect.tools(manifest),
		toolCalls: (response: unknown) => dialect.toolCalls(response, manifest),
		toolResult: (result: NeutralToolResult) => dialect.toolResult(result),
	};
}

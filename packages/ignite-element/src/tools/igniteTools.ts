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
	ToolStreamHandler,
	ToolStreamSubscription,
} from "./types";

/** The neutral core surface, usable directly without a provider dialect. */
export type IgniteToolsNeutral<State, View, Events extends EventMap> = {
	manifest: NeutralManifest;
	resolveCall(name: string, input: unknown): Result<Route, ToolError>;
	run(
		call: NeutralToolCall,
	): Promise<Result<ToolObservation<State, View, Events>, ToolError>>;
	observe(handler: ToolStreamHandler<View, Events>): ToolStreamSubscription;
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
			? (runtime.canExecute.bind(runtime) as AvailabilityPredicate)
			: undefined;

	const schema = runtime.getSchema();
	const manifest = buildManifest(schema, canExecute);

	// The model supplies dynamic command names, so bind the runtime method before
	// storing it and treat `execute` as the loose contract at this boundary.
	const execute = runtime.execute.bind(runtime) as unknown as (
		name: string,
		payload?: unknown,
	) => Promise<IgniteAgentExecutionResult<unknown, EmptyEventMap>>;

	// Captured post-command (at acknowledgement) into each observation so the
	// agent grounds on the derived view, not just the raw snapshot.
	const getView = runtime.getView.bind(runtime) as unknown as () => unknown;

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

	const observe = (
		handler: ToolStreamHandler<unknown, EmptyEventMap>,
	): ToolStreamSubscription => {
		const on = runtime.on.bind(runtime) as unknown as (
			eventName: string,
			handler: (event: CustomEvent<unknown>) => void,
		) => ToolStreamSubscription;
		const watchView = runtime.watchView.bind(runtime) as unknown as (
			handler: (view: unknown, prevView: unknown) => void,
		) => ToolStreamSubscription;
		const subscriptions: ToolStreamSubscription[] = [];

		try {
			for (const eventName of schema.events) {
				subscriptions.push(
					on(eventName, (event) => {
						handler({
							type: "event",
							event: { type: eventName, payload: event.detail },
						});
					}),
				);
			}

			subscriptions.push(
				watchView((view, prevView) => {
					handler({ type: "view", view, prevView });
				}),
			);
		} catch (cause) {
			for (const subscription of subscriptions) {
				subscription.unsubscribe();
			}
			throw cause;
		}

		let unsubscribed = false;

		return {
			unsubscribe: () => {
				if (unsubscribed) {
					return;
				}
				unsubscribed = true;
				for (const subscription of subscriptions) {
					subscription.unsubscribe();
				}
			},
		};
	};

	const neutral = { manifest, resolveCall: boundResolveCall, run, observe };

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

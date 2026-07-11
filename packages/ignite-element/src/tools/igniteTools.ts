import type { EventMap, FacadeCommandResult } from "../RenderArgs";
import type { IgniteCommandCall, RuntimeEvent } from "../types/agent";
import type { IgniteSchemaObject } from "../types/schema";
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNoArgSchema(schema: IgniteSchemaObject): boolean {
	if (schema.type !== "object") {
		return false;
	}

	const properties = isPlainObject(schema.properties) ? schema.properties : {};
	return (
		Object.keys(properties).length === 0 &&
		(!Array.isArray(schema.required) || schema.required.length === 0)
	);
}

function isIgniteCommandCall<Commands extends FacadeCommandResult>(
	call: Route,
	schema: IgniteSchemaObject,
): call is IgniteCommandCall<Commands> {
	if (!("input" in call)) {
		return isNoArgSchema(schema);
	}

	return true;
}

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
	dialect?: ToolDialect<Tools, Response, ResultBlock>,
) {
	const canExecute: AvailabilityPredicate | undefined =
		typeof runtime.canExecute === "function"
			? (runtime.canExecute.bind(runtime) as AvailabilityPredicate)
			: undefined;

	const schema = runtime.getSchema();
	const manifest = buildManifest(schema, canExecute);

	// Captured post-command (at acknowledgement) into each observation so the
	// agent grounds on the derived view, not just the raw snapshot.
	const getView = () => runtime.getView();

	const boundResolveCall = (
		name: string,
		input: unknown,
	): Result<Route, ToolError> => resolveCall(manifest, name, input, canExecute);

	const run = async (
		call: NeutralToolCall,
	): Promise<Result<ToolObservation<State, View, Events>, ToolError>> => {
		const routed = boundResolveCall(call.name, call.input);
		if (!routed.ok) {
			return routed;
		}

		try {
			const routedTool = manifest.find(
				(candidate) => candidate.name === routed.value.command,
			);
			if (!routedTool) {
				return err({
					kind: "UnknownCommand",
					name: routed.value.command,
				});
			}

			if (
				!isIgniteCommandCall<Commands>(routed.value, routedTool.inputSchema)
			) {
				return err({
					kind: "InvalidInput",
					name: routed.value.command,
					issues: ["input: command route could not be typed for execution"],
				});
			}

			const { snapshot, events } = await runtime.execute(routed.value);
			return ok({ snapshot, view: getView(), events });
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
		handler: ToolStreamHandler<View, Events>,
	): ToolStreamSubscription => {
		const on = runtime.on.bind(runtime) as unknown as (
			eventName: string,
			handler: (event: RuntimeEvent<Events>) => void,
		) => ToolStreamSubscription;
		const watchView = runtime.watchView.bind(runtime) as unknown as (
			handler: (view: View, prevView: View) => void,
		) => ToolStreamSubscription;
		const subscriptions: ToolStreamSubscription[] = [];

		try {
			for (const eventDescriptor of schema.events) {
				subscriptions.push(
					on(eventDescriptor.type, (event) => {
						handler({
							type: "event",
							event,
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
		toolCalls: (response: Response) => dialect.toolCalls(response, manifest),
		toolResult: (result: NeutralToolResult<State, View, Events>) =>
			dialect.toolResult(result),
	};
}

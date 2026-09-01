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
export type IgniteToolsNeutral<State, States, Events extends EventMap> = {
	manifest: NeutralManifest;
	resolveCall(name: string, input: unknown): Result<Route, ToolError>;
	run(
		call: NeutralToolCall,
	): Promise<Result<ToolObservation<State, States, Events>, ToolError>>;
	observe(handler: ToolStreamHandler<States, Events>): ToolStreamSubscription;
};

/** The neutral core plus a dialect's provider-shaped tools + translators. */
export type IgniteToolsWithDialect<
	State,
	States,
	Events extends EventMap,
	Tools,
	Response,
	ResultBlock,
> = IgniteToolsNeutral<State, States, Events> & {
	tools: Tools;
	toolCalls(response: Response): NeutralToolCall[];
	toolResult(result: NeutralToolResult<State, States, Events>): ResultBlock;
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
	States extends Record<string, unknown>,
>(
	runtime: IgniteToolsRuntime<State, Commands, Events, SchemaState, States>,
): IgniteToolsNeutral<State, States, Events>;
export function igniteTools<
	State,
	Commands extends FacadeCommandResult,
	Events extends EventMap,
	SchemaState,
	States extends Record<string, unknown>,
	Tools,
	Response,
	ResultBlock,
>(
	runtime: IgniteToolsRuntime<State, Commands, Events, SchemaState, States>,
	dialect: ToolDialect<Tools, Response, ResultBlock>,
): IgniteToolsWithDialect<State, States, Events, Tools, Response, ResultBlock>;
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
	States extends Record<string, unknown>,
	Tools,
	Response,
	ResultBlock,
>(
	runtime: IgniteToolsRuntime<State, Commands, Events, SchemaState, States>,
	dialect?: ToolDialect<Tools, Response, ResultBlock>,
) {
	const canExecute: AvailabilityPredicate | undefined =
		typeof runtime.canExecute === "function"
			? (runtime.canExecute.bind(runtime) as AvailabilityPredicate)
			: undefined;

	const schema = runtime.getSchema();
	const manifest = buildManifest(schema, canExecute);

	const boundResolveCall = (
		name: string,
		input: unknown,
	): Result<Route, ToolError> => resolveCall(manifest, name, input, canExecute);

	const run = async (
		call: NeutralToolCall,
	): Promise<Result<ToolObservation<State, States, Events>, ToolError>> => {
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

			const { snapshot, states, events } = await runtime.execute(routed.value);
			return ok({ snapshot, states, events });
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
		handler: ToolStreamHandler<States, Events>,
	): ToolStreamSubscription => {
		const on = runtime.on.bind(runtime) as unknown as (
			eventName: string,
			handler: (event: RuntimeEvent<Events>) => void,
		) => ToolStreamSubscription;
		const watchStates = runtime.watchStates.bind(runtime) as unknown as (
			handler: (states: States, prevStates: States) => void,
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
				watchStates((states, prevStates) => {
					handler({ type: "states", states, prevStates });
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
		toolResult: (result: NeutralToolResult<State, States, Events>) =>
			dialect.toolResult(result),
	};
}

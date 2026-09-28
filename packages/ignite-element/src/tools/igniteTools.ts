import type { EventMap, FacadeCommandResult } from "../RenderArgs";
import type { IgniteCommandCall, RuntimeEvent } from "../types/agent";
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
	ToolInputSchema,
	ToolObservation,
	ToolSchema,
	ToolStreamHandler,
	ToolStreamObservation,
	ToolStreamSubscription,
} from "./types";

/** The neutral core surface, usable directly without a provider dialect. */
export type IgniteToolsNeutral<
	CommandResult,
	States,
	Events extends EventMap,
> = {
	manifest: NeutralManifest;
	resolveCall(name: string, input: unknown): Result<Route, ToolError>;
	run(
		call: NeutralToolCall,
	): Promise<Result<ToolObservation<CommandResult, States, Events>, ToolError>>;
	observe(handler: ToolStreamHandler<States, Events>): ToolStreamSubscription;
	until<Matched>(
		match: (observation: ToolStreamObservation<States, Events>) => Matched,
	): Promise<Exclude<Matched, undefined | null | false>>;
};

/** The neutral core plus a dialect's provider-shaped tools + translators. */
export type IgniteToolsWithDialect<
	CommandResult,
	States,
	Events extends EventMap,
	Tools,
	Response,
	ResultBlock,
> = IgniteToolsNeutral<CommandResult, States, Events> & {
	tools: Tools;
	toolCalls(response: Response): NeutralToolCall[];
	toolResult(
		result: NeutralToolResult<CommandResult, States, Events>,
	): ResultBlock;
};

export type IgniteToolsBind<
	State,
	Commands extends FacadeCommandResult,
	Events extends EventMap,
	SchemaState,
	States extends Record<string, unknown>,
	S extends ToolSchema = ToolSchema,
> = {
	core: IgniteToolsRuntime<State, Commands, Events, SchemaState, States>;
	schema: S;
	canExecute?: AvailabilityPredicate;
};

const NAMED_BIND_ERROR =
	"[igniteTools] Named bind only: igniteTools({ core, schema, canExecute?, dialect? }). Supply an explicit schema; discovery does not infer one. The positional igniteTools(core, dialect, opts) overload is removed.";

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNamedBind(
	value: unknown,
): value is { core: unknown; schema: unknown } {
	return isPlainObject(value) && "core" in value && "schema" in value;
}

function isNoArgSchema(schema: ToolInputSchema): boolean {
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
	schema: ToolInputSchema,
): call is IgniteCommandCall<Commands> {
	if (!("input" in call)) {
		return isNoArgSchema(schema);
	}

	return true;
}

type IgniteToolsResult<
	CommandResult,
	States,
	Events extends EventMap,
	Dialect,
> = Dialect extends ToolDialect<infer Tools, infer Response, infer ResultBlock>
	? IgniteToolsWithDialect<
			CommandResult,
			States,
			Events,
			Tools,
			Response,
			ResultBlock
		>
	: IgniteToolsNeutral<CommandResult, States, Events>;

/**
 * Bridge the agent-runtime contract to LLM tool-use. Bind with named options
 * only: `{ core, schema, canExecute?, dialect? }`. The pure core builds a
 * neutral manifest from explicit tool definitions and routes validated calls;
 * the shell (`run`) performs the single `execute` side effect. `run` is
 * act-plus-acknowledgement; everyday settle uses `until`, and `observe`
 * remains for ongoing fan-in. With a `ToolDialect`, the result also carries
 * provider-shaped `tools` and the parse/result translators — the consumer
 * brings the SDK and runs the model loop.
 */
export function igniteTools<
	State,
	Commands extends FacadeCommandResult,
	Events extends EventMap,
	SchemaState,
	States extends Record<string, unknown>,
	S extends ToolSchema,
	Dialect extends ToolDialect | undefined = undefined,
>(
	options: IgniteToolsBind<State, Commands, Events, SchemaState, States, S> & {
		dialect?: Dialect;
	},
): IgniteToolsResult<
	Awaited<ReturnType<Commands[keyof Commands]>>,
	States,
	Events,
	Dialect
> {
	if (!isNamedBind(options)) {
		throw new Error(NAMED_BIND_ERROR);
	}

	const runtime = options.core;
	const schema = options.schema;
	const dialect = options.dialect;
	const canExecute = options.canExecute ?? (() => true);
	const catalogue = runtime.get("schema");
	const manifest = buildManifest(schema, canExecute);

	const boundResolveCall = (
		name: string,
		input: unknown,
	): Result<Route, ToolError> => resolveCall(manifest, name, input, canExecute);

	const run = async (
		call: NeutralToolCall,
	): Promise<
		Result<
			ToolObservation<
				Awaited<ReturnType<Commands[keyof Commands]>>,
				States,
				Events
			>,
			ToolError
		>
	> => {
		const routed = boundResolveCall(call.name, call.input);
		if (!routed.ok) {
			return routed;
		}

		const subscriptions: ToolStreamSubscription[] = [];
		let observing = true;
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

			const events: RuntimeEvent<Events>[] = [];
			for (const { type } of runtime.get("events")) {
				subscriptions.push(
					runtime.on(type, (event) => {
						if (observing) events.push(event);
					}),
				);
			}
			const result = await runtime.execute(routed.value);
			const states = runtime.get("states");
			return ok({ result, states, events });
		} catch (cause) {
			return err({
				kind: "ExecuteFailed",
				name: call.name,
				message: cause instanceof Error ? cause.message : String(cause),
				cause,
			});
		} finally {
			observing = false;
			for (const subscription of subscriptions) {
				try {
					subscription.unsubscribe();
				} catch (error) {
					// Cleanup must drain every handle without replacing the primary result.
					console.error(
						"[igniteTools] Command observation cleanup failed.",
						error,
					);
				}
			}
		}
	};

	const observe = (
		handler: ToolStreamHandler<States, Events>,
	): ToolStreamSubscription => {
		const on = runtime.on.bind(runtime) as unknown as (
			eventName: string,
			handler: (event: RuntimeEvent<Events>) => void,
		) => ToolStreamSubscription;
		const watchStates = runtime.watch.bind(runtime) as unknown as (
			handler: (states: States, prevStates: States) => void,
		) => ToolStreamSubscription;
		const subscriptions: ToolStreamSubscription[] = [];

		try {
			for (const eventDescriptor of catalogue.events) {
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

	const until = <Matched>(
		match: (observation: ToolStreamObservation<States, Events>) => Matched,
	): Promise<Exclude<Matched, undefined | null | false>> =>
		new Promise((resolve, reject) => {
			let settled = false;
			let subscription: ToolStreamSubscription | undefined;

			const finish = (complete: () => void) => {
				if (settled) {
					return;
				}
				settled = true;
				subscription?.unsubscribe();
				complete();
			};

			try {
				subscription = observe((observation) => {
					if (settled) {
						return;
					}
					try {
						const matched = match(observation);
						if (matched == null || matched === false) {
							return;
						}
						finish(() => {
							resolve(matched as Exclude<Matched, undefined | null | false>);
						});
					} catch (error) {
						finish(() => {
							reject(error);
						});
					}
				});
			} catch (error) {
				reject(error);
				return;
			}

			if (settled) {
				subscription?.unsubscribe();
			}
		});

	const neutral = {
		manifest,
		resolveCall: boundResolveCall,
		run,
		observe,
		until,
	};

	if (!dialect) {
		return neutral as IgniteToolsResult<
			Awaited<ReturnType<Commands[keyof Commands]>>,
			States,
			Events,
			Dialect
		>;
	}

	return {
		...neutral,
		tools: dialect.tools(manifest),
		toolCalls: (response) => dialect.toolCalls(response, manifest),
		toolResult: (result) => dialect.toolResult(result),
	} as IgniteToolsResult<
		Awaited<ReturnType<Commands[keyof Commands]>>,
		States,
		Events,
		Dialect
	>;
}

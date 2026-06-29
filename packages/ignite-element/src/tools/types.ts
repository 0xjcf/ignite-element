import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandResult,
} from "../RenderArgs";
import type { IgniteAgentRuntime, RuntimeEvent } from "../types/agent";
import type { IgniteSchemaObject, IgniteSchemaValue } from "../types/schema";
import type { Result } from "./result";

/**
 * A single neutral tool, derived from one `getSchema().commands` entry. Provider
 * dialects translate this into their wire-format tool definitions; the neutral
 * shape never references a provider SDK.
 */
export type NeutralTool = {
	name: string;
	description?: string;
	/**
	 * The command's declared input schema (JSON-Schema-shaped), mirrored verbatim
	 * from the command metadata — scalar, object, or `{ type: "object",
	 * properties: {} }` for a no-arg command. Provider-specific object-wrapping of
	 * scalar inputs is an adapter concern, not the neutral core's.
	 */
	inputSchema: IgniteSchemaObject;
	/**
	 * Whether the command carries an availability predicate. A static meta-fact —
	 * the dynamic per-snapshot decision is made by `canExecute` (see
	 * `docs/can-execute.md`). Always `false` until `canExecute` ships.
	 */
	gated: boolean;
};

export type NeutralManifest = NeutralTool[];

/**
 * A provider-agnostic tool call, produced by a dialect's `toolCalls`. The
 * `input` is untyped on purpose: it originates from the model and is validated
 * by `resolveCall` before it ever reaches a command.
 */
export type NeutralToolCall = {
	id?: string;
	name: string;
	input: unknown;
};

/**
 * The observation an agent gets back after a successful tool call: the
 * post-command `snapshot` (raw state), the derived `view` (the read-model the
 * agent should ground on — distinct from the raw snapshot), and the events
 * emitted during the command window. Both snapshot and view are captured at
 * command-acknowledgement (see the act+ack note in `docs/ignite-tools.md`).
 */
export type ToolObservation<
	Snapshot,
	View = unknown,
	Events extends EventMap = EmptyEventMap,
> = {
	snapshot: Snapshot;
	view: View;
	events: RuntimeEvent<Events>[];
};

/**
 * Errors as values. Returned (never thrown) by `resolveCall`/`run` so the
 * consumer can map an error into the provider's `tool_result` (`is_error: true`)
 * and let the model recover.
 */
export type ToolError =
	| { kind: "UnknownCommand"; name: string }
	| { kind: "InvalidInput"; name: string; issues: string[] }
	| { kind: "Unavailable"; name: string }
	| { kind: "ExecuteFailed"; name: string; message: string; cause?: unknown };

/**
 * The validated routing target produced by `resolveCall`: the command to run
 * and the payload to pass to `execute`.
 */
export type Route<Name extends string = string, Payload = unknown> = {
	command: Name;
	payload: Payload;
};

/**
 * The input to a dialect's `toolResult`: a tool call's correlation id/name
 * paired with the `run` outcome.
 */
export type NeutralToolResult<
	Snapshot = unknown,
	View = unknown,
	Events extends EventMap = EmptyEventMap,
> = {
	id?: string;
	name: string;
	result: Result<ToolObservation<Snapshot, View, Events>, ToolError>;
};

/**
 * The provider boundary (the port). A pure format translator between the neutral
 * manifest and one provider's tool-calling wire format. Adapters implementing
 * this carry no provider-SDK runtime dependency.
 *
 * Method names are bare ecosystem nouns — the typed direction (manifest in vs.
 * response in) makes encode/decode verbs redundant, and `tools`/`toolCalls`/
 * `toolResult` are the lingua franca across Anthropic, OpenAI, the Vercel AI
 * SDK, and LangChain.
 */
export interface ToolDialect<
	Tools = unknown,
	Response = unknown,
	ResultBlock = unknown,
> {
	/** Neutral manifest → provider tool definitions. */
	tools(manifest: NeutralManifest): Tools;
	/**
	 * Provider response → neutral tool calls. Receives the `manifest` so the
	 * adapter can unwrap a scalar command's object-wrapped `{ value }` argument
	 * back to the bare value (see `tools/scalar.ts`); the unwrap is gated on the
	 * manifest schema, so it is collision-free.
	 */
	toolCalls(response: Response, manifest: NeutralManifest): NeutralToolCall[];
	/** Neutral result → provider tool-result block (encoded one call at a time). */
	toolResult(result: NeutralToolResult): ResultBlock;
}

/** Per-command availability predicate, evaluated against the current snapshot. */
export type AvailabilityPredicate = (name: string) => boolean;

/**
 * The minimal slice of the agent runtime that `igniteTools` depends on:
 * `getSchema` (the contract), `execute` (the single side effect), and `getView`
 * (the derived read-model captured into each observation so the agent grounds on
 * the view, not just the raw snapshot). Any `igniteCore(...)` return satisfies
 * it. `canExecute` is optional and duck-typed: present once it ships on the
 * runtime, it gates the manifest; absent today, all commands are offered.
 */
export type IgniteToolsRuntime<
	State = unknown,
	Commands extends FacadeCommandResult = FacadeCommandResult,
	Events extends EventMap = EmptyEventMap,
	SchemaState = IgniteSchemaValue,
	View extends Record<string, unknown> = Record<never, never>,
> = Pick<
	IgniteAgentRuntime<State, Commands, Events, SchemaState, View>,
	"getSchema" | "execute" | "getView"
> & {
	canExecute?: AvailabilityPredicate;
};

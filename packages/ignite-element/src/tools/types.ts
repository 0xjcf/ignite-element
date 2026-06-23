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
 * A provider-agnostic tool call, produced by a dialect's `parseToolCalls`. The
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
 * post-command snapshot plus the events emitted during the command window.
 */
export type ToolObservation<
	Snapshot,
	Events extends EventMap = EmptyEventMap,
> = {
	snapshot: Snapshot;
	events: RuntimeEvent<Events>[];
};

/**
 * Errors as values. Returned (never thrown) by `resolveCall`/`invoke` so the
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
 * The input to a dialect's `toToolResult`: a tool call's correlation id/name
 * paired with the `invoke` outcome.
 */
export type NeutralToolResult<
	Snapshot = unknown,
	Events extends EventMap = EmptyEventMap,
> = {
	id?: string;
	name: string;
	result: Result<ToolObservation<Snapshot, Events>, ToolError>;
};

/**
 * The provider boundary (the port). A pure format translator between the neutral
 * manifest and one provider's tool-calling wire format. Adapters implementing
 * this carry no provider-SDK runtime dependency.
 */
export interface ToolDialect<
	Tools = unknown,
	Response = unknown,
	ResultBlock = unknown,
> {
	toToolDefs(manifest: NeutralManifest): Tools;
	parseToolCalls(response: Response): NeutralToolCall[];
	toToolResult(result: NeutralToolResult): ResultBlock;
}

/** Per-command availability predicate, evaluated against the current snapshot. */
export type AvailabilityPredicate = (name: string) => boolean;

/**
 * The minimal slice of the agent runtime that `igniteTools` depends on — just
 * `getSchema` (the contract) and `execute` (the single side effect). Any
 * `igniteCore(...)` return satisfies it. `canExecute` is optional and
 * duck-typed: present once it ships on the runtime, it gates the manifest;
 * absent today, all commands are offered.
 */
export type IgniteToolsComponent<
	State = unknown,
	Commands extends FacadeCommandResult = FacadeCommandResult,
	Events extends EventMap = EmptyEventMap,
	SchemaState = IgniteSchemaValue,
	View extends Record<string, unknown> = Record<never, never>,
> = Pick<
	IgniteAgentRuntime<State, Commands, Events, SchemaState, View>,
	"getSchema" | "execute"
> & {
	canExecute?: AvailabilityPredicate;
};

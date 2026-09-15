import type {
	EmptyEventMap,
	EventDescriptor,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
} from "@ignite-element/core";
import type {
	IgniteAgentRuntime,
	IgniteProjectionSession,
	IgniteProjectionTarget,
} from "../types/agent";
import type {
	ComponentRenderer,
	PublicFacadeRenderArgs,
} from "../types/render";
import type { IgniteAgentSchema, IgniteSchemaValue } from "../types/schema";
import type { KnownEmitted, NativeMember } from "./eventProducerTypes";

// Dynamic index signatures need the runtime check; exact known keys can also
// reject a collision at construction without changing either callback's inference.
export type DisjointBindings<States, Commands> = string extends
	| keyof States
	| keyof Commands
	? unknown
	: Extract<keyof States, keyof Commands> extends never
		? unknown
		: {
				readonly "State and command names must be disjoint": never;
			};
/**
 * Derives the runtime `Events` map for a source that emits domain
 * events. When the source declares a distinct `Emitted` union (≠ its command
 * `Message`), each emitted member is folded into the headless runtime's events
 * as the flat runtime event member, matching the runtime bridge, so
 * `on(...)` / `execute().events` are typed from the source with no `events:`
 * map. Explicitly declared keys are checked against native payloads at the
 * supported typed constructors before taking precedence. A non-distinct
 * `Emitted` (the `= Message` default) contributes nothing, and neither does a
 * broad union whose `type` is plain `string` (e.g. XState's `EventObject`
 * default on machines that declare no `emitted` types) — folding that in
 * would add a string index signature to the events map. XState passes `never`
 * for Message: its real emitted union is authoritative even if input and output
 * happen to have identical types.
 */
export type WithEmittedEvents<
	Events extends EventMap,
	Emitted extends { type: string },
	Message extends { type: string },
> = [Emitted] extends [Message]
	? Events
	: [KnownEmitted<Emitted>] extends [never]
		? Events
		: Events &
				Omit<
					{
						[Type in KnownEmitted<Emitted>["type"]]: EventDescriptor<
							NativeMember<KnownEmitted<Emitted>, Type>
						>;
					},
					keyof Events
				>;

/**
 * Typed per-element handle returned by registration (`igniteCore(config)(tag,
 * render)`). Additive: callers that ignore the return are unaffected. Carries
 * the registered `tagName` and keyed catalogue reads that delegate to the same
 * agent-runtime source of truth as the registrar. The `Commands`/`Events`
 * generics are PHANTOM (never populated at runtime) — they exist only to carry
 * the compile-time types that `igniteReact` (and future framework wrappers)
 * infer from a handle value. Event wiring reads the catalogue; the
 * compile-time mapping reads the phantom generics. Two surfaces, one source each.
 */
export interface IgniteComponent<
	Commands extends FacadeCommandResult = FacadeCommandResult,
	Events extends EventMap = EmptyEventMap,
	SchemaState = IgniteSchemaValue,
> {
	readonly tagName: string;
	get(key: "schema"): IgniteAgentSchema<SchemaState>;
	get(key: "commands"): IgniteAgentSchema["commands"];
	get(key: "events"): IgniteAgentSchema["events"];
	readonly __commands?: Commands;
	readonly __events?: Events;
}

export type IgniteCoreReturn<
	_State,
	_Event,
	Snapshot,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandActor = unknown,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Events extends EventMap = EmptyEventMap,
> = {
	(target: IgniteProjectionTarget): IgniteProjectionSession;
	(
		elementName: string,
		renderer: ComponentRenderer<
			PublicFacadeRenderArgs<
				StatesResult,
				CommandActor,
				CommandsResult,
				Record<never, never>,
				Events
			> &
				Record<never, Snapshot>
		>,
	): IgniteComponent<CommandsResult, Events>;
	readonly __igniteRenderArgs?: PublicFacadeRenderArgs<
		StatesResult,
		CommandActor,
		CommandsResult,
		Record<never, never>,
		Events
	> &
		Record<never, Snapshot>;
} & IgniteAgentRuntime<
	Snapshot,
	CommandsResult,
	Events,
	IgniteSchemaValue,
	StatesResult
>;

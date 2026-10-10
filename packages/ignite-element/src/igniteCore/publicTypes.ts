import type {
	EmptyEventMap,
	EventDescriptor,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
} from "@ignite-element/core";
import type { HostRenderSlot } from "../hosts/types";
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
import type {
	ChannelEmitted,
	KnownEmitted,
	NativeMember,
} from "./eventProducerTypes";

// Dynamic index signatures need the runtime check; exact known keys can also
// reject a collision at construction without changing either callback's inference.
export type HostSafeChild<Use> =
	| HostSafeElement<Use>
	| string
	| number
	| boolean
	| null
	| undefined
	| readonly HostSafeChild<Use>[];

type HostSafeElement<Use> = {
	readonly type?: unknown;
	readonly props?: {
		use?: Use;
		children?: HostSafeChild<Use>;
		readonly [key: string]: unknown;
	};
	readonly key?: unknown;
};

type HostUseOf<Hosts> = HostRenderSlot<Hosts> extends {
	readonly hosts: infer Handles;
}
	? Handles[keyof Handles & string]
	: never;

/**
 * Hosted views check a preserved `use` against this core's handles. A core
 * with no host map stays unconstrained so non-JSX renderers keep typechecking.
 * JSX tag syntax erases `use`, so this sees a `jsx()` result.
 */
export type HostCheckedView<Hosts = undefined> = HostRenderSlot<Hosts> extends {
	readonly hosts: unknown;
}
	? string extends keyof Hosts
		? unknown
		: HostSafeChild<HostUseOf<Hosts>>
	: unknown;

type HostUseBrand = {
	readonly __igniteHost: (map: never) => string;
};

/**
 * `never` when a `jsx()` result still carries a branded host handle. Tag
 * syntax erases `use` to `unknown`, so `<canvas use={...} />` is not rejected
 * on a core with no hosts.
 */
type RejectUnhostedBrand<View> = View extends {
	readonly props: { readonly use?: infer Use };
}
	? [Use] extends [HostUseBrand]
		? never
		: unknown
	: unknown;

/**
 * Hosted calls keep the concrete handle check. A core with no host map accepts
 * any view except a `jsx()` result whose `use` is still a branded handle.
 */
type HostCallView<Hosts, View> = HostRenderSlot<Hosts> extends {
	readonly hosts: unknown;
}
	? string extends keyof Hosts
		? View
		: HostCheckedView<Hosts>
	: View & RejectUnhostedBrand<View>;

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
 * `on(...)` are typed from the source with no `events:`
 * map. Explicitly declared keys are checked against native payloads at the
 * supported typed constructors before taking precedence. A non-distinct
 * `Emitted` (the `= Message` default) contributes nothing, and neither does a
 * broad union whose `type` is plain `string` (e.g. XState's `EventObject`
 * default on machines that declare no `emitted` types) — folding that in
 * would add a string index signature to the events map. Constructors with an
 * established outward channel (XState emissions or Actor-Web ChannelEmitted)
 * pass `never` for Message: input/output overlap cannot erase real emissions.
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

/** Prefer a proven channel; retain legacy optional-channel observation typing.
 * The fallback does not reserve producers or infer emissions from commands.
 */
export type ActorWebRuntimeEvents<
	Events extends EventMap,
	Source,
	Emitted extends { type: string },
	Message extends { type: string },
> = [ChannelEmitted<Source>] extends [never]
	? WithEmittedEvents<Events, Emitted, Message>
	: WithEmittedEvents<Events, ChannelEmitted<Source>, never>;

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
	// Native headless emissions do not imply a declared DOM event. Defaulting
	// preserves existing type-alias consumers and adapters with one event map.
	DeclaredEvents extends EventMap = Events,
	Hosts = undefined,
> = {
	(target: IgniteProjectionTarget): IgniteProjectionSession;
	<View>(
		elementName: string,
		renderer: ComponentRenderer<
			PublicFacadeRenderArgs<
				StatesResult,
				CommandActor,
				CommandsResult,
				Record<never, never>,
				DeclaredEvents,
				Hosts
			> &
				Record<never, Snapshot>,
			HostCallView<Hosts, View>
		>,
	): IgniteComponent<CommandsResult, DeclaredEvents>;
	readonly __igniteRenderArgs?: PublicFacadeRenderArgs<
		StatesResult,
		CommandActor,
		CommandsResult,
		Record<never, never>,
		DeclaredEvents,
		Hosts
	> &
		Record<never, Snapshot>;
} & IgniteAgentRuntime<
	Snapshot,
	CommandsResult,
	Events,
	IgniteSchemaValue,
	StatesResult
>;

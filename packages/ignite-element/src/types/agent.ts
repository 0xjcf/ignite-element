import type {
	EmptyEventMap,
	EventMap,
	EventPayload,
	FacadeCommandResult,
} from "../RenderArgs";
import type { IgniteAgentSchema, IgniteSchemaValue } from "./schema";

type RuntimeEventUnion<Events extends EventMap> = {
	[Type in keyof Events & string]: {
		type: Type;
		payload: EventPayload<Events[Type]>;
	};
}[keyof Events & string];

export type RuntimeEvent<Events extends EventMap = EmptyEventMap> = [
	keyof Events & string,
] extends [never]
	? {
			type: string;
			payload: unknown;
		}
	: RuntimeEventUnion<Events>;

type CommandPayload<
	Commands extends FacadeCommandResult,
	CommandName extends keyof Commands & string,
> = Parameters<Commands[CommandName]> extends []
	? undefined
	: Parameters<Commands[CommandName]>[0];

export type IgniteStoryTraceKind = "command" | "state" | "view" | "event";

export type IgniteStoryTracePhase = "before" | "after";

export type IgniteStoryCommandTraceEntry = {
	kind: "command";
	sequence: number;
	step: number;
	command: string;
	payload?: IgniteSchemaValue;
};

export type IgniteStoryStateTraceEntry = {
	kind: "state";
	sequence: number;
	step: number;
	phase: IgniteStoryTracePhase;
	state: IgniteSchemaValue;
};

export type IgniteStoryViewTraceEntry = {
	kind: "view";
	sequence: number;
	step: number;
	phase: IgniteStoryTracePhase;
	view: IgniteSchemaValue;
};

export type IgniteStoryEventTraceEntry = {
	kind: "event";
	sequence: number;
	step: number;
	event: string;
	payload: IgniteSchemaValue;
};

export type IgniteStoryTraceEntry =
	| IgniteStoryCommandTraceEntry
	| IgniteStoryStateTraceEntry
	| IgniteStoryViewTraceEntry
	| IgniteStoryEventTraceEntry;

export type IgniteStoryTraceSnapshotEntry = IgniteStoryTraceEntry;

export type IgniteStoryTraceSnapshot = IgniteStoryTraceSnapshotEntry[];

export type IgniteStoryLifecycleStage =
	| "registered"
	| "connected"
	| "rendered"
	| "disconnected"
	| "cleaned-up";

export type IgniteStoryLifecycleScope = "shared" | "isolated";

export type IgniteStoryLifecycleEntry = {
	kind: "lifecycle";
	sequence: number;
	stage: IgniteStoryLifecycleStage;
	elementName: string;
	scope: IgniteStoryLifecycleScope;
	instanceId?: number;
};

export type IgniteStoryUntilOptions = {
	maxSteps?: number;
};

export type IgniteStoryViewPredicate<View> = (view: View) => boolean;

export type IgniteStorySummary<
	State,
	Events extends EventMap = EmptyEventMap,
	View extends Record<string, unknown> = Record<never, never>,
> = {
	name: string;
	finalState: State;
	finalView: View;
	events: RuntimeEvent<Events>[];
	commandCount: number;
	traceCount: number;
	lifecycleCount: number;
};

export type IgniteStorySnapshot<
	State,
	Events extends EventMap = EmptyEventMap,
	View extends Record<string, unknown> = Record<never, never>,
> = {
	name: string;
	trace: IgniteStoryTraceSnapshot;
	lifecycle: IgniteStoryLifecycleEntry[];
	summary: IgniteStorySummary<State, Events, View>;
};

export type IgniteStory<
	State,
	Commands extends FacadeCommandResult = FacadeCommandResult,
	Events extends EventMap = EmptyEventMap,
	View extends Record<string, unknown> = Record<never, never>,
> = {
	readonly name: string;
	execute<CommandName extends keyof Commands & string>(
		commandName: CommandName,
		payload?: CommandPayload<Commands, CommandName>,
	): IgniteAgentExecutionResult<State, Events>;
	until(
		viewPredicate: IgniteStoryViewPredicate<View>,
		action: (
			story: IgniteStory<State, Commands, Events, View>,
			view: View,
			iteration: number,
		) => unknown,
		options?: IgniteStoryUntilOptions,
	): View;
	trace(): IgniteStoryTraceEntry[];
	lifecycle(): IgniteStoryLifecycleEntry[];
	summary(): IgniteStorySummary<State, Events, View>;
	stop(): void;
};

export type IgniteAgentExecutionResult<
	State,
	Events extends EventMap = EmptyEventMap,
> = {
	state: State;
	events: RuntimeEvent<Events>[];
};

export type IgniteAgentEventListener<
	Events extends EventMap = EmptyEventMap,
	Type extends keyof Events & string = keyof Events & string,
> = (event: CustomEvent<EventPayload<Events[Type]>>) => void;

export type IgniteAgentStateListener<State> = (
	state: State,
	prevState: State,
) => void;

export type IgniteAgentSubscription = {
	unsubscribe: () => void;
};

export type IgniteAgentRuntime<
	State,
	Commands extends FacadeCommandResult = FacadeCommandResult,
	Events extends EventMap = EmptyEventMap,
	SchemaState = IgniteSchemaValue,
	View extends Record<string, unknown> = Record<never, never>,
> = {
	execute<CommandName extends keyof Commands & string>(
		commandName: CommandName,
		payload?: CommandPayload<Commands, CommandName>,
	): IgniteAgentExecutionResult<State, Events>;
	getState(): State;
	getView(): View;
	on<Type extends keyof Events & string>(
		eventName: Type,
		handler: IgniteAgentEventListener<Events, Type>,
	): IgniteAgentSubscription;
	/** @deprecated Use `on(eventName, handler)` instead. */
	subscribe<Type extends keyof Events & string>(
		eventName: Type,
		handler: IgniteAgentEventListener<Events, Type>,
	): IgniteAgentSubscription;
	watch(handler: IgniteAgentStateListener<State>): IgniteAgentSubscription;
	watchView(handler: IgniteAgentStateListener<View>): IgniteAgentSubscription;
	getSchema(): IgniteAgentSchema<SchemaState>;
	record(name: string): IgniteStory<State, Commands, Events, View>;
};

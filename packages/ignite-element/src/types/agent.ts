import type {
	EmptyEventMap,
	EventMap,
	EventMember,
	FacadeCommandResult,
} from "../RenderArgs";
import type {
	IgniteAgentSchema,
	IgniteSchemaObject,
	IgniteSchemaValue,
} from "./schema";
import { igniteProjectionTargetBrand } from "./projectionTargetBrand";

type RuntimeEventUnion<Events extends EventMap> = {
	[Type in keyof Events & string]: EventMember<Events, Type>;
}[keyof Events & string];

export type RuntimeEvent<Events extends EventMap = EmptyEventMap> = [
	keyof Events & string,
] extends [never]
	? {
			type: string;
			[key: string]: unknown;
		}
	: RuntimeEventUnion<Events>;

type CommandPayload<
	Commands extends FacadeCommandResult,
	CommandName extends keyof Commands & string,
> = Parameters<Commands[CommandName]> extends []
	? undefined
	: Parameters<Commands[CommandName]>[0];

export type IgniteCommandCall<
	Commands extends FacadeCommandResult = FacadeCommandResult,
	CommandName extends keyof Commands & string = keyof Commands & string,
> = {
	[Name in CommandName]: Parameters<Commands[Name]> extends []
		? { command: Name }
		: undefined extends CommandPayload<Commands, Name>
			? { command: Name; input?: CommandPayload<Commands, Name> }
			: { command: Name; input: CommandPayload<Commands, Name> };
}[CommandName];

export type IgniteStoryTraceKind = "command" | "snapshot" | "view" | "event";

export type IgniteStoryTracePhase = "before" | "after";

export type IgniteStoryCommandTraceEntry = {
	kind: "command";
	sequence: number;
	step: number;
	command: string;
	payload?: IgniteSchemaValue;
};

export type IgniteStorySnapshotTraceEntry = {
	kind: "snapshot";
	sequence: number;
	step: number;
	phase: IgniteStoryTracePhase;
	snapshot: IgniteSchemaValue;
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
	| IgniteStorySnapshotTraceEntry
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
	finalSnapshot: State;
	finalView: View;
	events: RuntimeEvent<Events>[];
	commandCount: number;
	traceCount: number;
	lifecycleCount: number;
};

export type IgniteStorySnapshotEvent = {
	type: string;
} & Record<string, IgniteSchemaValue>;

export type IgniteStorySummarySnapshot = {
	name: string;
	finalSnapshot: IgniteSchemaValue;
	finalView: IgniteSchemaValue;
	events: IgniteStorySnapshotEvent[];
	commandCount: number;
	traceCount: number;
	lifecycleCount: number;
};

export type IgniteStorySnapshot = {
	name: string;
	trace: IgniteStoryTraceSnapshot;
	lifecycle: IgniteStoryLifecycleEntry[];
	summary: IgniteStorySummarySnapshot;
};

export type IgniteStory<
	State,
	Commands extends FacadeCommandResult = FacadeCommandResult,
	Events extends EventMap = EmptyEventMap,
	View extends Record<string, unknown> = Record<never, never>,
> = {
	readonly name: string;
	execute<CommandName extends keyof Commands & string>(
		call: IgniteCommandCall<Commands, CommandName>,
	): Promise<IgniteAgentExecutionResult<State, Events>>;
	until(
		viewPredicate: IgniteStoryViewPredicate<View>,
		action: (
			story: IgniteStory<State, Commands, Events, View>,
			view: View,
			iteration: number,
		) => unknown,
		options?: IgniteStoryUntilOptions,
	): Promise<View>;
	trace(): IgniteStoryTraceEntry[];
	lifecycle(): IgniteStoryLifecycleEntry[];
	summary(): IgniteStorySummary<State, Events, View>;
	canExecute<CommandName extends keyof Commands & string>(
		commandName: CommandName,
	): boolean;
	stop(): void;
};

export type IgniteAgentExecutionResult<
	State,
	Events extends EventMap = EmptyEventMap,
> = {
	snapshot: State;
	events: RuntimeEvent<Events>[];
};

export type IgniteAgentEventListener<
	Events extends EventMap = EmptyEventMap,
	Type extends keyof Events & string = keyof Events & string,
> = (event: EventMember<Events, Type>) => void;

export type IgniteAgentSnapshotListener<Snapshot> = (
	snapshot: Snapshot,
	prevSnapshot: Snapshot,
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
	canExecute<CommandName extends keyof Commands & string>(
		commandName: CommandName,
	): boolean;
	execute<CommandName extends keyof Commands & string>(
		call: IgniteCommandCall<Commands, CommandName>,
	): Promise<IgniteAgentExecutionResult<State, Events>>;
	getSnapshot(): State;
	getView(): View;
	on<Type extends keyof Events & string>(
		eventName: Type,
		handler: IgniteAgentEventListener<Events, Type>,
	): IgniteAgentSubscription;
	watchSnapshot(
		handler: IgniteAgentSnapshotListener<State>,
	): IgniteAgentSubscription;
	watchView(
		handler: IgniteAgentSnapshotListener<View>,
	): IgniteAgentSubscription;
	getSchema(): IgniteAgentSchema<SchemaState, View>;
	record(name: string): IgniteStory<State, Commands, Events, View>;
};

export type ProjectionNodeBase = {
	id: string;
};

export type ProjectionTextNode = ProjectionNodeBase & {
	kind: "text";
	text: string;
};

export type ProjectionChecklistNode = ProjectionNodeBase & {
	kind: "checklist";
	items: readonly {
		id: string;
		label: string;
		checked: boolean;
	}[];
};

export type ProjectionActionNode = ProjectionNodeBase & {
	kind: "action";
	label: string;
	commandName: string;
	payload?: IgniteSchemaValue;
	description?: string;
};

export type ProjectionFormNode = ProjectionNodeBase & {
	kind: "form";
	title?: string;
	fields: readonly {
		id: string;
		label: string;
		input: IgniteSchemaObject;
		value?: IgniteSchemaValue;
		description?: string;
	}[];
	submit?: ProjectionActionNode;
};

export type ProjectionTableNode = ProjectionNodeBase & {
	kind: "table";
	columns: readonly {
		id: string;
		label: string;
	}[];
	rows: readonly {
		id: string;
		cells: readonly IgniteSchemaValue[];
	}[];
};

export type ProjectionTimelineNode = ProjectionNodeBase & {
	kind: "timeline";
	events: readonly {
		id: string;
		label: string;
		timestamp: string;
		detail?: string;
	}[];
};

export type ProjectionChartNode = ProjectionNodeBase & {
	kind: "chart";
	chartType: "bar" | "line" | "pie";
	series: readonly {
		id: string;
		label: string;
		value: number;
	}[];
};

export type ProjectionCodeDiffNode = ProjectionNodeBase & {
	kind: "code-diff";
	language?: string;
	before?: string;
	after?: string;
};

export type ProjectionDecisionLogNode = ProjectionNodeBase & {
	kind: "decision-log";
	entries: readonly {
		id: string;
		title: string;
		decision: string;
		rationale?: string;
	}[];
};

export type ProjectionDocumentNode =
	| ProjectionTextNode
	| ProjectionChecklistNode
	| ProjectionActionNode
	| ProjectionFormNode
	| ProjectionTableNode
	| ProjectionTimelineNode
	| ProjectionChartNode
	| ProjectionCodeDiffNode
	| ProjectionDecisionLogNode;

export type ProjectionDocument = {
	id: string;
	revision: string;
	title?: string;
	nodes: readonly ProjectionDocumentNode[];
};

export type ProjectionDocumentPatch =
	| {
			type: "set-node";
			documentId: string;
			baseRevision: string;
			revision: string;
			node: ProjectionDocumentNode;
	  }
	| {
			type: "remove-node";
			documentId: string;
			baseRevision: string;
			revision: string;
			nodeId: string;
	  };

export type ProjectionSpeechRequest = {
	id: string;
	text: string;
	status: "pending" | "acknowledged";
	voice?: string;
};

export type IgniteProjectionSession = {
	dispose(): void;
};

export type IgniteProjectionTarget = {
	readonly [igniteProjectionTargetBrand]: true;
};

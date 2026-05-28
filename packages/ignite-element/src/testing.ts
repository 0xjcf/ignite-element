import type {
	EmptyEventMap,
	EventMap,
	EventPayload,
	FacadeCommandResult,
} from "./RenderArgs";
import type {
	IgniteAgentExecutionResult,
	IgniteAgentRuntime,
	IgniteStory,
	IgniteStorySnapshot,
	IgniteStoryTraceEntry,
	IgniteStoryTraceSnapshot,
	IgniteStoryTraceSnapshotEntry,
	RuntimeEvent,
} from "./types/agent";

type DeepPartial<T> = T extends readonly (infer Item)[]
	? readonly DeepPartial<Item>[]
	: T extends object
		? {
				[K in keyof T]?: DeepPartial<T[K]>;
			}
		: T;
type StateValueExpectation<State> = State extends { value: infer Value }
	? Value
	: never;

export type IgniteStateExpectation<State> =
	| DeepPartial<State>
	| StateValueExpectation<State>
	| ((state: State) => boolean);

export type IgniteEventPayloadExpectation<Payload> =
	| DeepPartial<Payload>
	| ((payload: Payload) => boolean);

export type IgniteEventExpectation<
	Events extends EventMap = EmptyEventMap,
	Type extends keyof Events & string = keyof Events & string,
> = {
	type: Type;
	payload?: IgniteEventPayloadExpectation<EventPayload<Events[Type]>>;
};

export type IgniteStoryTraceExpectationEntry =
	| DeepPartial<IgniteStoryTraceSnapshotEntry>
	| ((
			entry: IgniteStoryTraceSnapshotEntry,
			index: number,
			trace: IgniteStoryTraceSnapshot,
	  ) => boolean);

export type IgniteStoryTraceAssertionOptions = {
	exact?: boolean;
};

export type IgniteTestScenario<
	State,
	Commands extends FacadeCommandResult = FacadeCommandResult,
	Events extends EventMap = EmptyEventMap,
> = {
	given(
		expected: IgniteStateExpectation<State>,
	): IgniteTestScenario<State, Commands, Events>;
	when<CommandName extends keyof Commands & string>(
		commandName: CommandName,
		payload?: unknown,
	): Promise<IgniteTestScenario<State, Commands, Events>>;
	expectState(
		expected: IgniteStateExpectation<State>,
	): IgniteTestScenario<State, Commands, Events>;
	expectEvent<Type extends keyof Events & string>(
		type: Type,
		payload?: IgniteEventPayloadExpectation<EventPayload<Events[Type]>>,
	): IgniteTestScenario<State, Commands, Events>;
	expectEvents(
		expected: IgniteEventExpectation<Events>[],
	): IgniteTestScenario<State, Commands, Events>;
	expectNoEvents(): IgniteTestScenario<State, Commands, Events>;
	getResult(): IgniteAgentExecutionResult<State, Events>;
};

export type IgniteTestHelpers = {
	serializeTrace: (
		trace: readonly IgniteStoryTraceEntry[],
	) => IgniteStoryTraceSnapshot;
	snapshotStory: <
		State,
		Commands extends FacadeCommandResult,
		Events extends EventMap,
		View extends Record<string, unknown>,
	>(
		story: IgniteStory<State, Commands, Events, View>,
	) => IgniteStorySnapshot<State, Events, View>;
	expectTrace: (
		trace: readonly IgniteStoryTraceEntry[],
		expected: readonly IgniteStoryTraceExpectationEntry[],
		options?: IgniteStoryTraceAssertionOptions,
	) => IgniteStoryTraceSnapshot;
};

type RuntimeState<Runtime> = Runtime extends IgniteAgentRuntime<
	infer State,
	infer _Commands,
	infer _Events,
	infer _SchemaState
>
	? State
	: never;

type RuntimeCommands<Runtime> = Runtime extends IgniteAgentRuntime<
	infer _State,
	infer Commands,
	infer _Events,
	infer _SchemaState
>
	? Commands
	: FacadeCommandResult;

type RuntimeEvents<Runtime> = Runtime extends IgniteAgentRuntime<
	infer _State,
	infer _Commands,
	infer Events,
	infer _SchemaState
>
	? Events
	: EmptyEventMap;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" &&
	value !== null &&
	Object.getPrototypeOf(value) === Object.prototype;

const formatValue = (value: unknown): string => {
	if (typeof value === "string") {
		return `"${value}"`;
	}

	try {
		return JSON.stringify(value, null, 2) ?? String(value);
	} catch {
		return String(value);
	}
};

const cloneSerializable = <Value>(value: Value): Value =>
	JSON.parse(JSON.stringify(value)) as Value;

const cloneTraceSnapshotEntry = (
	entry: IgniteStoryTraceEntry,
): IgniteStoryTraceSnapshotEntry => {
	switch (entry.kind) {
		case "command":
			return typeof entry.payload === "undefined"
				? { ...entry }
				: { ...entry, payload: cloneSerializable(entry.payload) };
		case "event":
			return { ...entry, payload: cloneSerializable(entry.payload) };
		case "state":
			return { ...entry, state: cloneSerializable(entry.state) };
		case "view":
			return { ...entry, view: cloneSerializable(entry.view) };
	}
};

const valuesMatch = (actual: unknown, expected: unknown): boolean => {
	if (typeof expected === "function") {
		return (expected as (value: unknown) => boolean)(actual);
	}

	if (Array.isArray(expected)) {
		return (
			Array.isArray(actual) &&
			actual.length === expected.length &&
			expected.every((value, index) => valuesMatch(actual[index], value))
		);
	}

	if (isPlainObject(expected)) {
		if (!isPlainObject(actual)) {
			return false;
		}

		return Object.entries(expected).every(([key, value]) =>
			valuesMatch(actual[key], value),
		);
	}

	return Object.is(actual, expected);
};

const resolveStateSubject = <State>(
	state: State,
	expected: IgniteStateExpectation<State>,
) => {
	if (
		typeof expected !== "function" &&
		(typeof expected !== "object" || expected === null) &&
		typeof state === "object" &&
		state !== null &&
		"value" in (state as Record<string, unknown>)
	) {
		return (state as unknown as { value: unknown }).value;
	}

	return state;
};

const assertState = <State>(
	label: "given" | "expectState",
	state: State,
	expected: IgniteStateExpectation<State>,
) => {
	const subject = resolveStateSubject(state, expected);

	if (!valuesMatch(subject, expected)) {
		throw new Error(
			`[igniteTest] ${label} failed.\nExpected: ${formatValue(expected)}\nReceived: ${formatValue(subject)}`,
		);
	}
};

const assertEvent = <
	Events extends EventMap,
	Type extends keyof Events & string,
>(
	events: RuntimeEvent<Events>[],
	type: Type,
	payload?: IgniteEventPayloadExpectation<EventPayload<Events[Type]>>,
) => {
	const matchedEvent = events.find((event) => event.type === type);

	if (!matchedEvent) {
		throw new Error(
			`[igniteTest] Expected event "${type}" but received ${formatValue(events)}.`,
		);
	}

	if (typeof payload === "undefined") {
		return;
	}

	if (!valuesMatch(matchedEvent.payload, payload)) {
		throw new Error(
			`[igniteTest] Event "${type}" payload mismatch.\nExpected: ${formatValue(payload)}\nReceived: ${formatValue(matchedEvent.payload)}`,
		);
	}
};

const serializeTrace = (
	trace: readonly IgniteStoryTraceEntry[],
): IgniteStoryTraceSnapshot => trace.map(cloneTraceSnapshotEntry);

const snapshotStory = <
	State,
	Commands extends FacadeCommandResult,
	Events extends EventMap,
	View extends Record<string, unknown>,
>(
	story: IgniteStory<State, Commands, Events, View>,
) =>
	({
		name: story.name,
		trace: serializeTrace(story.trace()),
		lifecycle: cloneSerializable(story.lifecycle()),
		summary: cloneSerializable(story.summary()),
	}) satisfies IgniteStorySnapshot<State, Events, View>;

const traceEntryMatches = (
	actual: IgniteStoryTraceSnapshotEntry,
	expected: IgniteStoryTraceExpectationEntry,
	index: number,
	trace: IgniteStoryTraceSnapshot,
) =>
	typeof expected === "function"
		? expected(actual, index, trace)
		: valuesMatch(actual, expected);

const expectTrace = (
	trace: readonly IgniteStoryTraceEntry[],
	expected: readonly IgniteStoryTraceExpectationEntry[],
	options?: IgniteStoryTraceAssertionOptions,
): IgniteStoryTraceSnapshot => {
	const snapshot = serializeTrace(trace);
	const exact = options?.exact ?? false;

	if (expected.length === 0) {
		return snapshot;
	}

	if (exact && snapshot.length !== expected.length) {
		throw new Error(
			`[igniteTest] Trace length mismatch.\nExpected entries: ${expected.length}\nReceived entries: ${snapshot.length}\nTrace: ${formatValue(snapshot)}`,
		);
	}

	if (exact) {
		for (const [index, matcher] of expected.entries()) {
			if (!traceEntryMatches(snapshot[index], matcher, index, snapshot)) {
				throw new Error(
					`[igniteTest] Trace entry ${index + 1} did not match.\nExpected: ${formatValue(matcher)}\nReceived: ${formatValue(snapshot[index])}\nTrace: ${formatValue(snapshot)}`,
				);
			}
		}

		return snapshot;
	}

	let searchIndex = 0;

	for (const matcher of expected) {
		let matchedIndex = -1;

		for (let index = searchIndex; index < snapshot.length; index += 1) {
			if (traceEntryMatches(snapshot[index], matcher, index, snapshot)) {
				matchedIndex = index;
				break;
			}
		}

		if (matchedIndex === -1) {
			throw new Error(
				`[igniteTest] Trace expectation not found.\nExpected: ${formatValue(matcher)}\nTrace: ${formatValue(snapshot)}`,
			);
		}

		searchIndex = matchedIndex + 1;
	}

	return snapshot;
};

class IgniteTestDriver<
	State,
	Commands extends FacadeCommandResult,
	Events extends EventMap,
> implements IgniteTestScenario<State, Commands, Events>
{
	private lastResult: IgniteAgentExecutionResult<State, Events> | null = null;

	constructor(
		private readonly component: IgniteAgentRuntime<State, Commands, Events>,
	) {}

	given(expected: IgniteStateExpectation<State>) {
		assertState("given", this.component.getState(), expected);
		return this;
	}

	async when<CommandName extends keyof Commands & string>(
		commandName: CommandName,
		payload?: unknown,
	) {
		this.lastResult = await this.component.execute(
			commandName,
			payload as Parameters<Commands[CommandName]>[0],
		);
		return this;
	}

	expectState(expected: IgniteStateExpectation<State>) {
		const state = this.lastResult?.state ?? this.component.getState();
		assertState("expectState", state, expected);
		return this;
	}

	expectEvent<Type extends keyof Events & string>(
		type: Type,
		payload?: IgniteEventPayloadExpectation<EventPayload<Events[Type]>>,
	) {
		assertEvent(this.getResult().events, type, payload);
		return this;
	}

	expectEvents(expected: IgniteEventExpectation<Events>[]) {
		for (const event of expected) {
			assertEvent(this.getResult().events, event.type, event.payload);
		}

		return this;
	}

	expectNoEvents() {
		const { events } = this.getResult();

		if (events.length > 0) {
			throw new Error(
				`[igniteTest] Expected no events but received ${formatValue(events)}.`,
			);
		}

		return this;
	}

	getResult() {
		if (!this.lastResult) {
			throw new Error(
				"[igniteTest] No command has been executed yet. Call when() before asserting execution results.",
			);
		}

		return this.lastResult;
	}
}

function createTestScenario<
	Runtime extends {
		execute: unknown;
		getState: () => unknown;
	},
>(
	component: Runtime,
): IgniteTestScenario<
	RuntimeState<Runtime>,
	RuntimeCommands<Runtime>,
	RuntimeEvents<Runtime>
> {
	return new IgniteTestDriver(
		component as unknown as IgniteAgentRuntime<
			RuntimeState<Runtime>,
			RuntimeCommands<Runtime>,
			RuntimeEvents<Runtime>
		>,
	);
}

type IgniteTestFunction = typeof createTestScenario & IgniteTestHelpers;

export const test: IgniteTestFunction = Object.assign(createTestScenario, {
	serializeTrace,
	snapshotStory,
	expectTrace,
});

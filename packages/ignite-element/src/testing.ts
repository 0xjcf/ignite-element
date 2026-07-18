import type {
	EmptyEventMap,
	EventMap,
	EventMember,
	FacadeCommandResult,
} from "./RenderArgs";
import {
	type IgniteDomBridgeOptions,
	type IgniteDomBridgeSession,
	type IgniteRuntimeHostOverride,
	igniteDomBridgeSymbol,
	igniteRuntimeHostOverrideSymbol,
} from "./runtime/agent";
import { toSchemaValue } from "./runtime/schema";
import type {
	IgniteAgentExecutionResult,
	IgniteAgentRuntime,
	IgniteCommandCall,
	IgniteStory,
	IgniteStorySnapshot,
	IgniteStorySnapshotEvent,
	IgniteStorySummary,
	IgniteStorySummarySnapshot,
	IgniteStoryTraceEntry,
	IgniteStoryTraceSnapshot,
	IgniteStoryTraceSnapshotEntry,
	RuntimeEvent,
} from "./types/agent";
import type { IgniteSchemaValue } from "./types/schema";

type DeepPartial<T> = T extends readonly (infer Item)[]
	? readonly DeepPartial<Item>[]
	: T extends object
		? {
				[K in keyof T]?: DeepPartial<T[K]>;
			}
		: T;
export type IgniteSnapshotExpectation<State> =
	| DeepPartial<State>
	| ((snapshot: State) => boolean);

export type IgniteViewExpectation<View> =
	| DeepPartial<View>
	| ((view: View) => boolean);

export type IgniteEventExpectation<
	Events extends EventMap = EmptyEventMap,
	Type extends keyof Events & string = keyof Events & string,
> =
	| (Type extends keyof Events & string
			? { type: Type } & DeepPartial<Omit<EventMember<Events, Type>, "type">>
			: never)
	| ((event: EventMember<Events, Type>) => boolean);

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

export type IgniteTestScenarioOptions = {
	host?: HTMLElement;
};

export type IgniteDomRoleExpectation = {
	role: string;
	name?: string | RegExp | ((name: string, element: Element) => boolean);
	text?: string | RegExp | ((text: string, element: Element) => boolean);
	value?: string | RegExp | ((value: string, element: Element) => boolean);
};

export type IgniteDomBridge = {
	host: HTMLElement;
	root: ShadowRoot;
	getByRole: (
		role: string,
		options?: Omit<IgniteDomRoleExpectation, "role">,
	) => HTMLElement;
	queryByRole: (
		role: string,
		options?: Omit<IgniteDomRoleExpectation, "role">,
	) => HTMLElement | null;
	expectControls: (
		expected: readonly IgniteDomRoleExpectation[],
	) => HTMLElement[];
	stop: () => void;
};

export type IgniteTestScenario<
	State,
	Commands extends FacadeCommandResult = FacadeCommandResult,
	Events extends EventMap = EmptyEventMap,
	View extends Record<string, unknown> = Record<string, unknown>,
> = {
	given(
		expected: IgniteSnapshotExpectation<State>,
	): IgniteTestScenario<State, Commands, Events, View>;
	when<CommandName extends keyof Commands & string>(
		step: IgniteTestCommandStep<Commands, CommandName>,
	): Promise<IgniteTestScenario<State, Commands, Events, View>>;
	narrative<Name extends string>(
		name: Name,
		run: (
			narrative: IgniteTestNarrativeContext<State, Commands, Events, View>,
		) => Promise<unknown> | unknown,
	): Promise<IgniteStorySnapshot & { name: Name }>;
	expectSnapshot(
		expected: IgniteSnapshotExpectation<State>,
	): IgniteTestScenario<State, Commands, Events, View>;
	expectView(
		expected: IgniteViewExpectation<View>,
	): IgniteTestScenario<State, Commands, Events, View>;
	expectEvent<Type extends keyof Events & string>(
		expected: IgniteEventExpectation<Events, Type>,
	): IgniteTestScenario<State, Commands, Events, View>;
	expectEvents(
		expected: IgniteEventExpectation<Events>[],
	): IgniteTestScenario<State, Commands, Events, View>;
	expectNoEvents(): IgniteTestScenario<State, Commands, Events, View>;
	canExecute<CommandName extends keyof Commands & string>(
		commandName: CommandName,
	): boolean;
	getResult(): IgniteAgentExecutionResult<State, Events>;
};

export type IgniteTestHelpers = {
	accessibilityBridge: <
		Runtime extends {
			execute: unknown;
			getSnapshot: () => unknown;
		},
	>(
		component: Runtime,
		renderer: unknown,
		options?: IgniteDomBridgeOptions,
	) => IgniteDomBridge;
	expectControls: (
		bridge: IgniteDomBridge,
		expected: readonly IgniteDomRoleExpectation[],
	) => HTMLElement[];
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
	) => IgniteStorySnapshot;
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

type RuntimeView<Runtime> = (Runtime extends IgniteAgentRuntime<
	infer _State,
	infer _Commands,
	infer _Events,
	infer _SchemaState,
	infer View
>
	? View
	: Record<string, unknown>) &
	// Intersect so the result provably satisfies the `Record<string, unknown>`
	// constraint on the scenario/driver `View` param (the extracted projection
	// already does; this also clamps the deferred-generic case) while keeping the
	// projection's own keys typed.
	Record<string, unknown>;

export type IgniteTestCommandStep<
	Commands extends FacadeCommandResult,
	CommandName extends keyof Commands & string = keyof Commands & string,
> = IgniteCommandCall<Commands, CommandName>;

type IgniteTestNarrativeCheckpoint<
	State,
	Commands extends FacadeCommandResult,
	Events extends EventMap,
	View extends Record<string, unknown>,
> = {
	snapshot: State;
	view: View;
	events: RuntimeEvent<Events>[];
	canExecute<CommandName extends keyof Commands & string>(
		commandName: CommandName,
	): boolean;
};

type IgniteTestNarrativeCanExecuteExpectation<
	Commands extends FacadeCommandResult,
> = Partial<Record<keyof Commands & string, boolean>>;

type IgniteTestNarrativeAssertion<
	State,
	Commands extends FacadeCommandResult,
	Events extends EventMap,
	View extends Record<string, unknown>,
> = {
	snapshot?: IgniteSnapshotExpectation<State>;
	view?: IgniteViewExpectation<View>;
	event?: IgniteEventExpectation<Events>;
	events?: IgniteEventExpectation<Events>[];
	noEvents?: true;
	canExecute?: IgniteTestNarrativeCanExecuteExpectation<Commands>;
};

type IgniteTestNarrativeContext<
	State,
	Commands extends FacadeCommandResult,
	Events extends EventMap,
	View extends Record<string, unknown>,
> = {
	given(
		expected: Omit<
			IgniteTestNarrativeAssertion<State, Commands, Events, View>,
			"event" | "events" | "noEvents"
		>,
	): void;
	intent<CommandName extends keyof Commands & string>(
		step: IgniteTestCommandStep<Commands, CommandName>,
	): Promise<IgniteAgentExecutionResult<State, Events>>;
	checkpoint(
		name: string,
		expected: IgniteTestNarrativeAssertion<State, Commands, Events, View>,
	): void;
};

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

const normalizeWhitespace = (value: string): string =>
	value.replace(/\s+/g, " ").trim();

const normalizeSnapshotValue = (value: unknown): IgniteSchemaValue =>
	toSchemaValue(value) ?? null;

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
		case "snapshot":
			return { ...entry, snapshot: cloneSerializable(entry.snapshot) };
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

const matchesStringExpectation = (
	actual: string,
	expected: string | RegExp | ((value: string, element: Element) => boolean),
	element: Element,
): boolean => {
	if (typeof expected === "function") {
		return expected(actual, element);
	}

	if (expected instanceof RegExp) {
		return expected.test(actual);
	}

	return actual === normalizeWhitespace(expected);
};

const computeImplicitRole = (element: Element): string | null => {
	const tagName = element.tagName.toLowerCase();

	if (tagName === "button") {
		return "button";
	}

	if (tagName === "textarea") {
		return "textbox";
	}

	if (tagName === "a" && element.hasAttribute("href")) {
		return "link";
	}

	if (tagName === "input") {
		const input = element as HTMLInputElement;
		switch (input.type) {
			case "button":
			case "reset":
			case "submit":
				return "button";
			case "checkbox":
				return "checkbox";
			case "radio":
				return "radio";
			case "range":
				return "slider";
			case "email":
			case "password":
			case "search":
			case "tel":
			case "text":
			case "url":
				return "textbox";
			default:
				return null;
		}
	}

	return null;
};

const getElementRole = (element: Element): string | null =>
	element.getAttribute("role") ?? computeImplicitRole(element);

const getLabelledText = (element: Element, ids: string): string => {
	const root = element.getRootNode();
	const fragments = ids
		.split(/\s+/)
		.map((id) => {
			if (
				"getElementById" in root &&
				typeof root.getElementById === "function"
			) {
				return root.getElementById(id);
			}

			return element.ownerDocument?.getElementById(id) ?? null;
		})
		.filter((label): label is Element => Boolean(label))
		.map((label) => normalizeWhitespace(label.textContent ?? ""))
		.filter(Boolean);

	return fragments.join(" ").trim();
};

const getElementText = (element: Element): string =>
	normalizeWhitespace(element.textContent ?? "");

const getAccessibleName = (element: Element): string => {
	const ariaLabel = element.getAttribute("aria-label");
	if (ariaLabel) {
		return normalizeWhitespace(ariaLabel);
	}

	const labelledBy = element.getAttribute("aria-labelledby");
	if (labelledBy) {
		const name = getLabelledText(element, labelledBy);
		if (name) {
			return name;
		}
	}

	if (element instanceof HTMLInputElement) {
		const labels = Array.from(element.labels ?? []);
		if (labels.length > 0) {
			return normalizeWhitespace(
				labels.map((label) => label.textContent ?? "").join(" "),
			);
		}

		if (
			element.type === "button" ||
			element.type === "submit" ||
			element.type === "reset"
		) {
			return normalizeWhitespace(element.value);
		}
	}

	if (
		element instanceof HTMLTextAreaElement ||
		element instanceof HTMLSelectElement
	) {
		const labels = Array.from(element.labels ?? []);
		if (labels.length > 0) {
			return normalizeWhitespace(
				labels.map((label) => label.textContent ?? "").join(" "),
			);
		}
	}

	if (element instanceof HTMLImageElement && element.alt) {
		return normalizeWhitespace(element.alt);
	}

	const parentLabel = element.closest("label");
	if (parentLabel) {
		return getElementText(parentLabel);
	}

	return getElementText(element);
};

const getControlValue = (element: Element): string => {
	if (
		element instanceof HTMLInputElement ||
		element instanceof HTMLTextAreaElement ||
		element instanceof HTMLSelectElement
	) {
		return normalizeWhitespace(element.value);
	}

	if (element instanceof HTMLOutputElement) {
		return normalizeWhitespace(element.value || element.textContent || "");
	}

	return getElementText(element);
};

const findByRole = (
	root: ParentNode,
	role: string,
	options?: Omit<IgniteDomRoleExpectation, "role">,
): HTMLElement | null => {
	const normalizedRole = role.trim().toLowerCase();

	for (const node of root.querySelectorAll("*")) {
		if (!(node instanceof HTMLElement)) {
			continue;
		}

		if (getElementRole(node)?.toLowerCase() !== normalizedRole) {
			continue;
		}

		const accessibleName = getAccessibleName(node);
		if (
			typeof options?.name !== "undefined" &&
			!matchesStringExpectation(accessibleName, options.name, node)
		) {
			continue;
		}

		const text = getElementText(node);
		if (
			typeof options?.text !== "undefined" &&
			!matchesStringExpectation(text, options.text, node)
		) {
			continue;
		}

		const value = getControlValue(node);
		if (
			typeof options?.value !== "undefined" &&
			!matchesStringExpectation(value, options.value, node)
		) {
			continue;
		}

		return node;
	}

	return null;
};

const formatMissingControlError = (
	rendered: string,
	expectation: IgniteDomRoleExpectation,
): Error =>
	new Error(
		`[igniteTest] DOM control not found.\nExpected: ${formatValue(expectation)}\nRendered: ${formatValue(rendered)}`,
	);

const assertControl = (
	bridge: IgniteDomBridge,
	expectation: IgniteDomRoleExpectation,
): HTMLElement => {
	const element = bridge.queryByRole(expectation.role, expectation);

	if (!element) {
		throw formatMissingControlError(bridge.root.innerHTML, expectation);
	}

	return element;
};

const expectControls = (
	bridge: IgniteDomBridge,
	expected: readonly IgniteDomRoleExpectation[],
): HTMLElement[] =>
	expected.map((expectation) => assertControl(bridge, expectation));

const assertSnapshot = <State>(
	label: "given" | "expectSnapshot",
	snapshot: State,
	expected: IgniteSnapshotExpectation<State>,
) => {
	if (!valuesMatch(snapshot, expected)) {
		throw new Error(
			`[igniteTest] ${label} failed.\nExpected: ${formatValue(expected)}\nReceived: ${formatValue(snapshot)}`,
		);
	}
};

const assertView = <View>(
	view: View,
	expected: IgniteViewExpectation<View>,
) => {
	if (!valuesMatch(view, expected)) {
		throw new Error(
			`[igniteTest] expectView failed.\nExpected: ${formatValue(expected)}\nReceived: ${formatValue(view)}`,
		);
	}
};

const assertEvent = <
	Events extends EventMap,
	Type extends keyof Events & string,
>(
	events: RuntimeEvent<Events>[],
	expected: IgniteEventExpectation<Events, Type>,
) => {
	const matchedIndex = events.findIndex((event) =>
		valuesMatch(event, expected),
	);

	if (matchedIndex >= 0) {
		return matchedIndex;
	}

	const typeMatched =
		typeof expected === "function"
			? undefined
			: events.find((event) => event.type === expected.type);

	if (!typeMatched) {
		throw new Error(
			`[igniteTest] Expected event ${formatValue(expected)} but received ${formatValue(events)}.`,
		);
	}

	throw new Error(
		`[igniteTest] Event mismatch.\nExpected: ${formatValue(expected)}\nReceived: ${formatValue(typeMatched)}`,
	);
};

const assertCanExecute = <
	Commands extends FacadeCommandResult,
	CommandName extends keyof Commands & string,
>(
	commandName: CommandName,
	actual: boolean,
	expected: boolean,
) => {
	if (actual !== expected) {
		throw new Error(
			`[igniteTest] canExecute failed for "${commandName}".\nExpected: ${formatValue(expected)}\nReceived: ${formatValue(actual)}`,
		);
	}
};

const serializeTrace = (
	trace: readonly IgniteStoryTraceEntry[],
): IgniteStoryTraceSnapshot => trace.map(cloneTraceSnapshotEntry);

type IgniteNarrativeFailurePhase =
	| "given"
	| "intent"
	| "checkpoint"
	| "callback"
	| "cleanup";

type IgniteNarrativeFailure = Error & {
	__igniteNarrativeFailure: true;
};

const isIgniteNarrativeFailure = (
	error: unknown,
): error is IgniteNarrativeFailure =>
	error instanceof Error &&
	"__igniteNarrativeFailure" in error &&
	error.__igniteNarrativeFailure === true;

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
		summary: serializeSummary(story.summary()),
	}) satisfies IgniteStorySnapshot;

const serializeEvent = (event: RuntimeEvent): IgniteStorySnapshotEvent => {
	const snapshotEvent: IgniteStorySnapshotEvent = {
		type: event.type,
	};

	for (const [key, value] of Object.entries(event)) {
		if (key !== "type") {
			snapshotEvent[key] = normalizeSnapshotValue(value);
		}
	}

	return snapshotEvent;
};

const serializeSummary = <
	State,
	Events extends EventMap,
	View extends Record<string, unknown>,
>(
	summary: IgniteStorySummary<State, Events, View>,
): IgniteStorySummarySnapshot => ({
	name: summary.name,
	finalSnapshot: normalizeSnapshotValue(summary.finalSnapshot),
	finalView: normalizeSnapshotValue(summary.finalView),
	events: summary.events.map((event) => serializeEvent(event as RuntimeEvent)),
	commandCount: summary.commandCount,
	traceCount: summary.traceCount,
	lifecycleCount: summary.lifecycleCount,
});

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

const assertNarrativeAssertion = <
	State,
	Commands extends FacadeCommandResult,
	Events extends EventMap,
	View extends Record<string, unknown>,
>(
	assertion:
		| IgniteTestNarrativeAssertion<State, Commands, Events, View>
		| Omit<
				IgniteTestNarrativeAssertion<State, Commands, Events, View>,
				"event" | "events" | "noEvents"
		  >,
	checkpoint: IgniteTestNarrativeCheckpoint<State, Commands, Events, View>,
) => {
	if ("snapshot" in assertion && typeof assertion.snapshot !== "undefined") {
		assertSnapshot("expectSnapshot", checkpoint.snapshot, assertion.snapshot);
	}

	if ("view" in assertion && typeof assertion.view !== "undefined") {
		assertView(checkpoint.view, assertion.view);
	}

	if (
		"canExecute" in assertion &&
		typeof assertion.canExecute !== "undefined"
	) {
		for (const [commandName, expected] of Object.entries(
			assertion.canExecute,
		)) {
			if (typeof expected === "undefined") {
				continue;
			}

			assertCanExecute(
				commandName as keyof Commands & string,
				checkpoint.canExecute(commandName as keyof Commands & string),
				expected,
			);
		}
	}

	if ("noEvents" in assertion && assertion.noEvents) {
		if (checkpoint.events.length > 0) {
			throw new Error(
				`[igniteTest] Expected no events but received ${formatValue(checkpoint.events)}.`,
			);
		}
	}

	if ("event" in assertion && typeof assertion.event !== "undefined") {
		assertEvent(checkpoint.events, assertion.event);
	}

	if ("events" in assertion && typeof assertion.events !== "undefined") {
		const remainingEvents = [...checkpoint.events];
		for (const event of assertion.events) {
			const matchedIndex = assertEvent(remainingEvents, event);
			remainingEvents.splice(matchedIndex, 1);
		}
	}
};

const createNarrativeFailure = <
	State,
	Commands extends FacadeCommandResult,
	Events extends EventMap,
	View extends Record<string, unknown>,
>(
	narrativeName: string,
	phase: IgniteNarrativeFailurePhase,
	story: IgniteStory<State, Commands, Events, View>,
	error: unknown,
	options: {
		checkpointName?: string;
		intent?: IgniteCommandCall<Commands>;
	} = {},
): IgniteNarrativeFailure => {
	const lines = [
		`[igniteTest] Narrative "${narrativeName}" failed.`,
		`Phase: ${phase}`,
	];

	if (options.checkpointName) {
		lines.push(`Checkpoint: ${options.checkpointName}`);
	}

	if (options.intent) {
		lines.push(`Intent: ${formatValue(options.intent)}`);
	}

	lines.push(
		`Cause: ${error instanceof Error ? error.message : formatValue(error)}`,
		`Story: ${formatValue(snapshotStory(story))}`,
	);

	const narrativeError = new Error(
		lines.join("\n"),
	) as IgniteNarrativeFailure & {
		cause?: Error;
	};
	if (error instanceof Error) {
		narrativeError.cause = error;
	}
	narrativeError.__igniteNarrativeFailure = true;
	return narrativeError;
};

class IgniteTestDriver<
	State,
	Commands extends FacadeCommandResult,
	Events extends EventMap,
	View extends Record<string, unknown> = Record<string, unknown>,
> implements IgniteTestScenario<State, Commands, Events, View>
{
	private lastResult: IgniteAgentExecutionResult<State, Events> | null = null;

	constructor(
		private readonly component: IgniteAgentRuntime<
			State,
			Commands,
			Events,
			unknown,
			View
		>,
		private readonly options: IgniteTestScenarioOptions = {},
	) {}

	private withHost<Result>(callback: () => Result): Result {
		const { host } = this.options;
		if (!host) {
			return callback();
		}

		const hostOverride = (
			this.component as IgniteAgentRuntime<State, Commands, Events> & {
				[igniteRuntimeHostOverrideSymbol]?: IgniteRuntimeHostOverride;
			}
		)[igniteRuntimeHostOverrideSymbol];

		if (!hostOverride) {
			throw new Error(
				"[igniteTest] Host option is only available on Ignite component runtimes.",
			);
		}

		return hostOverride(host, callback);
	}

	given(expected: IgniteSnapshotExpectation<State>) {
		assertSnapshot(
			"given",
			this.withHost(() => this.component.getSnapshot()),
			expected,
		);
		return this;
	}

	async when<CommandName extends keyof Commands & string>(
		step: IgniteTestCommandStep<Commands, CommandName>,
	) {
		this.lastResult = await this.withHost(() => this.component.execute(step));
		return this;
	}

	async narrative<Name extends string>(
		name: Name,
		run: (
			narrative: IgniteTestNarrativeContext<State, Commands, Events, View>,
		) => Promise<unknown> | unknown,
	): Promise<IgniteStorySnapshot & { name: Name }> {
		const story = this.withHost(() => this.component.record(name));
		let lastEvents: RuntimeEvent<Events>[] = [];
		let primaryError: unknown;
		let cleanupError: IgniteNarrativeFailure | undefined;
		let receipt: IgniteStorySnapshot | undefined;

		const narrative: IgniteTestNarrativeContext<State, Commands, Events, View> =
			{
				given: (expected) => {
					try {
						assertNarrativeAssertion(expected, {
							snapshot: this.withHost(() => this.component.getSnapshot()),
							view: this.withHost(() => this.component.getView()),
							events: [],
							canExecute: (commandName) =>
								this.withHost(() => story.canExecute(commandName)),
						});
					} catch (error) {
						throw createNarrativeFailure(name, "given", story, error);
					}
				},
				intent: async (step) => {
					try {
						const result = await this.withHost(() => story.execute(step));
						this.lastResult = result;
						lastEvents = cloneSerializable(
							result.events,
						) as RuntimeEvent<Events>[];
						return result;
					} catch (error) {
						throw createNarrativeFailure(name, "intent", story, error, {
							intent: step,
						});
					}
				},
				checkpoint: (checkpointName, expected) => {
					try {
						assertNarrativeAssertion(expected, {
							snapshot: this.withHost(() => this.component.getSnapshot()),
							view: this.withHost(() => this.component.getView()),
							events: cloneSerializable(lastEvents) as RuntimeEvent<Events>[],
							canExecute: (commandName) =>
								this.withHost(() => story.canExecute(commandName)),
						});
					} catch (error) {
						throw createNarrativeFailure(name, "checkpoint", story, error, {
							checkpointName,
						});
					}
				},
			};

		try {
			await run(narrative);
			receipt = this.withHost(() => snapshotStory(story));
		} catch (error) {
			primaryError = error;
			if (isIgniteNarrativeFailure(error)) {
				throw error;
			}

			throw createNarrativeFailure(name, "callback", story, error);
		} finally {
			try {
				story.stop();
			} catch (error) {
				if (!primaryError) {
					cleanupError = createNarrativeFailure(name, "cleanup", story, error);
				}
			}
		}

		if (cleanupError) {
			throw cleanupError;
		}

		return receipt as IgniteStorySnapshot & { name: Name };
	}

	expectSnapshot(expected: IgniteSnapshotExpectation<State>) {
		const snapshot = this.lastResult
			? this.lastResult.snapshot
			: this.withHost(() => this.component.getSnapshot());
		assertSnapshot("expectSnapshot", snapshot, expected);
		return this;
	}

	expectView(expected: IgniteViewExpectation<View>) {
		// Mirrors the runtime's getView(): the projected view after the last
		// command (execute awaits, so getView() reflects it). The execution result
		// carries no view, so getView() is the single source.
		assertView(
			this.withHost(() => this.component.getView()),
			expected,
		);
		return this;
	}

	expectEvent<Type extends keyof Events & string>(
		expected: IgniteEventExpectation<Events, Type>,
	) {
		assertEvent(this.getResult().events, expected);
		return this;
	}

	expectEvents(expected: IgniteEventExpectation<Events>[]) {
		const remainingEvents = [...this.getResult().events];

		for (const event of expected) {
			const matchedIndex = assertEvent(remainingEvents, event);
			remainingEvents.splice(matchedIndex, 1);
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

	canExecute<CommandName extends keyof Commands & string>(
		commandName: CommandName,
	) {
		return this.withHost(() => this.component.canExecute(commandName));
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
		getSnapshot: () => unknown;
	},
>(
	component: Runtime,
	options?: IgniteTestScenarioOptions,
): IgniteTestScenario<
	RuntimeState<Runtime>,
	RuntimeCommands<Runtime>,
	RuntimeEvents<Runtime>,
	RuntimeView<Runtime>
> {
	return new IgniteTestDriver(
		component as unknown as IgniteAgentRuntime<
			RuntimeState<Runtime>,
			RuntimeCommands<Runtime>,
			RuntimeEvents<Runtime>,
			unknown,
			RuntimeView<Runtime>
		>,
		options,
	);
}

type IgniteTestFunction = typeof createTestScenario & IgniteTestHelpers;

export const test: IgniteTestFunction = Object.assign(createTestScenario, {
	accessibilityBridge(
		component: {
			execute: unknown;
			getSnapshot: () => unknown;
		},
		renderer: unknown,
		options?: IgniteDomBridgeOptions,
	) {
		const createBridge = (
			component as {
				[igniteDomBridgeSymbol]?: (
					rendererValue: unknown,
					bridgeOptions?: IgniteDomBridgeOptions,
				) => IgniteDomBridgeSession;
			}
		)[igniteDomBridgeSymbol];

		if (!createBridge) {
			throw new Error(
				"[igniteTest] DOM accessibility bridge is only available on Ignite component runtimes.",
			);
		}

		const session = createBridge(renderer, options);
		const bridge: IgniteDomBridge = {
			host: session.host,
			root: session.root,
			getByRole(role, roleOptions) {
				const element = findByRole(session.root, role, roleOptions);
				if (!element) {
					throw formatMissingControlError(session.root.innerHTML, {
						role,
						...roleOptions,
					});
				}

				return element;
			},
			queryByRole(role, roleOptions) {
				return findByRole(session.root, role, roleOptions);
			},
			expectControls(expected) {
				return expectControls(bridge, expected);
			},
			stop() {
				session.stop();
			},
		};

		return bridge;
	},
	expectControls,
	serializeTrace,
	snapshotStory,
	expectTrace,
});

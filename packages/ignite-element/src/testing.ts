import type {
	EmptyEventMap,
	EventMap,
	EventPayload,
	FacadeCommandResult,
} from "./RenderArgs";
import {
	type IgniteDomBridgeOptions,
	type IgniteDomBridgeSession,
	igniteDomBridgeSymbol,
} from "./runtime/agent";
import { toSchemaValue } from "./runtime/schema";
import type {
	IgniteAgentExecutionResult,
	IgniteAgentRuntime,
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
	accessibilityBridge: <
		Runtime extends {
			execute: unknown;
			getState: () => unknown;
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
		summary: serializeSummary(story.summary()),
	}) satisfies IgniteStorySnapshot;

const serializeEvent = (event: RuntimeEvent): IgniteStorySnapshotEvent => {
	const snapshotEvent: IgniteStorySnapshotEvent = {
		type: event.type,
	};

	if ("payload" in event) {
		snapshotEvent.payload = normalizeSnapshotValue(event.payload);
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
	finalState: normalizeSnapshotValue(summary.finalState),
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
		assertState("given", this.component.getSnapshot(), expected);
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
		const state = this.lastResult?.state ?? this.component.getSnapshot();
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
	accessibilityBridge(
		component: {
			execute: unknown;
			getState: () => unknown;
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

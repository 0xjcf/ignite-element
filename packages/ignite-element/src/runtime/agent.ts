import type { IgniteAdapter } from "@ignite-element/core";
import type {
	IgniteAgentSubscription,
	IgniteStory,
	IgniteStoryCommandTraceEntry,
	IgniteStoryEventTraceEntry,
	IgniteStoryLifecycleEntry,
	IgniteStoryStateTraceEntry,
	IgniteStoryTraceEntry,
	IgniteStoryViewTraceEntry,
} from "../types/agent";
import type { IgniteSchemaValue } from "../types/schema";
import { commandMetadataSymbol } from "./commands";
import { toSchemaValue } from "./schema";

// Reads the discriminant `type` of a source-emitted event (the adapter's
// optional `subscribeEvents()` seam yields plain `{ type, ... }` objects).
function emittedEventType(event: unknown): string | undefined {
	if (typeof event === "object" && event !== null && "type" in event) {
		return String((event as { type: unknown }).type);
	}
	return undefined;
}

type RuntimeResources<
	State,
	Event,
	AdditionalArgs extends Record<string, unknown>,
> = {
	adapter: IgniteAdapter<State, Event>;
	additionalArgs: AdditionalArgs;
	host: HTMLElement;
};

type AgentRuntimeOptions<
	State,
	Event,
	View extends Record<string, unknown>,
	AdditionalArgs extends Record<string, unknown>,
> = {
	eventTypes: readonly string[];
	observeLifecycle?: (
		handler: (entry: IgniteStoryLifecycleEntry) => void,
	) => IgniteAgentSubscription;
	createDomBridge?: (
		renderer: unknown,
		options?: IgniteDomBridgeOptions,
	) => IgniteDomBridgeSession;
	resolveRuntime: () => RuntimeResources<State, Event, AdditionalArgs>;
	resolveView: (adapter: IgniteAdapter<State, Event>) => View;
};

const defaultUntilMaxSteps = 50;

export type IgniteDomBridgeOptions = {
	elementName?: string;
};

export type IgniteDomBridgeSession = {
	host: HTMLElement;
	root: ShadowRoot;
	stop: () => void;
};

export const igniteDomBridgeSymbol = Symbol("ignite-element.dom-bridge");

type IgniteStoryTraceEntryDraft =
	| Omit<IgniteStoryCommandTraceEntry, "sequence">
	| Omit<IgniteStoryEventTraceEntry, "sequence">
	| Omit<IgniteStoryStateTraceEntry, "sequence">
	| Omit<IgniteStoryViewTraceEntry, "sequence">;

function getCommandContract(
	commandValue: unknown,
): Record<string, IgniteSchemaValue> | undefined {
	if (typeof commandValue !== "function") {
		return undefined;
	}

	const metadata = toSchemaValue(
		Reflect.get(commandValue, commandMetadataSymbol),
	);

	if (
		typeof metadata === "undefined" ||
		metadata === null ||
		Array.isArray(metadata) ||
		typeof metadata !== "object"
	) {
		return undefined;
	}

	return metadata;
}

function normalizeTraceValue(value: unknown): IgniteSchemaValue {
	return toSchemaValue(value) ?? null;
}

function cloneSchemaValue(value: IgniteSchemaValue): IgniteSchemaValue {
	return JSON.parse(JSON.stringify(value)) as IgniteSchemaValue;
}

function cloneTraceEntry(entry: IgniteStoryTraceEntry): IgniteStoryTraceEntry {
	switch (entry.kind) {
		case "command":
			return typeof entry.payload === "undefined"
				? { ...entry }
				: { ...entry, payload: cloneSchemaValue(entry.payload) };
		case "event":
			return { ...entry, payload: cloneSchemaValue(entry.payload) };
		case "state":
			return { ...entry, state: cloneSchemaValue(entry.state) };
		case "view":
			return { ...entry, view: cloneSchemaValue(entry.view) };
	}
}

function cloneLifecycleEntry(
	entry: IgniteStoryLifecycleEntry,
): IgniteStoryLifecycleEntry {
	return { ...entry };
}

export function createAgentRuntime<
	State,
	Event,
	View extends Record<string, unknown>,
	AdditionalArgs extends Record<string, unknown>,
>({
	createDomBridge,
	eventTypes,
	observeLifecycle,
	resolveRuntime,
	resolveView,
}: AgentRuntimeOptions<State, Event, View, AdditionalArgs>) {
	const createWatcher = <Value>(
		resolveCurrent: (adapter: IgniteAdapter<State, Event>) => Value,
		handler: (value: Value, prevValue: Value) => void,
	) => {
		const { adapter } = resolveRuntime();
		let prevValue = resolveCurrent(adapter);
		let seeded = false;

		const subscription = adapter.subscribeSnapshots(() => {
			const nextValue = resolveCurrent(adapter);
			if (!seeded) {
				seeded = true;
				prevValue = nextValue;
				return;
			}

			const lastValue = prevValue;
			prevValue = nextValue;
			handler(nextValue, lastValue);
		});

		return {
			unsubscribe: () => {
				subscription.unsubscribe();
			},
		};
	};

	const on = (
		eventName: string,
		handler: (event: CustomEvent<unknown>) => void,
	) => {
		const { host, adapter } = resolveRuntime();
		const listener = (event: Event) => {
			handler(event as CustomEvent<unknown>);
		};

		host.addEventListener(eventName, listener as EventListener);

		// Bridge source-emitted events (the adapter's optional `subscribeEvents()`
		// seam) to this listener with the uniform `{ type, payload }` shape
		// (payload = the emitted event). Effects-emitted events keep arriving via
		// the host above.
		const eventsSubscription = adapter.subscribeEvents?.((event: unknown) => {
			if (emittedEventType(event) === eventName) {
				handler(new CustomEvent(eventName, { detail: event }));
			}
		});

		return {
			unsubscribe: () => {
				host.removeEventListener(eventName, listener as EventListener);
				eventsSubscription?.unsubscribe();
			},
		};
	};

	const watchSnapshot = (
		handler: (snapshot: State, prevSnapshot: State) => void,
	) => {
		return createWatcher((adapter) => adapter.getSnapshot(), handler);
	};

	const watchView = (handler: (view: View, prevView: View) => void) => {
		return createWatcher(resolveView, handler);
	};

	const executeCommand = async (commandName: string, payload?: unknown) => {
		const { adapter, additionalArgs, host } = resolveRuntime();
		const command = (additionalArgs as Record<string, unknown>)[commandName];

		if (typeof command !== "function") {
			throw new Error(`[igniteCore] Unknown command "${commandName}".`);
		}

		const events: Array<{ type: string; payload: unknown }> = [];
		const listeners = eventTypes.map((eventType) => {
			const listener = (event: Event) => {
				const customEvent = event as CustomEvent<unknown>;
				events.push({
					type: customEvent.type,
					payload: customEvent.detail,
				});
			};

			host.addEventListener(eventType, listener as EventListener);
			return { eventType, listener };
		});

		// Capture source-emitted events (the adapter's optional `subscribeEvents()`
		// seam) during the command window — independent of the declared
		// `eventTypes`, so dynamic emit types are collected with the uniform
		// `{ type, payload }` shape.
		const sourceSubscription = adapter.subscribeEvents?.((event: unknown) => {
			const type = emittedEventType(event);
			if (type !== undefined) {
				events.push({ type, payload: event });
			}
		});

		try {
			await (command as (arg?: unknown) => unknown)(payload);

			// Flush microtask to allow post-render effects to emit events
			await new Promise<void>((resolve) => queueMicrotask(resolve));

			return {
				state: adapter.getSnapshot(),
				events,
			};
		} finally {
			for (const { eventType, listener } of listeners) {
				host.removeEventListener(eventType, listener as EventListener);
			}
			sourceSubscription?.unsubscribe();
		}
	};

	const record = (name: string) => {
		const traceEntries: IgniteStoryTraceEntry[] = [];
		const lifecycleEntries: IgniteStoryLifecycleEntry[] = [];
		const emittedEvents: Array<{ type: string; payload: unknown }> = [];
		let active = true;
		let commandCount = 0;
		let traceSequence = 0;

		const lifecycleSubscription = observeLifecycle?.((entry) => {
			if (!active) {
				return;
			}

			lifecycleEntries.push(cloneLifecycleEntry(entry));
		});

		const assertActive = () => {
			if (!active) {
				throw new Error(`[igniteCore] Story "${name}" has been stopped.`);
			}
		};

		const pushTrace = (entry: IgniteStoryTraceEntryDraft) => {
			traceSequence += 1;
			traceEntries.push({
				sequence: traceSequence,
				...entry,
			} as IgniteStoryTraceEntry);
		};

		const copyEvents = () =>
			emittedEvents.map((event) => ({
				type: event.type,
				payload: event.payload,
			}));

		const story = {
			name,
			async execute(commandName: string, payload?: unknown) {
				assertActive();
				const step = commandCount + 1;
				const beforeState = resolveRuntime().adapter.getSnapshot();
				const beforeView = resolveView(resolveRuntime().adapter);
				const normalizedPayload = normalizeTraceValue(payload);

				if (typeof payload === "undefined") {
					pushTrace({
						kind: "command",
						step,
						command: commandName,
					});
				} else {
					pushTrace({
						kind: "command",
						step,
						command: commandName,
						payload: normalizedPayload,
					});
				}
				pushTrace({
					kind: "state",
					step,
					phase: "before",
					state: normalizeTraceValue(beforeState),
				});
				pushTrace({
					kind: "view",
					step,
					phase: "before",
					view: normalizeTraceValue(beforeView),
				});

				const result = await executeCommand(commandName, payload);

				for (const event of result.events) {
					emittedEvents.push({
						type: event.type,
						payload: event.payload,
					});
					pushTrace({
						kind: "event",
						step,
						event: event.type,
						payload: normalizeTraceValue(event.payload),
					});
				}

				pushTrace({
					kind: "state",
					step,
					phase: "after",
					state: normalizeTraceValue(result.state),
				});
				pushTrace({
					kind: "view",
					step,
					phase: "after",
					view: normalizeTraceValue(resolveView(resolveRuntime().adapter)),
				});

				commandCount = step;
				return result;
			},
			async until(
				viewPredicate: (view: View) => boolean,
				action: (
					story: IgniteStory<
						State,
						Record<string, (...args: never[]) => unknown>,
						Record<string, never>,
						View
					>,
					view: View,
					iteration: number,
				) => unknown,
				options?: { maxSteps?: number },
			) {
				assertActive();
				const maxSteps = options?.maxSteps ?? defaultUntilMaxSteps;

				if (!Number.isInteger(maxSteps) || maxSteps < 1) {
					throw new Error(
						`[igniteCore] Story "${name}" until(...) maxSteps must be a positive integer.`,
					);
				}

				let iterations = 0;
				let view = resolveView(resolveRuntime().adapter);

				while (!viewPredicate(view)) {
					if (iterations >= maxSteps) {
						throw new Error(
							`[igniteCore] Story "${name}" until(...) exceeded maxSteps (${maxSteps}).`,
						);
					}

					await action(story as never, view, iterations);
					iterations += 1;
					view = resolveView(resolveRuntime().adapter);
					// Flush microtask to allow effects to emit events
					await new Promise<void>((resolve) => queueMicrotask(resolve));
				}

				return view;
			},
			trace() {
				return traceEntries.map(cloneTraceEntry);
			},
			lifecycle() {
				return lifecycleEntries.map(cloneLifecycleEntry);
			},
			summary() {
				return {
					name,
					finalState: resolveRuntime().adapter.getSnapshot(),
					finalView: resolveView(resolveRuntime().adapter),
					events: copyEvents(),
					commandCount,
					traceCount: traceEntries.length,
					lifecycleCount: lifecycleEntries.length,
				};
			},
			stop() {
				if (!active) {
					return;
				}

				active = false;
				lifecycleSubscription?.unsubscribe();
			},
		};

		return story;
	};

	const runtime = {
		execute: executeCommand,
		getSnapshot() {
			return resolveRuntime().adapter.getSnapshot();
		},
		getView() {
			return resolveView(resolveRuntime().adapter);
		},
		getSchema() {
			const { adapter, additionalArgs } = resolveRuntime();
			const commandEntries = Object.entries(additionalArgs).filter(
				([, value]) => typeof value === "function",
			);
			const commands = Object.fromEntries(
				commandEntries
					.map(
						([name, value]) => [name, getCommandContract(value) ?? {}] as const,
					)
					.sort(([left], [right]) => left.localeCompare(right)),
			);

			return {
				commands,
				events: [...eventTypes].sort(),
				state: (toSchemaValue(adapter.getSnapshot()) ?? null) as Exclude<
					ReturnType<typeof toSchemaValue>,
					undefined
				>,
			};
		},
		on,
		record,
		watchSnapshot,
		watchView,
	};

	if (createDomBridge) {
		Object.assign(runtime, {
			[igniteDomBridgeSymbol]: createDomBridge,
		});
	}

	return runtime;
}

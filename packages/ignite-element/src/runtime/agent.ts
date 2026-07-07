import type { CommandMetadata, IgniteAdapter } from "@ignite-element/core";
import type {
	IgniteAgentSubscription,
	IgniteStory,
	IgniteStoryCommandTraceEntry,
	IgniteStoryEventTraceEntry,
	IgniteStoryLifecycleEntry,
	IgniteStorySnapshotTraceEntry,
	IgniteStoryTraceEntry,
	IgniteStoryViewTraceEntry,
} from "../types/agent";
import type { IgniteSchemaValue } from "../types/schema";
import { commandMetadataSymbol } from "./commands";
import { toSchemaValue } from "./schema";

type RuntimeEventMember = {
	type: string;
	[key: string]: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
	if (!isRecord(value)) {
		return false;
	}

	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function domEventToRuntimeEvent(event: globalThis.Event): RuntimeEventMember {
	const detail = "detail" in event ? event.detail : undefined;

	if (isPlainRecord(detail)) {
		return { ...detail, type: event.type };
	}

	if (typeof detail === "undefined") {
		return { type: event.type };
	}

	return { type: event.type, detail };
}

function sourceEventToRuntimeEvent(
	event: unknown,
): RuntimeEventMember | undefined {
	if (!isPlainRecord(event) || typeof event.type !== "string") {
		return undefined;
	}

	return {
		...event,
		type: event.type,
	};
}

function cloneFallbackValue(
	value: unknown,
	seen: WeakMap<object, unknown> = new WeakMap(),
): unknown {
	switch (typeof value) {
		case "boolean":
		case "number":
		case "string":
		case "bigint":
			return value;
		case "symbol":
			return value.toString();
		case "function":
			return "[Function]";
		case "undefined":
			return undefined;
		case "object": {
			if (value === null) {
				return null;
			}

			const cached = seen.get(value);
			if (cached) {
				return cached;
			}

			if (value instanceof Date) {
				return value.toISOString();
			}

			if (Array.isArray(value)) {
				const cloned: unknown[] = [];
				seen.set(value, cloned);
				for (const item of value) {
					cloned.push(cloneFallbackValue(item, seen));
				}
				return cloned;
			}

			const cloned: Record<string, unknown> = {};
			seen.set(value, cloned);
			for (const [key, entry] of Object.entries(
				value as Record<string, unknown>,
			)) {
				const clonedEntry = cloneFallbackValue(entry, seen);
				if (typeof clonedEntry !== "undefined") {
					cloned[key] = clonedEntry;
				}
			}
			return cloned;
		}
		default:
			return String(value);
	}
}

function cloneValue(value: unknown): unknown {
	if (typeof globalThis.structuredClone === "function") {
		try {
			return globalThis.structuredClone(value);
		} catch {
			// Fall back to schema normalization for non-cloneable event payloads.
		}
	}

	const normalized = toSchemaValue(value);
	return typeof normalized === "undefined"
		? cloneFallbackValue(value)
		: normalized;
}

function cloneRuntimeEvent(event: RuntimeEventMember): RuntimeEventMember {
	const cloned = cloneValue(event);
	return isPlainRecord(cloned) && typeof cloned.type === "string"
		? { ...cloned, type: cloned.type }
		: { type: event.type, detail: cloneValue(event) };
}

function eventFields(event: RuntimeEventMember): Record<string, unknown> {
	const { type: _type, ...fields } = event;
	return fields;
}

type RuntimeResources<
	State,
	Event,
	AdditionalArgs extends Record<string, unknown>,
> = {
	adapter: IgniteAdapter<State, Event>;
	additionalArgs: AdditionalArgs;
	host: EventTarget;
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
	retainRuntimeAccess?: () => void;
	releaseRuntimeAccess?: () => void;
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
export const igniteRuntimeHostOverrideSymbol = Symbol(
	"ignite-element.runtime-host-override",
);

export type IgniteRuntimeHostOverride = <Result>(
	host: EventTarget,
	callback: () => Result,
) => Result;

type IgniteStoryTraceEntryDraft =
	| Omit<IgniteStoryCommandTraceEntry, "sequence">
	| Omit<IgniteStoryEventTraceEntry, "sequence">
	| Omit<IgniteStorySnapshotTraceEntry, "sequence">
	| Omit<IgniteStoryViewTraceEntry, "sequence">;

function getCommandContract(
	commandValue: unknown,
): Record<string, IgniteSchemaValue> | undefined {
	const metadata = getCommandMetadata(commandValue);
	if (!metadata) {
		return undefined;
	}

	const contract = toSchemaValue(metadata);
	const commandContract =
		contract !== null &&
		typeof contract === "object" &&
		!Array.isArray(contract)
			? contract
			: undefined;

	if (hasCanExecute(metadata)) {
		return {
			...(commandContract ?? {}),
			gated: true,
		};
	}

	return commandContract;
}

function getCommandMetadata(
	commandValue: unknown,
): CommandMetadata | undefined {
	if (typeof commandValue !== "function") {
		return undefined;
	}

	const metadata = Reflect.get(commandValue, commandMetadataSymbol);

	if (
		typeof metadata === "undefined" ||
		metadata === null ||
		Array.isArray(metadata) ||
		typeof metadata !== "object"
	) {
		return undefined;
	}

	return metadata as CommandMetadata;
}

function hasCanExecute(
	metadata: CommandMetadata | undefined,
): metadata is CommandMetadata & {
	canExecute: NonNullable<CommandMetadata["canExecute"]>;
} {
	return typeof metadata?.canExecute === "function";
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
		case "snapshot":
			return { ...entry, snapshot: cloneSchemaValue(entry.snapshot) };
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
	retainRuntimeAccess,
	releaseRuntimeAccess,
	resolveRuntime,
	resolveView,
}: AgentRuntimeOptions<State, Event, View, AdditionalArgs>) {
	const isThenable = (value: unknown): value is PromiseLike<unknown> =>
		(typeof value === "object" || typeof value === "function") &&
		value !== null &&
		"then" in value &&
		typeof (value as { then?: unknown }).then === "function";
	const releaseAfterSuccess = (message: string) => {
		try {
			releaseRuntimeAccess?.();
		} catch (error) {
			console.error(message, error);
		}
	};
	const releaseAfterError = (message: string) => {
		try {
			releaseRuntimeAccess?.();
		} catch (error) {
			console.error(message, error);
		}
	};
	const runCleanup = (message: string, cleanup: () => void) => {
		try {
			cleanup();
		} catch (error) {
			console.error(message, error);
		}
	};
	const withRuntimeAccess = <Result>(callback: () => Result): Result => {
		retainRuntimeAccess?.();
		try {
			const result = callback();
			if (isThenable(result)) {
				return result.then(
					(value) => {
						releaseAfterSuccess(
							"[igniteCore] Runtime access release failed after callback resolution.",
						);
						return value;
					},
					(error) => {
						releaseAfterError(
							"[igniteCore] Runtime access release failed after callback error.",
						);
						throw error;
					},
				) as Result;
			}

			releaseAfterSuccess(
				"[igniteCore] Runtime access release failed after callback completion.",
			);
			return result;
		} catch (error) {
			releaseAfterError(
				"[igniteCore] Runtime access release failed after callback error.",
			);
			throw error;
		}
	};
	const withSynchronousRuntimeAccess = <Result>(
		callback: () => Result,
	): Result => {
		retainRuntimeAccess?.();
		try {
			const result = callback();
			releaseAfterSuccess(
				"[igniteCore] Runtime access release failed after callback completion.",
			);
			return result;
		} catch (error) {
			releaseAfterError(
				"[igniteCore] Runtime access release failed after callback error.",
			);
			throw error;
		}
	};
	const createWatcher = <Value>(
		resolveCurrent: (adapter: IgniteAdapter<State, Event>) => Value,
		handler: (value: Value, prevValue: Value) => void,
	) => {
		retainRuntimeAccess?.();
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
				try {
					subscription.unsubscribe();
				} finally {
					releaseRuntimeAccess?.();
				}
			},
		};
	};

	const on = (
		eventName: string,
		handler: (event: RuntimeEventMember) => void,
	) => {
		retainRuntimeAccess?.();
		let host: EventTarget | undefined;
		let eventsSubscription: IgniteAgentSubscription | undefined;
		let listener: EventListener | undefined;

		try {
			const runtime = resolveRuntime();
			host = runtime.host;
			const { adapter } = runtime;
			listener = (event: globalThis.Event) => {
				handler(domEventToRuntimeEvent(event));
			};

			host.addEventListener(eventName, listener);

			// Bridge source-emitted events (the adapter's optional `subscribeEvents()`
			// seam) to this listener with the same flat member shape as effects.
			eventsSubscription = adapter.subscribeEvents?.((event: unknown) => {
				const member = sourceEventToRuntimeEvent(event);
				if (member?.type === eventName) {
					handler(member);
				}
			});
		} catch (error) {
			runCleanup(
				"[igniteCore] Event listener cleanup failed after listener setup error.",
				() => {
					if (host && listener) {
						host.removeEventListener(eventName, listener);
					}
				},
			);
			runCleanup(
				"[igniteCore] Source event subscription cleanup failed after listener setup error.",
				() => eventsSubscription?.unsubscribe(),
			);
			releaseAfterError(
				"[igniteCore] Runtime access release failed after listener setup error.",
			);
			throw error;
		}

		return {
			unsubscribe: () => {
				runCleanup("[igniteCore] Event listener cleanup failed.", () => {
					if (host && listener) {
						host.removeEventListener(eventName, listener);
					}
				});
				runCleanup(
					"[igniteCore] Source event subscription cleanup failed.",
					() => eventsSubscription?.unsubscribe(),
				);
				releaseAfterSuccess(
					"[igniteCore] Runtime access release failed after listener cleanup.",
				);
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

	const canExecuteCommand = (commandName: string) =>
		withRuntimeAccess(() => {
			const { adapter, additionalArgs } = resolveRuntime();
			const command = (additionalArgs as Record<string, unknown>)[commandName];

			if (typeof command !== "function") {
				throw new Error(`[igniteCore] Unknown command "${commandName}".`);
			}

			const metadata = getCommandMetadata(command);
			if (!hasCanExecute(metadata)) {
				return true;
			}

			return metadata.canExecute({ snapshot: adapter.getSnapshot() });
		});

	const executeCommand = async (commandName: string, payload?: unknown) =>
		withRuntimeAccess(async () => {
			const { adapter, additionalArgs, host } = resolveRuntime();
			const command = (additionalArgs as Record<string, unknown>)[commandName];

			if (typeof command !== "function") {
				throw new Error(`[igniteCore] Unknown command "${commandName}".`);
			}

			const events: RuntimeEventMember[] = [];
			const listeners: Array<{
				eventType: string;
				listener: EventListener;
			}> = [];
			let sourceSubscription: IgniteAgentSubscription | undefined;

			try {
				for (const eventType of eventTypes) {
					const listener: EventListener = (event: globalThis.Event) => {
						events.push(domEventToRuntimeEvent(event));
					};

					host.addEventListener(eventType, listener);
					listeners.push({ eventType, listener });
				}

				// Capture source-emitted events during the command window independent of
				// declared eventTypes, so dynamic emit types are collected as flat members.
				sourceSubscription = adapter.subscribeEvents?.((event: unknown) => {
					const member = sourceEventToRuntimeEvent(event);
					if (member) {
						events.push(member);
					}
				});

				await (command as (arg?: unknown) => unknown)(payload);

				// Flush microtask to allow post-render effects to emit events
				await new Promise<void>((resolve) => queueMicrotask(resolve));

				return {
					snapshot: adapter.getSnapshot(),
					events,
				};
			} finally {
				for (const { eventType, listener } of listeners) {
					runCleanup(
						"[igniteCore] Event listener cleanup failed after command execution.",
						() =>
							host.removeEventListener(eventType, listener as EventListener),
					);
				}
				runCleanup(
					"[igniteCore] Source event subscription cleanup failed after command execution.",
					() => sourceSubscription?.unsubscribe(),
				);
			}
		});

	const record = (name: string) => {
		const traceEntries: IgniteStoryTraceEntry[] = [];
		const lifecycleEntries: IgniteStoryLifecycleEntry[] = [];
		const emittedEvents: RuntimeEventMember[] = [];
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
			emittedEvents.map((event) => cloneRuntimeEvent(event));

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
					kind: "snapshot",
					step,
					phase: "before",
					snapshot: normalizeTraceValue(beforeState),
				});
				pushTrace({
					kind: "view",
					step,
					phase: "before",
					view: normalizeTraceValue(beforeView),
				});

				const result = await executeCommand(commandName, payload);

				for (const event of result.events) {
					emittedEvents.push(cloneRuntimeEvent(event));
					pushTrace({
						kind: "event",
						step,
						event: event.type,
						payload: normalizeTraceValue(eventFields(event)),
					});
				}

				pushTrace({
					kind: "snapshot",
					step,
					phase: "after",
					snapshot: normalizeTraceValue(result.snapshot),
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
					finalSnapshot: resolveRuntime().adapter.getSnapshot(),
					finalView: resolveView(resolveRuntime().adapter),
					events: copyEvents(),
					commandCount,
					traceCount: traceEntries.length,
					lifecycleCount: lifecycleEntries.length,
				};
			},
			canExecute(commandName: string) {
				assertActive();
				return canExecuteCommand(commandName);
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
		canExecute: canExecuteCommand,
		execute: executeCommand,
		getSnapshot() {
			return withSynchronousRuntimeAccess(() =>
				resolveRuntime().adapter.getSnapshot(),
			);
		},
		getView() {
			return withSynchronousRuntimeAccess(() =>
				resolveView(resolveRuntime().adapter),
			);
		},
		getSchema() {
			return withRuntimeAccess(() => {
				const { adapter, additionalArgs } = resolveRuntime();
				const commandEntries = Object.entries(additionalArgs).filter(
					([, value]) => typeof value === "function",
				);
				const commands = Object.fromEntries(
					commandEntries
						.map(
							([name, value]) =>
								[name, getCommandContract(value) ?? {}] as const,
						)
						.sort(([left], [right]) => left.localeCompare(right)),
				);

				return {
					commands,
					events: [...eventTypes].sort().map((type) => ({ type })),
					snapshot: (toSchemaValue(adapter.getSnapshot()) ?? null) as Exclude<
						ReturnType<typeof toSchemaValue>,
						undefined
					>,
					view: (toSchemaValue(resolveView(adapter)) ?? null) as Exclude<
						ReturnType<typeof toSchemaValue>,
						undefined
					>,
				};
			});
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

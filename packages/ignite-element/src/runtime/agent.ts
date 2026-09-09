import type { CommandMetadata, IgniteAdapter } from "@ignite-element/core";
import type {
	IgniteAgentSubscription,
	IgniteCommandCall,
} from "../types/agent";
import type { IgniteSchemaValue } from "../types/schema";
import { commandMetadataSymbol } from "./commands";
import { toInspectableSchemaValue, toSchemaValue } from "./schema";

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
	States extends Record<string, unknown>,
	AdditionalArgs extends Record<string, unknown>,
> = {
	eventTypes: readonly string[];
	resolveRuntime: () => RuntimeResources<State, Event, AdditionalArgs>;
	retainRuntimeAccess?: () => void;
	releaseRuntimeAccess?: () => void;
	resolveInspection?: (adapter: IgniteAdapter<State, Event>) => {
		snapshot: unknown;
		states: States;
	};
	resolveStates: (adapter: IgniteAdapter<State, Event>) => States;
	resolveDeliveredStates?: (snapshot: State) => States;
};

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

	return metadata;
}

function getOwnCommandEntries(value: object): Array<[string, unknown]> {
	const entries: Array<[string, unknown]> = [];
	for (const name of Object.keys(value)) {
		const descriptor = Object.getOwnPropertyDescriptor(value, name);
		if (
			descriptor &&
			"value" in descriptor &&
			typeof descriptor.value === "function"
		) {
			entries.push([name, descriptor.value]);
		}
	}
	return entries;
}

function hasCanExecute(
	metadata: CommandMetadata | undefined,
): metadata is CommandMetadata & {
	canExecute: NonNullable<CommandMetadata["canExecute"]>;
} {
	return typeof metadata?.canExecute === "function";
}

export function createAgentRuntime<
	State,
	Event,
	States extends Record<string, unknown>,
	AdditionalArgs extends Record<string, unknown>,
>({
	eventTypes,
	retainRuntimeAccess,
	releaseRuntimeAccess,
	resolveInspection,
	resolveRuntime,
	resolveDeliveredStates,
	resolveStates,
}: AgentRuntimeOptions<State, Event, States, AdditionalArgs>) {
	const resolveRuntimeInspection =
		resolveInspection ??
		((adapter: IgniteAdapter<State, Event>) => ({
			snapshot: adapter.getSnapshot(),
			states: resolveStates(adapter),
		}));
	const deriveDeliveredStates =
		resolveDeliveredStates ??
		((snapshot: State) => snapshot as unknown as States);
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
		resolveDelivered: (snapshot: State) => Value,
		handler: (value: Value, prevValue: Value) => void,
	) => {
		retainRuntimeAccess?.();
		try {
			const { adapter } = resolveRuntime();
			let prevValue = resolveCurrent(adapter);
			let installing = true;

			const subscription = adapter.subscribeSnapshots((snapshot) => {
				const nextValue = resolveDelivered(snapshot);
				if (installing) {
					prevValue = nextValue;
					return;
				}

				const lastValue = prevValue;
				prevValue = nextValue;
				handler(nextValue, lastValue);
			});
			installing = false;
			let active = true;

			return {
				unsubscribe: () => {
					if (!active) return;
					active = false;
					try {
						subscription.unsubscribe();
					} catch (error) {
						releaseAfterError(
							"[igniteCore] Runtime access release failed after watcher cleanup error.",
						);
						throw error;
					}
					releaseRuntimeAccess?.();
				},
			};
		} catch (error) {
			releaseAfterError(
				"[igniteCore] Runtime access release failed after watcher setup error.",
			);
			throw error;
		}
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

		let active = true;
		return {
			unsubscribe: () => {
				if (!active) return;
				active = false;
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
		return createWatcher(
			(adapter) => adapter.getSnapshot(),
			(snapshot) => snapshot,
			handler,
		);
	};

	const watchStates = (
		handler: (states: States, prevStates: States) => void,
	) => {
		return createWatcher(resolveStates, deriveDeliveredStates, handler);
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

			return metadata.canExecute({
				snapshot: resolveRuntimeInspection(adapter).snapshot,
			});
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

				const observation = resolveRuntimeInspection(adapter);
				return { ...observation, events };
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

	const commandCallToArgs = (
		call: IgniteCommandCall<Record<string, (arg?: unknown) => unknown>>,
	) => ({
		command: call.command,
		input: "input" in call ? call.input : undefined,
	});

	const runtime = {
		canExecute: canExecuteCommand,
		execute(
			call: IgniteCommandCall<Record<string, (arg?: unknown) => unknown>>,
		) {
			const { command, input } = commandCallToArgs(call);
			return executeCommand(command, input);
		},
		getSnapshot() {
			return withSynchronousRuntimeAccess(() =>
				resolveRuntime().adapter.getSnapshot(),
			);
		},
		getStates() {
			return withSynchronousRuntimeAccess(() =>
				resolveStates(resolveRuntime().adapter),
			);
		},
		getSchema() {
			return withRuntimeAccess(() => {
				const { adapter, additionalArgs } = resolveRuntime();
				const inspection = resolveRuntimeInspection(adapter);
				const commandEntries = getOwnCommandEntries(additionalArgs);
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
					snapshot: toInspectableSchemaValue(inspection.snapshot) ?? null,
					states: toInspectableSchemaValue(inspection.states) ?? null,
				};
			});
		},
		on,
		watchSnapshot,
		watchStates,
	};

	return runtime;
}

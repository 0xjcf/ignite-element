import type { IgniteAdapter } from "ignite-core";
import { toSchemaValue } from "./schema";

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
	resolveRuntime: () => RuntimeResources<State, Event, AdditionalArgs>;
	resolveView: (adapter: IgniteAdapter<State, Event>) => View;
};

export function createAgentRuntime<
	State,
	Event,
	View extends Record<string, unknown>,
	AdditionalArgs extends Record<string, unknown>,
>({
	eventTypes,
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

		const subscription = adapter.subscribe(() => {
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
		const { host } = resolveRuntime();
		const listener = (event: Event) => {
			handler(event as CustomEvent<unknown>);
		};

		host.addEventListener(eventName, listener as EventListener);

		return {
			unsubscribe: () => {
				host.removeEventListener(eventName, listener as EventListener);
			},
		};
	};

	const watch = (handler: (state: State, prevState: State) => void) => {
		return createWatcher((adapter) => adapter.getState(), handler);
	};

	const watchView = (handler: (view: View, prevView: View) => void) => {
		return createWatcher(resolveView, handler);
	};

	return {
		execute(commandName: string, payload?: unknown) {
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

			try {
				(command as (arg?: unknown) => unknown)(payload);

				return {
					state: adapter.getState(),
					events,
				};
			} finally {
				for (const { eventType, listener } of listeners) {
					host.removeEventListener(eventType, listener as EventListener);
				}
			}
		},
		getState() {
			return resolveRuntime().adapter.getState();
		},
		getView() {
			return resolveView(resolveRuntime().adapter);
		},
		getSchema() {
			const { adapter, additionalArgs } = resolveRuntime();
			const commands = Object.entries(additionalArgs)
				.filter(([, value]) => typeof value === "function")
				.map(([name]) => name)
				.sort();

			return {
				commands,
				events: [...eventTypes].sort(),
				state: (toSchemaValue(adapter.getState()) ?? null) as Exclude<
					ReturnType<typeof toSchemaValue>,
					undefined
				>,
			};
		},
		on,
		subscribe: on,
		watch,
		watchView,
	};
}

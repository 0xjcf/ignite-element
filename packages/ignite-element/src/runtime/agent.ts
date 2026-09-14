import type { IgniteAdapter } from "@ignite-element/core";
import type {
	IgniteAgentSubscription,
	IgniteCommandCall,
} from "../types/agent";
import type {
	IgniteAgentCommandSchema,
	IgniteAgentSchema,
} from "../types/schema";
import {
	assertNoCollisions,
	type BindingStore,
	immutableProjection,
} from "./bindings";
import { activateHostEffects } from "./effects";
import { type Lifetime, releaseAll } from "./lifetime";

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
	rollback?: () => void;
};

type AgentRuntimeOptions<
	State,
	Event,
	States extends Record<string, unknown>,
	AdditionalArgs extends Record<string, unknown>,
> = {
	eventTypes: readonly string[];
	hasCommands?: boolean;
	lifetime: Lifetime;
	dispose: () => void;
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

export function createAgentRuntime<
	State,
	Event,
	States extends Record<string, unknown>,
	AdditionalArgs extends Record<string, unknown>,
>({
	eventTypes,
	hasCommands,
	lifetime,
	dispose,
	retainRuntimeAccess,
	releaseRuntimeAccess,
	resolveInspection,
	resolveRuntime,
	resolveDeliveredStates,
	resolveStates,
}: AgentRuntimeOptions<State, Event, States, AdditionalArgs>) {
	const inspect =
		resolveInspection ??
		((adapter: IgniteAdapter<State, Event>) => ({
			snapshot: adapter.getSnapshot(),
			states: resolveStates(adapter),
		}));
	const derive =
		resolveDeliveredStates ??
		((snapshot: State) => snapshot as unknown as States);
	let catalogue: IgniteAgentSchema = Object.freeze({
		schemaVersion: 1,
		states: Object.freeze({ schema: null }),
		commands: hasCommands ? null : Object.freeze({}),
		events: Object.freeze(
			[...eventTypes]
				.sort()
				.map((type) => Object.freeze({ type, payload: null })),
		),
	});
	const publishCatalogue = (commands: object) => {
		const names = Object.keys(commands)
			.filter(
				(key) =>
					typeof Object.getOwnPropertyDescriptor(commands, key)?.value ===
					"function",
			)
			.sort();
		const next = Object.freeze(
			Object.fromEntries(
				names.map((name) => [name, Object.freeze({ input: null })]),
			),
		);
		if (JSON.stringify(next) !== JSON.stringify(catalogue.commands))
			catalogue = Object.freeze({ ...catalogue, commands: next });
	};
	function readCatalogue(key: "schema"): IgniteAgentSchema;
	function readCatalogue(key: "commands"): IgniteAgentCommandSchema | null;
	function readCatalogue(key: "events"): IgniteAgentSchema["events"];
	function readCatalogue(
		key: "schema" | "commands" | "events",
	):
		| IgniteAgentSchema
		| IgniteAgentCommandSchema
		| IgniteAgentSchema["events"]
		| null {
		if (key === "schema") return catalogue;
		if (key === "commands") return catalogue.commands;
		return catalogue.events;
	}
	let prepared = false;
	let preparing = false;
	let releasePreparation: (() => void) | undefined;
	let preparedHost: EventTarget | undefined;
	let currentStates: States;
	let snapshot: Readonly<Record<string, unknown>>;
	const bindingListeners = new Set<() => void>();
	const retainLease = () => {
		retainRuntimeAccess?.();
		let held = true;
		return () => {
			if (!held) return;
			held = false;
			releaseRuntimeAccess?.();
		};
	};
	const prepare = (effects = true) => {
		lifetime.assertActive();
		if (prepared) return currentStates;
		if (preparing)
			throw new Error("[igniteCore] Reentrant runtime preparation.");
		preparing = true;
		let releaseLease = () => {};
		let release: (() => void) | undefined;
		let rollback: (() => void) | undefined;
		let observing = true;
		try {
			releaseLease = retainLease();
			const resources = resolveRuntime();
			rollback = resources.rollback;
			const { adapter, additionalArgs } = resources;
			if (effects) activateHostEffects(resources.host);
			const update = (states: States) => {
				if (!lifetime.active) return;
				assertNoCollisions(states, additionalArgs);
				currentStates = states;
				snapshot = Object.freeze({
					...(immutableProjection(states) as Record<string, unknown>),
					...Object.fromEntries(
						Object.entries(Object.getOwnPropertyDescriptors(additionalArgs))
							.filter(
								([, descriptor]) =>
									descriptor.enumerable && "value" in descriptor,
							)
							.map(([name, descriptor]) => [name, descriptor.value]),
					),
				});
			};
			const initialStates = resolveStates(adapter);
			update(initialStates);
			const subscription = adapter.subscribeSnapshots((value) => {
				if (!observing || !lifetime.active) return;
				update(derive(value));
				for (const listener of [...bindingListeners])
					if (lifetime.active && bindingListeners.has(listener)) listener();
			});
			release = lifetime.own(() => {
				observing = false;
				prepared = false;
				preparedHost = undefined;
				releasePreparation = undefined;
				subscription.unsubscribe();
			});
			releasePreparation = release;
			lifetime.assertActive();
			publishCatalogue(additionalArgs);
			prepared = true;
			preparedHost = resources.host;
			// Synchronous replay updates the framework cache, but the public read
			// still honors the configured snapshot resolver used for this read.
			return initialStates;
		} catch (error) {
			observing = false;
			try {
				releaseAll([release ?? releaseLease, () => rollback?.()]);
			} catch (cleanupError) {
				console.error(
					"[igniteCore] Preparation rollback failed.",
					cleanupError,
				);
			}
			throw error;
		} finally {
			preparing = false;
			releaseLease();
		}
	};
	const bindingStore: BindingStore = {
		prepare() {
			prepare(false);
		},
		read() {
			lifetime.assertActive();
			if (!prepared)
				throw new Error(
					'[useIgnite] Core is unprepared. Call core.get("states") once in owner bootstrap, outside rendering.',
				);
			return snapshot;
		},
		subscribe(listener) {
			bindingStore.read();
			// Framework subscription runs after rendering and only activates an
			// already-acquired host; it never creates an actor or runtime facade.
			if (preparedHost) activateHostEffects(preparedHost);
			const releaseLease = retainLease();
			bindingListeners.add(listener);
			return lifetime.own(() => {
				bindingListeners.delete(listener);
				releaseLease();
			});
		},
	};
	lifetime.own(() => {
		bindingListeners.clear();
		prepared = false;
		preparedHost = undefined;
		currentStates = undefined as never;
		snapshot = Object.freeze({});
	});

	const createWatcher = <Value>(
		read: (adapter: IgniteAdapter<State, Event>) => Value,
		delivered: (value: State) => Value,
		handler: (next: Value, previous: Value) => void,
	): IgniteAgentSubscription => {
		lifetime.assertActive();
		const releaseLease = retainLease();
		let active = true;
		let rollback: (() => void) | undefined;
		try {
			const resources = resolveRuntime();
			rollback = resources.rollback;
			activateHostEffects(resources.host);
			const { adapter } = resources;
			let previous = read(adapter);
			let installing = true;
			const subscription = adapter.subscribeSnapshots((value) => {
				if (!active || !lifetime.active) return;
				const next = delivered(value);
				if (installing) {
					previous = next;
					return;
				}
				const last = previous;
				previous = next;
				handler(next, last);
			});
			installing = false;
			const unsubscribe = lifetime.own(() => {
				active = false;
				releaseAll([() => subscription.unsubscribe(), releaseLease]);
			});
			return { unsubscribe };
		} catch (error) {
			active = false;
			try {
				releaseAll([releaseLease, () => rollback?.()]);
			} catch (cleanupError) {
				console.error("[igniteCore] Watch rollback failed.", cleanupError);
			}
			throw error;
		}
	};
	const watchSnapshot = (handler: (value: State, previous: State) => void) =>
		createWatcher(
			(adapter) => adapter.getSnapshot(),
			(value) => value,
			handler,
		);

	const listen = (
		names: readonly string[],
		handler: (event: RuntimeEventMember) => void,
		allSourceEvents = false,
	): IgniteAgentSubscription => {
		lifetime.assertActive();
		const releaseLease = retainLease();
		let active = true;
		const releases: (() => void)[] = [];
		let rollback: (() => void) | undefined;
		const cleanup = (label: string, release: () => void) => () => {
			try {
				release();
			} catch (error) {
				// Individual event handles retain their established logged-error
				// boundary. Terminal owner disposal instead collects the exact error.
				if (lifetime.active) console.error(label, error);
				else throw error;
			}
		};
		try {
			const resources = resolveRuntime();
			rollback = resources.rollback;
			activateHostEffects(resources.host);
			const { adapter, host } = resources;
			for (const name of names) {
				const listener = (event: globalThis.Event) => {
					if (active && lifetime.active) handler(domEventToRuntimeEvent(event));
				};
				host.addEventListener(name, listener);
				releases.push(
					cleanup("[igniteCore] Event listener cleanup failed.", () =>
						host.removeEventListener(name, listener),
					),
				);
			}
			const subscription = adapter.subscribeEvents?.((event: unknown) => {
				if (!active || !lifetime.active) return;
				const member = sourceEventToRuntimeEvent(event);
				if (member && (allSourceEvents || names.includes(member.type)))
					handler(member);
			});
			if (subscription)
				releases.push(
					cleanup(
						allSourceEvents
							? "[igniteCore] Source event subscription cleanup failed after command execution."
							: "[igniteCore] Source event subscription cleanup failed.",
						() => subscription.unsubscribe(),
					),
				);
			releases.push(releaseLease);
			return {
				unsubscribe: lifetime.own(() => {
					active = false;
					releaseAll(releases);
				}),
			};
		} catch (error) {
			active = false;
			try {
				releaseAll([...releases, releaseLease, () => rollback?.()]);
			} catch (cleanupError) {
				console.error("[igniteCore] Listener rollback failed.", cleanupError);
			}
			throw error;
		}
	};
	const execute = async (
		call: IgniteCommandCall<Record<string, (arg?: unknown) => unknown>>,
	) => {
		lifetime.assertActive();
		const resources = resolveRuntime();
		activateHostEffects(resources.host);
		const { adapter, additionalArgs } = resources;
		const descriptor = Object.getOwnPropertyDescriptor(
			additionalArgs,
			call.command,
		);
		const command: unknown =
			descriptor && "value" in descriptor ? descriptor.value : undefined;
		if (typeof command !== "function")
			throw new Error(`[igniteCore] Unknown command "${call.command}".`);
		const events: RuntimeEventMember[] = [];
		let window: IgniteAgentSubscription;
		try {
			window = listen(eventTypes, (event) => events.push(event), true);
		} catch (error) {
			try {
				resources.rollback?.();
			} catch (cleanupError) {
				console.error(
					"[igniteCore] Command-window setup rollback failed.",
					cleanupError,
				);
			}
			throw error;
		}
		try {
			await command("input" in call ? call.input : undefined);
			await new Promise<void>((resolve) => queueMicrotask(resolve));
			lifetime.assertActive();
			return { ...inspect(adapter), events };
		} finally {
			try {
				window.unsubscribe();
			} catch (error) {
				console.error("[igniteCore] Command-window cleanup failed.", error);
			}
		}
	};
	const runtime = {
		get(key: "states" | "schema" | "commands" | "events") {
			if (key === "states") {
				lifetime.assertActive();
				// Public reads re-project the current source. Only framework reads
				// consume the detached, referentially stable observation cache.
				if (prepared) {
					const resources = resolveRuntime();
					activateHostEffects(resources.host);
					return resolveStates(resources.adapter);
				}
				return prepare();
			}
			if (key === "schema") return readCatalogue(key);
			if (key === "commands") return readCatalogue(key);
			if (key === "events") return readCatalogue(key);
			throw new Error(
				"[igniteCore] Unknown read key; expected states, schema, commands or events.",
			);
		},
		watch(handler: (next: States, previous: States) => void) {
			return createWatcher(resolveStates, derive, handler);
		},
		on(name: string, handler: (event: RuntimeEventMember) => void) {
			return listen([name], handler);
		},
		execute,
		dispose,
	};
	return {
		runtime,
		releasePreparation: () => releasePreparation?.(),
		bindingStore,
		watchSnapshot,
		publishCatalogue,
		readCatalogue,
	};
}

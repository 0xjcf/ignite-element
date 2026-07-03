import type { IgniteAdapter } from "@ignite-element/core";
import { failInvariant, StateScope } from "@ignite-element/core";

// The ActorWeb* types below are a deliberately LOOSE structural projection of
// the canonical neutral source contract published by `@actor-web/runtime`
// (ActorReadModelSource/ActorCommandSource/ActorSourceSnapshot/…): members the
// canonical contract requires (subscribeEvent, transportStatus, snapshot
// helpers) are optional here so barebones and foreign sources stay accepted,
// and they are hand-written rather than aliased so the optional peer never
// leaks into the shipped d.ts graph. Compatibility with the canonical types is
// enforced at compile time by src/__tests__/actor-web-canonical-compat.types.ts.

// Tolerant during actor-web's opaque-address migration: accept BOTH the legacy
// object identity AND actor-web's new opaque branded string (a branded string IS
// assignable to `string`). This keeps the compile-time drift guard green against
// the still-published `@actor-web/runtime@0.1.0` (object address) AND the new
// branded-string runtime. The address is opaque to ignite — it is only ever passed
// through (never read for `.id`/`.path`/`.node`), so the union and the eventual
// pure `string` are both no-ops for ignite logic.
// TODO(actor-web > 0.1.0): collapse to `string` once actor-web publishes the
// branded address and ignite bumps its `@actor-web/runtime` dep so CI installs it.
export type ActorWebAddress =
	| string
	| {
			id: string;
			path: string;
			type?: string;
			node?: string;
	  };

export type ActorWebEventSubscriptionOptions = {
	types?: readonly string[];
};

export type ActorWebTransportState =
	| "local"
	| "connected"
	| "replaying"
	| "degraded"
	| "disconnected";

export type ActorWebTransportStatus = {
	state: ActorWebTransportState;
	updatedAt: number;
	lastSequence?: number;
	lagMs?: number;
	reason?: string;
};

export type ActorWebSourceSnapshot<
	Context extends object = Record<string, never>,
> = {
	address: ActorWebAddress;
	context: Context;
	phase: string;
	status?: string;
	value?: unknown;
	matches?: (state: string) => boolean;
	can?: (event: string | { type: string }) => boolean;
	hasTag?: (tag: string) => boolean;
	toJSON: () => object;
};

export type ActorWebReadModelSource<
	Context extends object = Record<string, never>,
	Message extends { type: string } = { type: string },
	Emitted extends { type: string } = Message,
> = {
	address: ActorWebAddress;
	snapshot: () => ActorWebSourceSnapshot<Context>;
	subscribe: (
		listener: (snapshot: ActorWebSourceSnapshot<Context>) => void,
	) => () => void;
	subscribeEvent?: (
		listener: (event: Emitted) => void,
		options?: ActorWebEventSubscriptionOptions,
	) => () => void;
	transportStatus?: () => ActorWebTransportStatus;
	subscribeTransportStatus?: (
		listener: (status: ActorWebTransportStatus) => void,
	) => () => void;
	close?: () => void | Promise<void>;
};

export type ActorWebCommandSource<
	Context extends object = Record<string, never>,
	Message extends { type: string } = { type: string },
	Emitted extends { type: string } = Message,
> = ActorWebReadModelSource<Context, Message, Emitted> & {
	send: (message: Message) => Promise<unknown>;
	ask?: <Response = unknown>(
		message: Message,
		timeout?: number,
	) => Promise<Response>;
};

export type ActorWebSource<
	Context extends object = Record<string, never>,
	Message extends { type: string } = { type: string },
	Emitted extends { type: string } = Message,
> = ActorWebReadModelSource<Context, Message, Emitted>;

export type ActorWebExtendedState<
	Context extends object = Record<string, never>,
> = Context &
	ActorWebSourceSnapshot<Context> & {
		context: Context;
		transport: ActorWebTransportStatus;
	};

export type ActorWebCommandActor<
	Context extends object = Record<string, never>,
	Message extends { type: string } = { type: string },
	Emitted extends { type: string } = Message,
> = ActorWebCommandSource<Context, Message, Emitted>;

// A source is either read-only or read+write (it carries `send`). The command
// actor is derived from this single source — actor-web shares the same one-source
// config surface as every other adapter (no separate command source).
type ActorWebSourceLike<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string },
> =
	| ActorWebSource<Context, Message, Emitted>
	| ActorWebCommandSource<Context, Message, Emitted>;

type ActorWebAdapterFactory<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string },
	Host = unknown,
> = ((
	host?: Host,
) => IgniteAdapter<ActorWebExtendedState<Context>, Message>) & {
	scope: StateScope;
	resolveStateSnapshot: (
		adapter: IgniteAdapter<ActorWebExtendedState<Context>, Message>,
	) => ActorWebExtendedState<Context>;
	resolveCommandActor: (
		adapter: IgniteAdapter<ActorWebExtendedState<Context>, Message>,
	) => ActorWebCommandActor<Context, Message, Emitted>;
};

type ActorWebAdapterEntry<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string },
> = {
	adapter: IgniteAdapter<ActorWebExtendedState<Context>, Message>;
	snapshot: () => ActorWebExtendedState<Context>;
	actor: ActorWebCommandActor<Context, Message, Emitted> | null;
};

const stoppedSubscribeWarning =
	"[ActorWebAdapter] Cannot subscribe when adapter is stopped.";

function disconnectedStatus(reason: string): ActorWebTransportStatus {
	return {
		state: "disconnected",
		updatedAt: Date.now(),
		reason,
	};
}

function createStableSignature(value: unknown): string {
	const seen = new WeakSet<object>();
	return (
		JSON.stringify(value, (_key, currentValue) => {
			if (
				typeof currentValue === "function" ||
				typeof currentValue === "symbol" ||
				typeof currentValue === "undefined"
			) {
				return undefined;
			}

			if (
				typeof currentValue !== "object" ||
				currentValue === null ||
				Array.isArray(currentValue)
			) {
				return currentValue;
			}

			if (seen.has(currentValue)) {
				return "[Circular]";
			}

			seen.add(currentValue);
			return Object.keys(currentValue)
				.sort()
				.reduce<Record<string, unknown>>((normalized, key) => {
					const nestedValue = (currentValue as Record<string, unknown>)[key];
					if (typeof nestedValue !== "undefined") {
						normalized[key] = nestedValue;
					}
					return normalized;
				}, {});
		}) ?? "null"
	);
}

function createReplaySignature<Context extends object>(
	snapshot: ActorWebSourceSnapshot<Context>,
	transport: ActorWebTransportStatus,
): string {
	return createStableSignature({
		address: snapshot.address,
		context: snapshot.context,
		phase: snapshot.phase,
		snapshot: snapshot.toJSON(),
		transport,
	});
}

function isActorWebReadModelSource<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string },
>(
	value: ActorWebSourceLike<Context, Message, Emitted>,
): value is ActorWebSource<Context, Message, Emitted> {
	return (
		typeof value === "object" &&
		value !== null &&
		"snapshot" in value &&
		"subscribe" in value
	);
}

function isActorWebCommandSource<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string },
>(value: unknown): value is ActorWebCommandSource<Context, Message, Emitted> {
	return (
		isActorWebReadModelSource(
			value as ActorWebSourceLike<Context, Message, Emitted>,
		) && "send" in (value as object)
	);
}

function requireEntry<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string },
>(
	registry: WeakMap<
		IgniteAdapter<ActorWebExtendedState<Context>, Message>,
		ActorWebAdapterEntry<Context, Message, Emitted>
	>,
	adapter: IgniteAdapter<ActorWebExtendedState<Context>, Message>,
	errorMessage: string,
): ActorWebAdapterEntry<Context, Message, Emitted> {
	const entry = registry.get(adapter);
	return entry ?? failInvariant(errorMessage);
}

function toExtendedState<Context extends object>(
	snapshot: ActorWebSourceSnapshot<Context>,
	transport: ActorWebTransportStatus,
): ActorWebExtendedState<Context> {
	return {
		...snapshot.context,
		...snapshot,
		context: snapshot.context,
		transport,
	};
}

function createSharedFactory<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string },
>(
	entry: ActorWebAdapterEntry<Context, Message, Emitted>,
): ActorWebAdapterFactory<Context, Message, Emitted, unknown> {
	const factory = (() => entry.adapter) as ActorWebAdapterFactory<
		Context,
		Message,
		Emitted,
		unknown
	>;
	factory.scope = StateScope.Shared;
	factory.resolveStateSnapshot = () => entry.snapshot();
	factory.resolveCommandActor = () =>
		entry.actor ??
		failInvariant(
			"[ActorWebAdapter] Actor-Web command-capable source (one that exposes send()) is required.",
		);
	return factory;
}

function createIsolatedFactory<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string },
	Host,
>(
	createEntry: (host?: Host) => ActorWebAdapterEntry<Context, Message, Emitted>,
): ActorWebAdapterFactory<Context, Message, Emitted, Host> {
	const registry = new WeakMap<
		IgniteAdapter<ActorWebExtendedState<Context>, Message>,
		ActorWebAdapterEntry<Context, Message, Emitted>
	>();

	const factory = ((host?: Host) => {
		const entry = createEntry(host);
		registry.set(entry.adapter, entry);
		return entry.adapter;
	}) as ActorWebAdapterFactory<Context, Message, Emitted, Host>;

	factory.scope = StateScope.Isolated;
	factory.resolveStateSnapshot = (adapter) => {
		return requireEntry(
			registry,
			adapter,
			"[ActorWebAdapter] Unable to resolve snapshot for facade callbacks.",
		).snapshot();
	};
	factory.resolveCommandActor = (adapter) => {
		return (
			requireEntry(
				registry,
				adapter,
				"[ActorWebAdapter] Unable to resolve actor for facade callbacks.",
			).actor ??
			failInvariant(
				"[ActorWebAdapter] Actor-Web command-capable source (one that exposes send()) is required.",
			)
		);
	};

	return factory;
}

function createAdapterEntry<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string },
>(
	source: ActorWebSourceLike<Context, Message, Emitted>,
	scope: StateScope,
	ownsSource: boolean,
): ActorWebAdapterEntry<Context, Message, Emitted> {
	const listeners = new Set<(state: ActorWebExtendedState<Context>) => void>();
	// The command actor is the source itself when it can write (exposes `send`);
	// a read-only source yields no command actor.
	const commandSource = isActorWebCommandSource<Context, Message, Emitted>(
		source,
	)
		? source
		: null;
	let unsubscribeSource: (() => void) | null = null;
	let unsubscribeTransportStatus: (() => void) | null = null;
	let isStopped = false;
	let notificationCount = 0;
	let lastKnownSnapshot = source.snapshot();
	let lastKnownTransportStatus =
		source.transportStatus?.() ??
		disconnectedStatus("Actor-Web source does not expose transport status.");
	let lastNotifiedSignature: string | null = null;

	const cleanupSubscriptions = () => {
		unsubscribeSource?.();
		unsubscribeSource = null;
		unsubscribeTransportStatus?.();
		unsubscribeTransportStatus = null;
		lastNotifiedSignature = null;
	};

	const notify = () => {
		const nextSignature = createReplaySignature(
			lastKnownSnapshot,
			lastKnownTransportStatus,
		);
		if (lastNotifiedSignature === nextSignature) {
			return;
		}

		notificationCount += 1;
		lastNotifiedSignature = nextSignature;
		const state = toExtendedState(lastKnownSnapshot, lastKnownTransportStatus);
		for (const listener of listeners) {
			listener(state);
		}
	};

	const readCurrentState = () => {
		if (!isStopped) {
			lastKnownSnapshot = source.snapshot();
			lastKnownTransportStatus =
				source.transportStatus?.() ?? lastKnownTransportStatus;
		}

		return toExtendedState(lastKnownSnapshot, lastKnownTransportStatus);
	};

	const ensureSubscription = () => {
		if (unsubscribeSource || unsubscribeTransportStatus) {
			return;
		}

		unsubscribeSource = source.subscribe((snapshot) => {
			lastKnownSnapshot = snapshot;
			notify();
		});
		unsubscribeTransportStatus =
			source.subscribeTransportStatus?.((status) => {
				lastKnownTransportStatus = status;
				notify();
			}) ?? null;
	};

	const adapter: IgniteAdapter<
		ActorWebExtendedState<Context>,
		Message,
		Emitted
	> = {
		subscribeSnapshots(listener) {
			if (isStopped) {
				console.warn(stoppedSubscribeWarning);
				return { unsubscribe: () => {} };
			}

			listeners.add(listener);

			if (!unsubscribeSource) {
				// Keep the initial delivery synchronous while replay-signature dedupe
				// suppresses duplicate startup notifications from transport/source replays.
				const notificationsBeforeSubscribe = notificationCount;
				ensureSubscription();
				if (notificationCount === notificationsBeforeSubscribe) {
					readCurrentState();
					notify();
				}
			} else {
				listener(readCurrentState());
			}

			return {
				unsubscribe: () => {
					listeners.delete(listener);
					if (!listeners.size) {
						cleanupSubscriptions();
					}
				},
			};
		},
		subscribeEvents(listener) {
			// Bridge the source's emitted-domain-event channel into the headless
			// runtime's event surface (on()/execute().events). No-ops when the
			// source provides no `subscribeEvent`.
			const unsubscribe = source.subscribeEvent?.(listener);
			return {
				unsubscribe: () => {
					unsubscribe?.();
				},
			};
		},
		send(event) {
			if (isStopped) {
				console.warn(
					"[ActorWebAdapter] Cannot send events when adapter is stopped.",
				);
				return;
			}

			if (!commandSource) {
				console.warn(
					"[ActorWebAdapter] Cannot send events without an Actor-Web command-capable source (one that exposes send()).",
				);
				return;
			}

			void commandSource.send(event).catch((error) => {
				console.error("[ActorWebAdapter] Failed to send event.", error);
			});
		},
		getSnapshot() {
			return readCurrentState();
		},
		stop() {
			if (isStopped) {
				return;
			}

			isStopped = true;
			cleanupSubscriptions();
			listeners.clear();
			lastKnownSnapshot = source.snapshot();
			lastKnownTransportStatus =
				source.transportStatus?.() ?? lastKnownTransportStatus;

			// Only tear down the underlying source when ignite created it (isolated
			// scope). A consumer-owned source passed as a live instance (shared
			// scope) is the consumer's to dispose — ignite must never close()/stop()
			// a source it did not create.
			if (!ownsSource) {
				return;
			}

			const cleanupSources = async () => {
				// The command actor IS the source (or null), so closing the source
				// disposes the only handle ignite created.
				await source.close?.();
			};

			void cleanupSources().catch((error) => {
				console.error(
					"[ActorWebAdapter] Failed to stop isolated source.",
					error,
				);
			});
		},
		scope,
	};

	return {
		// The adapter object carries a typed `subscribeEvents()` for the source's emit
		// union; the runtime reads it structurally, so the entry erases Emitted to
		// the 2-arg IgniteAdapter the factory pipeline expects (no generics ripple).
		adapter: adapter as unknown as IgniteAdapter<
			ActorWebExtendedState<Context>,
			Message
		>,
		snapshot: () => readCurrentState(),
		actor: commandSource,
	};
}

export default function createActorWebAdapter<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string } = Message,
	Host = unknown,
>(
	source:
		| ActorWebSourceLike<Context, Message, Emitted>
		| ((context?: {
				host?: Host;
		  }) => ActorWebSourceLike<Context, Message, Emitted>),
): ActorWebAdapterFactory<Context, Message, Emitted, Host> {
	if (typeof source === "function") {
		return createIsolatedFactory((host) =>
			createAdapterEntry(source({ host }), StateScope.Isolated, true),
		);
	}

	return createSharedFactory(
		createAdapterEntry(source, StateScope.Shared, false),
	);
}

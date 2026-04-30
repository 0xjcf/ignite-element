import type { IgniteAdapter } from "ignite-core";
import { failInvariant, StateScope } from "ignite-core";

export type ActorWebAddress = {
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
	toJSON: () => object;
};

export type ActorWebSource<
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
	send: (message: Message) => Promise<unknown>;
	ask?: <Response = unknown>(
		message: Message,
		timeout?: number,
	) => Promise<Response>;
};

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
> = ActorWebSource<Context, Message, Emitted>;

export type ActorWebSourceHandle<
	Context extends object = Record<string, never>,
	Message extends { type: string } = { type: string },
	Emitted extends { type: string } = Message,
> = {
	source: ActorWebSource<Context, Message, Emitted>;
	stop?: () => void | Promise<void>;
};

type ActorWebSourceLike<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string },
> =
	| ActorWebSource<Context, Message, Emitted>
	| ActorWebSourceHandle<Context, Message, Emitted>;

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
	actor: ActorWebCommandActor<Context, Message, Emitted>;
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

function isActorWebSource<
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
		"subscribe" in value &&
		"send" in value
	);
}

function resolveHandle<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string },
>(
	value: ActorWebSourceLike<Context, Message, Emitted>,
): ActorWebSourceHandle<Context, Message, Emitted> {
	return isActorWebSource(value) ? { source: value } : value;
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
	factory.resolveCommandActor = () => entry.actor;
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
		return requireEntry(
			registry,
			adapter,
			"[ActorWebAdapter] Unable to resolve actor for facade callbacks.",
		).actor;
	};

	return factory;
}

function createAdapterEntry<
	Context extends object,
	Message extends { type: string },
	Emitted extends { type: string },
>(
	handle: ActorWebSourceHandle<Context, Message, Emitted>,
	scope: StateScope,
): ActorWebAdapterEntry<Context, Message, Emitted> {
	const listeners = new Set<(state: ActorWebExtendedState<Context>) => void>();
	const source = handle.source;
	let unsubscribeSource: (() => void) | null = null;
	let unsubscribeTransportStatus: (() => void) | null = null;
	let isStopped = false;
	let lastKnownSnapshot = source.snapshot();
	let lastKnownTransportStatus =
		source.transportStatus?.() ??
		disconnectedStatus("Actor-Web source does not expose transport status.");

	const cleanupSubscriptions = () => {
		unsubscribeSource?.();
		unsubscribeSource = null;
		unsubscribeTransportStatus?.();
		unsubscribeTransportStatus = null;
	};

	const notify = () => {
		const state = toExtendedState(lastKnownSnapshot, lastKnownTransportStatus);
		for (const listener of listeners) {
			listener(state);
		}
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

	const adapter: IgniteAdapter<ActorWebExtendedState<Context>, Message> = {
		subscribe(listener) {
			if (isStopped) {
				console.warn(stoppedSubscribeWarning);
				return { unsubscribe: () => {} };
			}

			listeners.add(listener);

			if (!unsubscribeSource) {
				ensureSubscription();
			} else {
				listener(toExtendedState(lastKnownSnapshot, lastKnownTransportStatus));
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
		send(event) {
			if (isStopped) {
				console.warn(
					"[ActorWebAdapter] Cannot send events when adapter is stopped.",
				);
				return;
			}

			void source.send(event).catch((error) => {
				console.error("[ActorWebAdapter] Failed to send event.", error);
			});
		},
		getState() {
			if (!isStopped) {
				lastKnownSnapshot = source.snapshot();
				lastKnownTransportStatus =
					source.transportStatus?.() ?? lastKnownTransportStatus;
			}

			return toExtendedState(lastKnownSnapshot, lastKnownTransportStatus);
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

			if (handle.stop) {
				void Promise.resolve(handle.stop()).catch((error) => {
					console.error(
						"[ActorWebAdapter] Failed to stop isolated source.",
						error,
					);
				});
			}
		},
		scope,
	};

	return {
		adapter,
		snapshot: () => {
			if (!isStopped) {
				lastKnownSnapshot = source.snapshot();
				lastKnownTransportStatus =
					source.transportStatus?.() ?? lastKnownTransportStatus;
			}

			return toExtendedState(lastKnownSnapshot, lastKnownTransportStatus);
		},
		actor: source,
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
		return createIsolatedFactory((host) => {
			return createAdapterEntry(
				resolveHandle(source({ host })),
				StateScope.Isolated,
			);
		});
	}

	return createSharedFactory(
		createAdapterEntry(resolveHandle(source), StateScope.Shared),
	);
}

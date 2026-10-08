export type DevtoolsEventOrigin = "native" | "effect";

/** One outward event the runtime delivered, declared or bridged. */
export type DevtoolsEventRecord = {
	coreId: string;
	type: string;
	payload: unknown;
	origin: DevtoolsEventOrigin;
	at: number;
};

/** Reserved for the command tap. Not delivered in this version. */
export type DevtoolsCommandOrigin = "view" | "execute" | "tools";

export type DevtoolsCommandRecord = {
	coreId: string;
	command: string;
	input: unknown;
	origin: DevtoolsCommandOrigin;
	outcome: unknown;
	durationMs: number;
};

/**
 * G1 delivers `event`. `command` is part of the type so a later command tap
 * can call it without changing `installDevtoolsHook`.
 */
export type DevtoolsHook = {
	event?(record: DevtoolsEventRecord): void;
	command?(record: DevtoolsCommandRecord): void;
};

/** Installed on `globalThis` while a development hook is active. */
export type DevtoolsGlobalSlot = {
	hook?: DevtoolsHook;
	publish?(owner: object, origin: DevtoolsEventOrigin, event: object): void;
};

const coreIds = new WeakMap<object, string>();
let coreSequence = 0;

function coreIdFor(owner: object): string {
	const existing = coreIds.get(owner);
	if (existing) return existing;
	coreSequence += 1;
	const id = `devtools-core-${coreSequence}`;
	coreIds.set(owner, id);
	return id;
}

function payloadFrom(event: object): unknown {
	const payload: Record<string, unknown> = {};
	const record = event as Record<string, unknown>;
	for (const key of Object.keys(record)) {
		if (key === "type") continue;
		payload[key] = record[key];
	}
	return payload;
}

function isDevelopment(): boolean {
	// Same NODE_ENV convention as eventOrigins. The direct `process.env.NODE_ENV`
	// checks at call sites are what the production bundler deletes.
	try {
		return process.env.NODE_ENV !== "production";
	} catch {
		return true;
	}
}

const DEVTOOLS_SLOT = Symbol.for("ignite-element.devtools");

/** @internal Delivery slot. Absent from production bundles of normal entrypoints. */
export const devtoolsDelivery = {
	hook: undefined as DevtoolsHook | undefined,
	publish(owner: object, origin: DevtoolsEventOrigin, event: object): void {
		const listener = devtoolsDelivery.hook?.event;
		if (!listener) return;
		if (!("type" in event) || typeof event.type !== "string") return;
		try {
			listener({
				coreId: coreIdFor(owner),
				type: event.type,
				payload: payloadFrom(event),
				origin,
				at: Date.now(),
			});
		} catch {
			/* A devtools hook must not change delivery. */
		}
	},
};

export function installDevtoolsHook(hook: DevtoolsHook): () => void {
	if (process.env.NODE_ENV === "production" || !isDevelopment()) {
		return () => {};
	}
	(globalThis as { [DEVTOOLS_SLOT]?: typeof devtoolsDelivery })[DEVTOOLS_SLOT] =
		devtoolsDelivery;
	const previous = devtoolsDelivery.hook;
	devtoolsDelivery.hook = hook;
	let active = true;
	return () => {
		if (!active) return;
		active = false;
		if (devtoolsDelivery.hook === hook) devtoolsDelivery.hook = previous;
	};
}

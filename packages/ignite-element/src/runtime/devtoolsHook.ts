export type DevtoolsEventOrigin = "native" | "effect";

/** One outward event the runtime delivered, declared or bridged. */
export type DevtoolsEventRecord = {
	coreId: string;
	type: string;
	payload: unknown;
	origin: DevtoolsEventOrigin;
	at: number;
};

/** How the facade command was invoked. */
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
 * G1 delivers `event`. G2 delivers `command` for each facade command call.
 */
export type DevtoolsHook = {
	event?(record: DevtoolsEventRecord): void;
	command?(record: DevtoolsCommandRecord): void;
};

/** Installed on `globalThis` while a development hook is active. */
export type DevtoolsGlobalSlot = {
	hook?: DevtoolsHook;
	publish?(owner: object, origin: DevtoolsEventOrigin, event: object): void;
	publishCommand?(
		owner: object,
		command: string,
		input: unknown,
		origin: DevtoolsCommandOrigin,
		outcome: unknown,
		durationMs: number,
	): void;
	/**
	 * Remember the caller for the next facade command. A later push does not
	 * replace an origin that is still waiting, so `tools` wins over `execute`.
	 */
	pushOrigin?(origin: DevtoolsCommandOrigin): void;
	/** Drop that origin when the command never consumed it. */
	clearOrigin?(origin: DevtoolsCommandOrigin): void;
	/** Read and clear the origin waiting for the command that is starting. */
	takeOrigin?(): DevtoolsCommandOrigin | undefined;
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

const DEVTOOLS_SLOT = Symbol.for("ignite-element.devtools");

type InstalledHook = {
	hook: DevtoolsHook;
	active: boolean;
};

/** Origin of the facade command that is about to start. Consumed synchronously. */
let pendingOrigin: DevtoolsCommandOrigin | undefined;

const installedHooks: InstalledHook[] = [];

function activeHook(): DevtoolsHook | undefined {
	for (let index = installedHooks.length - 1; index >= 0; index -= 1) {
		const installed = installedHooks[index];
		if (installed?.active) return installed.hook;
	}
	return undefined;
}

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
	publishCommand(
		owner: object,
		command: string,
		input: unknown,
		origin: DevtoolsCommandOrigin,
		outcome: unknown,
		durationMs: number,
	): void {
		const listener = devtoolsDelivery.hook?.command;
		if (!listener) return;
		try {
			listener({
				coreId: coreIdFor(owner),
				command,
				input,
				origin,
				outcome,
				durationMs,
			});
		} catch {
			/* A devtools hook must not change the command result. */
		}
	},
	pushOrigin(origin: DevtoolsCommandOrigin): void {
		if (pendingOrigin === undefined) pendingOrigin = origin;
	},
	clearOrigin(origin: DevtoolsCommandOrigin): void {
		if (pendingOrigin === origin) pendingOrigin = undefined;
	},
	takeOrigin(): DevtoolsCommandOrigin | undefined {
		const origin = pendingOrigin;
		pendingOrigin = undefined;
		return origin;
	},
};

/** @internal Clears install state between tests. */
export function resetDevtoolsHookForTests(): void {
	installedHooks.length = 0;
	devtoolsDelivery.hook = undefined;
	pendingOrigin = undefined;
}

export function installDevtoolsHook(hook: DevtoolsHook): () => void {
	// Direct member expression so application bundlers can remove this in production.
	if (process.env.NODE_ENV === "production") return () => {};
	(globalThis as { [DEVTOOLS_SLOT]?: typeof devtoolsDelivery })[DEVTOOLS_SLOT] =
		devtoolsDelivery;
	const installed: InstalledHook = { hook, active: true };
	installedHooks.push(installed);
	devtoolsDelivery.hook = hook;
	return () => {
		if (!installed.active) return;
		installed.active = false;
		const index = installedHooks.indexOf(installed);
		if (index >= 0) installedHooks.splice(index, 1);
		devtoolsDelivery.hook = activeHook();
	};
}

/**
 * Slot shared by the JSX bundle and the host bundle.
 * Those entries are built separately, so module state would fork.
 * `Symbol.for` keeps one slot in the realm.
 */

export type IgniteHostContext = {
	readonly signal: AbortSignal;
	send(event: unknown): void;
	readonly reducedMotion: boolean;
};

export type IgniteHostDefinition = {
	mount(el: Element, ctx: IgniteHostContext): unknown;
	update?(handle: unknown, slice: unknown): void;
	dispose(handle: unknown): void;
	select?(snapshot: unknown): unknown;
	equals?(a: unknown, b: unknown): boolean;
	describe?(slice: unknown): string;
};

export type IgniteHostRuntime = {
	snapshot: unknown;
	send: (event: unknown) => void;
	reducedMotion: () => boolean;
	hosts: Record<string, IgniteHostDefinition>;
};

/** Field the element factory sets and the JSX strategy reads. */
export const HOST_RUNTIME_FIELD = "__igniteHostRuntime";

type HostOwnershipTools = {
	claimSubtree(element: Element): void;
	releaseSubtree(element: Element): void;
	onUnmount(node: Node, hook: () => void): void;
};

type HostSlot = {
	sync(element: Element, useName: unknown): void;
	withRuntime<T>(runtime: IgniteHostRuntime | undefined, run: () => T): T;
	ownership: HostOwnershipTools;
};

const SLOT = Symbol.for("ignite-element.host-runtime");

function emptyOwnership(): HostOwnershipTools {
	return {
		claimSubtree() {},
		releaseSubtree() {},
		onUnmount() {},
	};
}

function hostSlot(): HostSlot {
	const realm = globalThis as typeof globalThis & { [SLOT]?: HostSlot };
	realm[SLOT] ??= {
		sync() {},
		withRuntime(_runtime, run) {
			return run();
		},
		ownership: emptyOwnership(),
	};
	return realm[SLOT];
}

export function configureHostOwnership(tools: HostOwnershipTools): void {
	hostSlot().ownership = tools;
}

export function claimHostSubtree(element: Element): void {
	hostSlot().ownership.claimSubtree(element);
}

export function releaseHostSubtree(element: Element): void {
	hostSlot().ownership.releaseSubtree(element);
}

export function onHostUnmount(node: Node, hook: () => void): void {
	hostSlot().ownership.onUnmount(node, hook);
}

export function installHostSync(sync: HostSlot["sync"]): void {
	hostSlot().sync = sync;
}

export function installHostRuntime(
	withRuntime: <T>(runtime: IgniteHostRuntime | undefined, run: () => T) => T,
): void {
	hostSlot().withRuntime = withRuntime;
}

export function syncHostElement(element: Element, useName: unknown): void {
	hostSlot().sync(element, useName);
}

export function withIgniteHostRuntime<T>(
	runtime: IgniteHostRuntime | undefined,
	run: () => T,
): T {
	return hostSlot().withRuntime(runtime, run);
}

export function readBoundHostRuntime(
	owner: EventTarget | null | undefined,
): IgniteHostRuntime | undefined {
	if (!owner) return undefined;
	const value = (owner as unknown as Record<string, unknown>)[
		HOST_RUNTIME_FIELD
	];
	if (!value || typeof value !== "object") return undefined;
	return value as IgniteHostRuntime;
}

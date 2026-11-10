/**
 * Shared slot so the JSX bundle can ask for style injection without pulling
 * the stylesheet machinery into a no-host consumer. The full injector
 * installs itself when global styles or the injector are used. Roots before that
 * install stay queued as [root, wasConnected] pairs. detach() drops the pair
 * and stamps the root so a pending flush will not replay it. A root that is
 * only disconnected for a move stays pending until it reconnects. Roots that
 * were never connected still flush.
 */

type StyleInject = ((
	root: ShadowRoot,
	connectedAtQueue?: boolean | null,
) => void) & { replay?: (root: ShadowRoot) => void };
type RootRef = { deref(): ShadowRoot | undefined };
type QueuedRoot = ShadowRoot | RootRef | boolean;
type StyleSlot = StyleInject | Array<QueuedRoot>;

declare const __IGNITE_HOST_RUNTIME__: boolean | undefined;

// Element lifetimes may end before styles are selected. Keep their roots weak
// where available; the host-free JSX build retains its existing queue format.
const WeakRoot =
	typeof __IGNITE_HOST_RUNTIME__ !== "undefined" && __IGNITE_HOST_RUNTIME__
		? (
				globalThis as typeof globalThis & {
					WeakRef?: new (root: ShadowRoot) => RootRef;
				}
			).WeakRef
		: undefined;

function readQueuedRoot(value: QueuedRoot): ShadowRoot | undefined {
	if (value instanceof ShadowRoot) return value;
	if (typeof value === "object" && "deref" in value) {
		const root = value.deref();
		if (root instanceof ShadowRoot) return root;
	}
}

const STYLE_INJECT_SLOT = Symbol.for("ignite-element.style-inject");

type StyleInjectHost = typeof globalThis & {
	[STYLE_INJECT_SLOT]?: StyleSlot;
};

export function injectStyles(root: ShadowRoot): void {
	const host = globalThis as StyleInjectHost;
	const slot = host[STYLE_INJECT_SLOT];
	if (typeof slot === "function") slot(root);
	else {
		const queued = (Array.isArray(slot) ? slot : []) as Array<QueuedRoot>;
		if (!Array.isArray(slot)) host[STYLE_INJECT_SLOT] = queued;
		queued.push(WeakRoot ? new WeakRoot(root) : root, root.isConnected);
	}
}

export function forgetQueuedStyles(root: ShadowRoot): void {
	// The same symbol on the root, not on globalThis, means detach() ran.
	(root as unknown as StyleInjectHost)[STYLE_INJECT_SLOT] = true as never;
	const slot = (globalThis as StyleInjectHost)[STYLE_INJECT_SLOT];
	// null asks the installed injector to drop its pending entry. The queue
	// array used before install is spliced here instead.
	if (typeof slot === "function") {
		slot(root, null);
		return;
	}
	if (!Array.isArray(slot)) return;
	if (WeakRoot) {
		for (let index = slot.length - 2; index >= 0; index -= 2) {
			const pending = readQueuedRoot(slot[index]);
			if (!pending || pending === root) slot.splice(index, 2);
		}
		return;
	}
	for (let index = slot.indexOf(root); index >= 0; index = slot.indexOf(root)) {
		slot.splice(index, 2);
	}
}

/** Reconnection is only a signal; it must not select the full style driver. */
export function replayParkedStyles(root: ShadowRoot): void {
	const slot = (globalThis as StyleInjectHost)[STYLE_INJECT_SLOT];
	if (typeof slot === "function") slot.replay?.(root);
	else if (Array.isArray(slot) && root.isConnected) {
		// A root attached while disconnected may connect and move again before
		// styles are selected. Preserve that history when the driver takes over.
		for (let index = 0; index < slot.length; index += 2) {
			if (readQueuedRoot(slot[index]) === root) slot[index + 1] = true;
		}
	}
}

export function installStyleInject(
	inject: StyleInject,
	replay?: (root: ShadowRoot) => void,
): void {
	const host = globalThis as StyleInjectHost;
	const queued = host[STYLE_INJECT_SLOT];
	if (replay) inject.replay = replay;
	host[STYLE_INJECT_SLOT] = inject;
	if (!Array.isArray(queued)) return;
	for (let index = 0; index < queued.length; index += 2) {
		const root = readQueuedRoot(queued[index]);
		if (root) {
			inject(root, queued[index + 1] === true);
		}
	}
}

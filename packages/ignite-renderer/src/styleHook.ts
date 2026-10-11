/**
 * Shared slot so the JSX bundle can ask for style injection without pulling
 * the stylesheet machinery into a no-host consumer. The full injector
 * installs itself when the renderer entry loads. Roots attached before that
 * install stay queued as [root, wasConnected] pairs. detach() drops the pair
 * and stamps the root so a pending flush will not replay it. A root that is
 * only disconnected for a move stays pending until it reconnects. Roots that
 * were never connected still flush.
 */

type StyleInject = (root: ShadowRoot, connectedAtQueue?: boolean) => void;
type StyleSlot = StyleInject | Array<ShadowRoot | boolean>;

const STYLE_INJECT_SLOT = Symbol.for("ignite-element.style-inject");

type StyleInjectHost = typeof globalThis & {
	[STYLE_INJECT_SLOT]?: StyleSlot;
};

export function injectStyles(root: ShadowRoot): void {
	const host = globalThis as StyleInjectHost;
	const slot = host[STYLE_INJECT_SLOT];
	if (typeof slot === "function") slot(root);
	else {
		const queued = (Array.isArray(slot) ? slot : []) as Array<
			ShadowRoot | boolean
		>;
		if (!Array.isArray(slot)) host[STYLE_INJECT_SLOT] = queued;
		queued.push(root, root.isConnected);
	}
}

export function forgetQueuedStyles(root: ShadowRoot): void {
	// The same symbol on the root, not on globalThis, means detach() ran.
	(root as unknown as StyleInjectHost)[STYLE_INJECT_SLOT] = true as never;
	const slot = (globalThis as StyleInjectHost)[STYLE_INJECT_SLOT];
	if (!Array.isArray(slot)) return;
	const index = slot.indexOf(root);
	if (index >= 0) slot.splice(index, 2);
}

export function installStyleInject(inject: StyleInject): void {
	const host = globalThis as StyleInjectHost;
	const queued = host[STYLE_INJECT_SLOT];
	host[STYLE_INJECT_SLOT] = inject;
	if (!Array.isArray(queued)) return;
	for (let index = 0; index < queued.length; index += 2) {
		const root = queued[index];
		if (root instanceof ShadowRoot) {
			inject(root, queued[index + 1] === true);
		}
	}
}

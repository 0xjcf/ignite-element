/**
 * Shared slot so the JSX bundle can ask for style injection without pulling
 * the stylesheet machinery into a no-host consumer. The full injector
 * installs itself when the renderer entry loads. Roots attached before that
 * install stay queued as [root, wasConnected] pairs. detach() drops the pair.
 * A root that was connected and later removed is not replayed. Roots that
 * were never connected still flush.
 */

type StyleInject = (root: ShadowRoot) => void;
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
		if (
			root instanceof ShadowRoot &&
			(root.isConnected || !queued[index + 1])
		) {
			inject(root);
		}
	}
}

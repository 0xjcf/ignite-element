/**
 * Shared slot so the JSX bundle can ask for style injection without pulling
 * the stylesheet machinery into a no-host consumer. The full injector
 * installs itself when the renderer entry loads. Roots attached before that
 * install stay queued and are handed to the injector, which records them for
 * flushPendingStyles().
 */

type StyleInject = (root: ShadowRoot) => void;
type StyleSlot = StyleInject | ShadowRoot[];

const STYLE_INJECT_SLOT = Symbol.for("ignite-element.style-inject");

type StyleInjectHost = typeof globalThis & {
	[STYLE_INJECT_SLOT]?: StyleSlot;
};

export function injectStyles(root: ShadowRoot): void {
	const host = globalThis as StyleInjectHost;
	const slot = host[STYLE_INJECT_SLOT];
	if (typeof slot === "function") slot(root);
	// biome-ignore lint/suspicious/noAssignInExpressions: keeps the no-host style hook within the gzip ceiling
	else ((host[STYLE_INJECT_SLOT] ??= []) as ShadowRoot[]).push(root);
}

export function installStyleInject(inject: StyleInject): void {
	const host = globalThis as StyleInjectHost;
	const queued = host[STYLE_INJECT_SLOT];
	host[STYLE_INJECT_SLOT] = inject;
	if (Array.isArray(queued)) for (const root of queued) inject(root);
}

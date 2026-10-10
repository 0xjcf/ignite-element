/**
 * Shared slot so the JSX bundle can ask for style injection without pulling
 * the stylesheet machinery into a no-host consumer. The full injector
 * installs itself when the renderer entry loads.
 */

type StyleInject = (root: ShadowRoot) => void;

const STYLE_INJECT_SLOT = Symbol.for("ignite-element.style-inject");

type StyleInjectHost = typeof globalThis & {
	[STYLE_INJECT_SLOT]?: StyleInject;
};

export function injectStyles(root: ShadowRoot): void {
	(globalThis as StyleInjectHost)[STYLE_INJECT_SLOT]?.(root);
}

export function installStyleInject(inject: StyleInject): void {
	(globalThis as StyleInjectHost)[STYLE_INJECT_SLOT] = inject;
}

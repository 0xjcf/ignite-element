type DOMRegistry = typeof globalThis & {
	HTMLElement?: typeof HTMLElement;
	customElements?: CustomElementRegistry;
};

const host = globalThis as DOMRegistry;

if (typeof host.HTMLElement === "undefined") {
	// Minimal HTMLElement stub so class heritage checks succeed in non-DOM runtimes.
	class IgniteHTMLElementStub {
		attachShadow(): ShadowRoot {
			return {
				host: this as unknown as Element,
			} as ShadowRoot;
		}
	}

	host.HTMLElement = IgniteHTMLElementStub as unknown as typeof HTMLElement;
}

if (typeof host.customElements === "undefined") {
	const registry: Partial<CustomElementRegistry> = {
		define: () => {},
		get: () => undefined,
		getName: () => null,
		upgrade: () => {},
		whenDefined: async () =>
			(host.HTMLElement ??
				(class {} as typeof HTMLElement)) as CustomElementConstructor,
	};

	host.customElements = registry as CustomElementRegistry;
}

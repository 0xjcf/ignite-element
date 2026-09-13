/** Authenticate browser capabilities without allocating a host or mutating globals. */
export function requireDomRegistration(): {
	ElementBase: typeof HTMLElement;
	registry: CustomElementRegistry;
} {
	if (
		typeof HTMLElement !== "function" ||
		typeof HTMLElement.prototype.attachShadow !== "function" ||
		typeof customElements === "undefined" ||
		typeof customElements.get !== "function" ||
		typeof customElements.define !== "function" ||
		typeof document === "undefined" ||
		typeof document.createElement !== "function" ||
		typeof MutationObserver !== "function"
	) {
		throw new Error(
			"[igniteCore] DOM registration requires a browser DOM with HTMLElement, customElements, document, and MutationObserver. Construct and use source-backed cores without registering a DOM tag in Node.",
		);
	}
	return { ElementBase: HTMLElement, registry: customElements };
}

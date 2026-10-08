import { expect } from "vitest";

const HOST_GLOBALS = [
	"document",
	"window",
	"localStorage",
	"sessionStorage",
] as const;

export function sealHostGlobals() {
	const touched: string[] = [];
	for (const name of HOST_GLOBALS) {
		expect(name in globalThis).toBe(false);
		Object.defineProperty(globalThis, name, {
			configurable: true,
			get() {
				touched.push(name);
				return undefined;
			},
		});
	}
	return {
		touched,
		restore() {
			for (const name of HOST_GLOBALS) {
				delete (globalThis as Record<string, unknown>)[name];
			}
		},
	};
}

export function expectCloneable(value: unknown) {
	expect(structuredClone(value)).toEqual(value);
}

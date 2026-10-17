import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { jsx } from "../../renderers/jsx/jsx-runtime";
import { renderIgniteJsx } from "../../renderers/jsx/renderer";

// Round 14 rules.
//  W1 a method found through an accessor is looked up, ownership is checked,
//     and only then is the function called.
//  W2 dropping a native property the allowlist leaves alone (volume,
//     playbackRate, currentTime) removes no attribute.
//  W3 a ref that unmounts its own element and returns a disposer is torn down
//     once, by the disposer, and never receives null.

const mkRoot = () => {
	const root = document.createElement("div");
	document.body.append(root);
	return root;
};

describe("W1 an accessor-shaped method is rechecked before it is called", () => {
	it("addEventListener found through a getter that supersedes is not called", () => {
		const root = mkRoot();
		const log: string[] = [];
		let superseding = false;
		customElements.define(
			"x-r14-lookup",
			class extends HTMLElement {
				// @ts-expect-error an accessor shadows the method on purpose
				get addEventListener() {
					if (superseding) {
						renderIgniteJsx(root, jsx("p", {}), undefined, undefined);
					}
					return (...args: unknown[]) => {
						log.push(String(args[0]));
					};
				}
			} as never,
		);
		const tree = renderIgniteJsx(
			root,
			jsx("x-r14-lookup", {}),
			undefined,
			undefined,
		);
		superseding = true;
		renderIgniteJsx(
			root,
			jsx("x-r14-lookup", { onClick: () => undefined }),
			tree,
			undefined,
		);
		expect(log).toEqual([]);
	});
});

describe("W2 off-list native properties keep their attribute on drop", () => {
	it("volume, playbackRate and currentTime", () => {
		fc.assert(
			fc.property(
				fc.constantFrom("volume", "playbackRate", "currentTime"),
				fc.string({ minLength: 1 }),
				(key, text) => {
					const root = mkRoot();
					const tree = renderIgniteJsx(
						root,
						jsx("audio", { [key]: 0.5 }),
						undefined,
						undefined,
					);
					const audio = root.firstElementChild as HTMLAudioElement;
					audio.setAttribute(key, text);
					renderIgniteJsx(root, jsx("audio", {}), tree, undefined);
					expect(audio.getAttribute(key)).toBe(text);
				},
			),
			{ seed: 169914, numRuns: 12 },
		);
	});
});

describe("W3 a ref that unmounts itself and returns a disposer", () => {
	it("is torn down once, by the disposer", () => {
		const root = mkRoot();
		const log: unknown[] = [];
		const ref = (node: Element | null) => {
			log.push(node ? "ref" : "null");
			if (node) {
				renderIgniteJsx(root, jsx("p", {}), undefined, undefined);
				return () => void log.push("dispose");
			}
			return undefined;
		};
		renderIgniteJsx(root, jsx("span", { ref }), undefined, undefined);
		expect(log).toEqual(["ref", "dispose"]);
	});
	it("still gets null when it returns no disposer", () => {
		const root = mkRoot();
		const log: unknown[] = [];
		const ref = (node: Element | null) => {
			log.push(node ? "ref" : "null");
			if (node) renderIgniteJsx(root, jsx("p", {}), undefined, undefined);
		};
		renderIgniteJsx(root, jsx("span", { ref }), undefined, undefined);
		expect(log).toEqual(["ref", "null"]);
	});
});

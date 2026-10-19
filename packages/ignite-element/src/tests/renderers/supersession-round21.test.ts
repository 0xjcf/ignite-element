import { describe, expect, it, vi } from "vitest";
import "../../../../ignite-renderer/src/renderers/jsx/hosts";
import { jsx } from "../../../../ignite-renderer/src/renderers/jsx/jsx-runtime";
import {
	renderIgniteJsx,
	unmountIgniteSubtree,
} from "../../../../ignite-renderer/src/renderers/jsx/renderer";

// Round 21 (PR #168).
//  E  an operation (logger, DOM call, getter) that supersedes and then THROWS
//     is stale work: it unwinds as the private abort, never as its own error.
//  R  composition listeners go through act().
const base = () => {
	const root = document.createElement("div");
	document.body.append(root);
	return root;
};

describe("R21 exceptions after supersession", () => {
	it("a console.error that supersedes then throws inside reportHostError unwinds quietly", () => {
		const root = base();
		const hosts = {
			snapshot: 1,
			send: () => undefined,
			reducedMotion: () => false,
			hosts: {
				scene: {
					select: (n: unknown) => n,
					mount: () => ({}),
					update: () => undefined,
					dispose: () => undefined,
					describe: () => {
						throw new Error("describe failed");
					},
				} as never,
			},
		};
		const error = vi.spyOn(console, "error").mockImplementation(() => {
			error.mockImplementation(() => undefined);
			renderIgniteJsx(root, jsx("p", {}), undefined, undefined);
			throw new Error("logger failed");
		});
		try {
			expect(() =>
				renderIgniteJsx(
					root,
					jsx("div", { children: jsx("canvas", { use: "scene" }) }),
					undefined,
					{ hosts: hosts as never },
				),
			).not.toThrow();
		} finally {
			error.mockRestore();
		}
	});
	it("a console.error that supersedes then throws while a ref cleanup is reported stays contained", () => {
		const root = base();
		const published: string[] = [];
		const withRef = () =>
			jsx("div", {
				children: jsx("span", { ref: () => () => void Error("x") }),
			});
		const boom = () =>
			jsx("div", {
				children: jsx("span", {
					ref: () => () => {
						throw new Error("cleanup failed");
					},
				}),
			});
		const tree1 = renderIgniteJsx(root, boom(), undefined, undefined);
		const error = vi.spyOn(console, "error").mockImplementation(() => {
			error.mockImplementation(() => undefined);
			renderIgniteJsx(root, withRef(), tree1, {
				onTreePublished: () => void published.push("newer"),
			});
			throw new Error("logger failed");
		});
		try {
			expect(() =>
				renderIgniteJsx(root, jsx("p", {}), tree1, {
					onTreePublished: () => void published.push("older"),
				}),
			).not.toThrow();
		} finally {
			error.mockRestore();
		}
		expect(published).not.toContain("older");
	});
	it("an element method that supersedes then throws unwinds quietly", () => {
		const root = base();
		let trig = false;
		customElements.define(
			"x-r21-act",
			class extends HTMLElement {
				addEventListener(...args: Parameters<HTMLElement["addEventListener"]>) {
					if (trig) {
						trig = false;
						renderIgniteJsx(root, jsx("p", {}), undefined, undefined);
						throw new Error("boom");
					}
					super.addEventListener(...args);
				}
			},
		);
		trig = true;
		expect(() =>
			renderIgniteJsx(
				root,
				jsx("div", {
					children: jsx("x-r21-act", { onClick: () => undefined }),
				}),
				undefined,
				undefined,
			),
		).not.toThrow();
	});
	it("a raw structure read that supersedes then throws unwinds quietly", () => {
		const root = base();
		let trig = false;
		customElements.define(
			"x-r21-kids",
			class extends HTMLElement {
				get childNodes(): NodeListOf<ChildNode> {
					if (trig) {
						trig = false;
						renderIgniteJsx(root, jsx("p", {}), undefined, undefined);
						throw new Error("boom");
					}
					return super.childNodes;
				}
			},
		);
		const view = (n: number) =>
			jsx("x-r21-kids", {
				children: n ? [jsx("i", {}), jsx("b", {})] : [jsx("i", {})],
			});
		const tree1 = renderIgniteJsx(root, view(0), undefined, undefined);
		trig = true;
		expect(() =>
			renderIgniteJsx(root, view(1), tree1, undefined),
		).not.toThrow();
	});
});

describe("R21 reporters outside a commit", () => {
	it("a throwing console.error does not escape a reported ref cleanup failure", () => {
		const root = base();
		renderIgniteJsx(
			root,
			jsx("span", {
				ref: () => () => {
					throw new Error("cleanup failed");
				},
			}),
			undefined,
			undefined,
		);
		const error = vi.spyOn(console, "error").mockImplementation(() => {
			throw new Error("logger failed");
		});
		try {
			expect(() => unmountIgniteSubtree(root)).not.toThrow();
		} finally {
			error.mockRestore();
		}
	});
	it("a throwing console.error does not escape a reported host dispose failure", () => {
		const root = base();
		const hosts = {
			snapshot: 1,
			send: () => undefined,
			reducedMotion: () => false,
			hosts: {
				scene: {
					select: (n: unknown) => n,
					mount: () => ({}),
					update: () => undefined,
					dispose: () => {
						throw new Error("dispose failed");
					},
				} as never,
			},
		};
		renderIgniteJsx(
			root,
			jsx("div", { children: jsx("canvas", { use: "scene" }) }),
			undefined,
			{ hosts: hosts as never },
		);
		const error = vi.spyOn(console, "error").mockImplementation(() => {
			throw new Error("logger failed");
		});
		try {
			expect(() => unmountIgniteSubtree(root)).not.toThrow();
		} finally {
			error.mockRestore();
		}
	});
});

describe("R21 composition listeners", () => {
	it("a first listener registration that supersedes stops the remaining registrations", () => {
		const root = base();
		const calls = new Map<EventTarget, string[]>();
		const original = HTMLInputElement.prototype.addEventListener;
		let first: EventTarget | undefined;
		HTMLInputElement.prototype.addEventListener = function (
			this: HTMLInputElement,
			...args: Parameters<typeof original>
		) {
			const list = calls.get(this) ?? [];
			list.push(String(args[0]));
			calls.set(this, list);
			if (!first) {
				first = this;
				renderIgniteJsx(root, jsx("p", {}), undefined, undefined);
			}
			return original.apply(this, args);
		} as typeof original;
		try {
			renderIgniteJsx(root, jsx("input", { value: "a" }), undefined, undefined);
		} finally {
			HTMLInputElement.prototype.addEventListener = original;
		}
		expect(calls.get(first as EventTarget)).toEqual(["compositionstart"]);
	});
});

import { describe, expect, it, vi } from "vitest";
import "../../../../ignite-renderer/src/renderers/jsx/hosts";
import { jsx } from "../../../../ignite-renderer/src/renderers/jsx/jsx-runtime";
import {
	mountIgniteJsx,
	renderIgniteJsx,
} from "../../../../ignite-renderer/src/renderers/jsx/renderer";

// Round 22 (PR #168).
//  M  module state (composition) is written only after a live() that follows
//     the overridable reads deciding it (isConnected, matches).
//  F  a failed mount is retired BEFORE the user-controlled report, so a
//     reporter that renders establishes a fresh record instead of losing it.
const base = () => {
	const root = document.createElement("div");
	document.body.append(root);
	return root;
};

describe("R22 composition state after an overridden matches()", () => {
	it("a matches() that renders a newer tree and returns false leaves the IME session active", () => {
		const host = base();
		let tree = mountIgniteJsx(host, jsx("input", { value: "a" }));
		const input = host.querySelector("input") as HTMLInputElement;
		input.focus();
		input.dispatchEvent(new Event("compositionstart"));
		let trig = true;
		const real = input.matches.bind(input);
		input.matches = (selector: string) => {
			if (trig) {
				trig = false;
				renderIgniteJsx(host, jsx("input", { value: "b" }), tree);
				return false;
			}
			return real(selector);
		};
		tree = renderIgniteJsx(host, jsx("input", { value: "b" }), tree);
		renderIgniteJsx(host, jsx("input", { value: "c" }), tree);
		expect(input.value).toBe("a");
	});
});

describe("R22 composition clearing", () => {
	const composingInput = () => {
		const host = base();
		const tree = mountIgniteJsx(host, jsx("input", { value: "a" }));
		const input = host.querySelector("input") as HTMLInputElement;
		input.focus();
		input.dispatchEvent(new Event("compositionstart"));
		return { host, tree, input };
	};
	it("an input that lost focus without a blur event ends the session once", () => {
		const { host, input, tree: first } = composingInput();
		let tree = first;
		const real = input.matches.bind(input);
		let blurred = true;
		input.matches = (selector: string) => (blurred ? false : real(selector));
		tree = renderIgniteJsx(host, jsx("input", { value: "b" }), tree);
		expect(input.value).toBe("b");
		blurred = false;
		renderIgniteJsx(host, jsx("input", { value: "c" }), tree);
		expect(input.value).toBe("c");
	});
	it("an IME session pauses only value, not other controlled keys", () => {
		const { host, input, tree } = composingInput();
		renderIgniteJsx(host, jsx("input", { value: "a", checked: true }), tree);
		expect(input.checked).toBe(true);
	});
	it("a focused input outside a composition takes rendered values", () => {
		const host = base();
		const tree = mountIgniteJsx(host, jsx("input", { value: "a" }));
		const input = host.querySelector("input") as HTMLInputElement;
		input.focus();
		renderIgniteJsx(host, jsx("input", { value: "b" }), tree);
		expect(input.value).toBe("b");
	});
});

describe("R22 failed mounts are retired before reporting", () => {
	const setup = (mode: "async" | "sync") => {
		const root = base();
		let mounts = 0;
		const view = () =>
			jsx("div", { children: jsx("canvas", { use: "scene" }) });
		const hosts = {
			snapshot: 1,
			send: () => undefined,
			reducedMotion: () => false,
			hosts: {
				scene: {
					select: (n: unknown) => n,
					mount: (el: Element) => {
						mounts++;
						if (mounts === 1) {
							if (mode === "sync") throw new Error("mount failed");
							return Promise.reject(new Error("mount failed"));
						}
						el.append(document.createElement("i"));
						return {};
					},
					update: () => undefined,
					dispose: () => undefined,
				} as never,
			},
		};
		return { root, view, hosts, mounts: () => mounts };
	};
	it("an async rejection whose console.error renders a newer slice keeps the newer host", async () => {
		const ctx = setup("async");
		let tree1: ReturnType<typeof renderIgniteJsx> | undefined;
		const error = vi.spyOn(console, "error").mockImplementation(() => {
			error.mockImplementation(() => undefined);
			renderIgniteJsx(ctx.root, ctx.view(), tree1, {
				hosts: { ...ctx.hosts, snapshot: 2 } as never,
			});
		});
		try {
			tree1 = renderIgniteJsx(ctx.root, ctx.view(), undefined, {
				hosts: ctx.hosts as never,
			});
			await new Promise((resolve) => setTimeout(resolve, 10));
		} finally {
			error.mockRestore();
		}
		expect(ctx.mounts()).toBe(2);
		expect(ctx.root.querySelector("canvas i")).not.toBeNull();
	});
	it("a sync mount failure whose console.error renders the same host keeps the newer host", () => {
		const ctx = setup("sync");
		const view = (use?: string) =>
			jsx("div", { children: jsx("canvas", use ? { use } : {}) });
		const tree0 = renderIgniteJsx(ctx.root, view(), undefined, {
			hosts: ctx.hosts as never,
		});
		const canvas = ctx.root.querySelector("canvas");
		const error = vi.spyOn(console, "error").mockImplementation(() => {
			error.mockImplementation(() => undefined);
			renderIgniteJsx(ctx.root, view("scene"), tree0, {
				hosts: { ...ctx.hosts, snapshot: 2 } as never,
			});
		});
		try {
			renderIgniteJsx(ctx.root, view("scene"), tree0, {
				hosts: ctx.hosts as never,
			});
		} finally {
			error.mockRestore();
		}
		expect(ctx.mounts()).toBe(2);
		expect(ctx.root.querySelector("canvas")).toBe(canvas);
		expect(ctx.root.querySelector("canvas i")).not.toBeNull();
	});
	it("a rejection that lands after a newer record mounted leaves that record owning its subtree", async () => {
		const root = base();
		let reject: (error: Error) => void = () => undefined;
		let mounts = 0;
		const scene = {
			select: (n: unknown) => n,
			mount: (el: Element) => {
				mounts++;
				if (mounts === 1)
					return new Promise((_, no) => {
						reject = no;
					});
				el.append(document.createElement("i"));
				return {};
			},
			update: () => undefined,
			dispose: () => undefined,
		};
		const opts = {
			hosts: {
				snapshot: 1,
				send: () => undefined,
				reducedMotion: () => false,
				hosts: { scene: scene as never },
			} as never,
		};
		const view = (use?: string) =>
			jsx("div", { children: jsx("canvas", use ? { use } : {}) });
		let tree = renderIgniteJsx(root, view("scene"), undefined, opts);
		tree = renderIgniteJsx(root, view(), tree, opts);
		tree = renderIgniteJsx(root, view("scene"), tree, opts);
		expect(mounts).toBe(2);
		const error = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		try {
			reject(new Error("late"));
			await new Promise((resolve) => setTimeout(resolve, 10));
		} finally {
			error.mockRestore();
		}
		expect(root.querySelector("canvas i")).not.toBeNull();
		// The claim is still the newer record's, so dropping the host clears it.
		renderIgniteJsx(root, view(), tree, opts);
		expect(root.querySelector("canvas i")).toBeNull();
	});
	it("a sync mount that renders another host before throwing leaves that host's claim", () => {
		const root = base();
		let latest: ReturnType<typeof renderIgniteJsx> | undefined;
		let opts: object = {};
		const view = (use?: string) =>
			jsx("div", { children: jsx("canvas", use ? { use } : {}) });
		const host = (mount: (el: Element) => unknown) =>
			({
				mount,
				update: () => undefined,
				dispose: () => undefined,
			}) as never;
		opts = {
			hosts: {
				snapshot: 1,
				send: () => undefined,
				reducedMotion: () => false,
				hosts: {
					scene: host(() => {
						latest = renderIgniteJsx(root, view("other"), tree0, opts);
						throw new Error("mount failed");
					}),
					other: host((el) => {
						el.append(document.createElement("i"));
						return {};
					}),
				},
			} as never,
		};
		const tree0 = renderIgniteJsx(root, view(), undefined, opts);
		const error = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		try {
			renderIgniteJsx(root, view("scene"), tree0, opts);
		} finally {
			error.mockRestore();
		}
		expect(root.querySelector("canvas i")).not.toBeNull();
		renderIgniteJsx(root, view(), latest, opts);
		expect(root.querySelector("canvas i")).toBeNull();
	});
});

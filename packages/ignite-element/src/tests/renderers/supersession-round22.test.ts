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
	it("a sync mount failure whose console.error renders a newer view keeps the newer host", () => {
		const ctx = setup("sync");
		const error = vi.spyOn(console, "error").mockImplementation(() => {
			error.mockImplementation(() => undefined);
			renderIgniteJsx(ctx.root, ctx.view(), undefined, {
				hosts: { ...ctx.hosts, snapshot: 2 } as never,
			});
		});
		try {
			renderIgniteJsx(ctx.root, ctx.view(), undefined, {
				hosts: ctx.hosts as never,
			});
		} finally {
			error.mockRestore();
		}
		expect(ctx.mounts()).toBe(2);
		expect(ctx.root.querySelector("canvas i")).not.toBeNull();
	});
});

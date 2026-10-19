import { describe, expect, it, vi } from "vitest";
import "../../../../ignite-renderer/src/renderers/jsx/hosts";
import { jsx } from "../../../../ignite-renderer/src/renderers/jsx/jsx-runtime";
import { renderIgniteJsx } from "../../../../ignite-renderer/src/renderers/jsx/renderer";
import {
	createIgniteJsxRenderStrategy,
	mountIgniteJsxOnce,
} from "../../renderers/jsx/IgniteJsxRenderStrategy";

// Round 23 (PR #168), the last targeted pass under the threat model.
//  D  a root being detached accepts no new commit, whatever the entry point,
//     so nothing is acquired that the detach pass cannot release.
//  C  a failed mount releases the element's subtree claim only while no newer
//     record holds it (an abort listener may have remounted the host).
const balanced = (ref: ReturnType<typeof vi.fn>) => {
	const calls = ref.mock.calls.map((c) => c[0]);
	expect(calls.filter((el) => el !== null).length).toBe(
		calls.filter((el) => el === null).length,
	);
};

describe("R23 commits during detach", () => {
	const setup = (late: (root: HTMLElement) => void) => {
		const host = document.createElement("div");
		document.body.append(host);
		const strategy = createIgniteJsxRenderStrategy();
		strategy.attach(host.attachShadow({ mode: "open" }));
		strategy.render(
			jsx("div", {
				ref: (el: Element | null) => {
					if (el === null) {
						late(
							host.shadowRoot?.querySelector(
								"[data-ignite-jsx-root]",
							) as HTMLElement,
						);
					}
				},
			}),
		);
		return strategy;
	};
	it("a ref(null) that calls mountIgniteJsxOnce on the root leaves no ref acquired", () => {
		const escaped = vi.fn();
		const strategy = setup((root) =>
			mountIgniteJsxOnce(root, jsx("span", { ref: escaped })),
		);
		strategy.detach();
		balanced(escaped);
	});
	it("a ref(null) that calls renderIgniteJsx on the root leaves no ref acquired", () => {
		const escaped = vi.fn();
		const strategy = setup((root) =>
			renderIgniteJsx(root, jsx("span", { ref: escaped })),
		);
		strategy.detach();
		balanced(escaped);
	});
});

describe("R23 a failed mount keeps a remounted host's claim", () => {
	const make = (failure: "async" | "sync") => {
		const root = document.createElement("div");
		document.body.append(root);
		let mounts = 0;
		let reject: (error: Error) => void = () => undefined;
		let tree: ReturnType<typeof renderIgniteJsx> | undefined;
		const view = (use?: string) =>
			jsx("div", { children: jsx("canvas", use ? { use } : {}) });
		const opts = {
			hosts: {
				snapshot: 1,
				send: () => undefined,
				reducedMotion: () => false,
				hosts: {
					scene: {
						mount: (el: Element, ctx: { signal: AbortSignal }) => {
							mounts++;
							if (mounts > 1) {
								el.append(document.createElement("i"));
								return {};
							}
							ctx.signal.addEventListener("abort", () => {
								tree = renderIgniteJsx(root, view("scene"), tree, opts);
							});
							if (failure === "sync") throw new Error("mount failed");
							return new Promise((_, no) => {
								reject = no;
							});
						},
						update: () => undefined,
						dispose: () => undefined,
					} as never,
				},
			} as never,
		};
		tree = renderIgniteJsx(root, view(), undefined, opts);
		return {
			root,
			opts,
			view,
			reject: (e: Error) => reject(e),
			tree: () => tree,
			set: (t: typeof tree) => {
				tree = t;
			},
			mounts: () => mounts,
		};
	};
	it("async: dropping use on the next render clears the remounted host's children", async () => {
		const ctx = make("async");
		ctx.set(renderIgniteJsx(ctx.root, ctx.view("scene"), ctx.tree(), ctx.opts));
		const error = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		try {
			ctx.reject(new Error("late"));
			await new Promise((resolve) => setTimeout(resolve, 10));
		} finally {
			error.mockRestore();
		}
		expect(ctx.mounts()).toBe(2);
		expect(ctx.root.querySelector("canvas i")).not.toBeNull();
		renderIgniteJsx(ctx.root, ctx.view(), ctx.tree(), ctx.opts);
		expect(ctx.root.querySelector("canvas i")).toBeNull();
	});
	it("sync: dropping use on the next render clears the remounted host's children", () => {
		const ctx = make("sync");
		const error = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		try {
			const outer = renderIgniteJsx(
				ctx.root,
				ctx.view("scene"),
				ctx.tree(),
				ctx.opts,
			);
			if (ctx.mounts() < 2) ctx.set(outer);
		} finally {
			error.mockRestore();
		}
		expect(ctx.mounts()).toBe(2);
		expect(ctx.root.querySelector("canvas i")).not.toBeNull();
		renderIgniteJsx(ctx.root, ctx.view(), ctx.tree(), ctx.opts);
		expect(ctx.root.querySelector("canvas i")).toBeNull();
	});
});

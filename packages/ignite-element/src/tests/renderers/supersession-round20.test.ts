import { describe, expect, it, vi } from "vitest";
import "../../../../ignite-renderer/src/renderers/jsx/hosts";
import { jsx } from "../../../../ignite-renderer/src/renderers/jsx/jsx-runtime";
import { renderIgniteJsx } from "../../../../ignite-renderer/src/renderers/jsx/renderer";
import { createIgniteJsxRenderStrategy } from "../../renderers/jsx/IgniteJsxRenderStrategy";

// Round 20 (PR #168): the five threads left by the round-18 root pass.
//  G  a retained-and-mutated host record is not "current" by identity alone.
//  E  a user operation that supersedes and then throws becomes the stale halt.
//  B  one interceptable operation per touch().
//  P  the root publish is guarded by an unconditional live().
//  D  detach() holds the strategy "writing" while cleanups run.
const mkHosts = (snapshot: number) => ({
	snapshot,
	send: () => undefined,
	reducedMotion: () => false,
	hosts: {} as Record<string, never>,
});
const base = () => {
	const root = document.createElement("div");
	document.body.append(root);
	return root;
};
const plain = (over: Record<string, unknown> = {}) => ({
	select: (n: unknown) => n,
	mount: (el: Element) => {
		el.append(document.createElement("i"));
		return {};
	},
	update: () => undefined,
	dispose: () => undefined,
	...over,
});

describe("R20 hosts.ts", () => {
	it("G: a describe that renders a newer slice into the retained record wins", async () => {
		const root = base();
		const hosts = mkHosts(1);
		let calls = 0;
		let tree1: ReturnType<typeof renderIgniteJsx>;
		const view = () =>
			jsx("div", { children: jsx("canvas", { use: "scene" }) });
		hosts.hosts.scene = plain({
			mount: (el: Element) => {
				el.append(document.createElement("i"));
				return Promise.resolve({});
			},
			describe: (slice: unknown) => {
				calls++;
				if (calls === 2) {
					renderIgniteJsx(root, view(), tree1, {
						hosts: { ...hosts, snapshot: 2 } as never,
					});
				}
				return `d${String(slice)}`;
			},
		}) as never;
		tree1 = renderIgniteJsx(root, view(), undefined, { hosts: hosts as never });
		await new Promise((resolve) => setTimeout(resolve, 10));
		const node = root.querySelector("[data-ignite-host-description]");
		expect(node?.textContent).toBe("d2");
		expect(root.querySelectorAll("[data-ignite-host-description]").length).toBe(
			1,
		);
	});
	it("E: an operation that supersedes and then throws unwinds quietly in a commit", () => {
		const root = base();
		const hosts = mkHosts(1);
		let trig = false;
		customElements.define(
			"x-r20-throw",
			class extends HTMLElement {
				getAttribute(name: string) {
					if (trig && name === "aria-describedby") {
						trig = false;
						renderIgniteJsx(root, jsx("p", {}), undefined, undefined);
						throw new Error("boom");
					}
					return super.getAttribute(name);
				}
			},
		);
		hosts.hosts.scene = plain({ describe: () => "d" }) as never;
		trig = true;
		expect(() =>
			renderIgniteJsx(
				root,
				jsx("div", { children: jsx("x-r20-throw", { use: "scene" }) }),
				undefined,
				{ hosts: hosts as never },
			),
		).not.toThrow();
	});
	it("E: the same outside a commit does not surface an uncaught error", async () => {
		const root = base();
		const hosts = mkHosts(1);
		let trig = false;
		const uncaught: unknown[] = [];
		const onUncaught = (error: unknown) => void uncaught.push(error);
		process.on("uncaughtException", onUncaught);
		customElements.define(
			"x-r20-micro",
			class extends HTMLElement {
				getAttribute(name: string) {
					if (trig && name === "aria-describedby") {
						trig = false;
						renderIgniteJsx(root, jsx("p", {}), undefined, undefined);
						throw new Error("boom");
					}
					return super.getAttribute(name);
				}
			},
		);
		hosts.hosts.scene = plain({
			describe: () => "d",
			mount: (_el: Element, ctx: { send(event: unknown): void }) => {
				ctx.send("x");
				return {};
			},
		}) as never;
		try {
			renderIgniteJsx(
				root,
				jsx("div", { children: jsx("x-r20-micro", { use: "scene" }) }),
				undefined,
				{ hosts: hosts as never },
			);
			trig = true;
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(uncaught).toEqual([]);
		} finally {
			process.off("uncaughtException", onUncaught);
		}
	});
	it("B: a setter on the fresh description node that supersedes stops the append", () => {
		const root = base();
		const hosts = mkHosts(1);
		let tree1: ReturnType<typeof renderIgniteJsx>;
		let trig = false;
		const view = () =>
			jsx("div", { children: jsx("x-r20-doc", { use: "scene" }) });
		customElements.define(
			"x-r20-doc",
			class extends HTMLElement {
				get ownerDocument() {
					const real = super.ownerDocument;
					return new Proxy(real, {
						get(target, key) {
							if (key === "createElement") {
								return (tag: string) => {
									const span = target.createElement(tag);
									span.setAttribute = (...args: [string, string]) => {
										if (trig) {
											trig = false;
											renderIgniteJsx(root, view(), tree1, {
												hosts: hosts as never,
											});
										}
										Element.prototype.setAttribute.apply(span, args);
									};
									return span;
								};
							}
							const value = Reflect.get(target, key, target);
							return typeof value === "function" ? value.bind(target) : value;
						},
					}) as Document;
				}
			},
		);
		hosts.hosts.scene = plain({ describe: () => "d" }) as never;
		tree1 = renderIgniteJsx(root, view(), undefined, { hosts: hosts as never });
		root.querySelector("[data-ignite-host-description]")?.remove();
		const el = root.querySelector("x-r20-doc") as Element;
		el.removeAttribute("aria-describedby");
		trig = true;
		renderIgniteJsx(root, view(), tree1, { hosts: hosts as never });
		expect(el.querySelectorAll("[data-ignite-host-description]").length).toBe(
			1,
		);
	});
});

describe("R20 renderer.ts and the strategy", () => {
	it("D: a cleanup that renders during an inactive detach is queued and dropped", () => {
		const host = document.createElement("div");
		document.body.append(host);
		const strategy = createIgniteJsxRenderStrategy();
		strategy.attach(host.attachShadow({ mode: "open" }));
		const escaped = vi.fn();
		strategy.render(
			jsx("div", {
				ref: () => () => {
					strategy.render(jsx("span", { ref: escaped }));
				},
			}),
		);
		strategy.detach();
		expect(escaped).not.toHaveBeenCalled();
	});
});

import { describe, expect, it, vi } from "vitest";
import "../../../../ignite-renderer/src/renderers/jsx/hosts";
import { jsx } from "../../../../ignite-renderer/src/renderers/jsx/jsx-runtime";
import { renderIgniteJsx } from "../../../../ignite-renderer/src/renderers/jsx/renderer";

// X6: two bundled copies of the renderer share one realm slot. A render by the
// first copy must still reach its own ownership tools after the second loaded.
describe("X6 two renderer copies in one realm", () => {
	it("a select that supersedes through the first copy stops its mount", async () => {
		vi.resetModules();
		await import("../../../../ignite-renderer/src/renderers/jsx/renderer");
		const root = document.createElement("div");
		document.body.append(root);
		renderIgniteJsx(root, jsx("div", {}), undefined, undefined);
		let mounts = 0;
		const hosts = {
			snapshot: 1,
			send: () => undefined,
			reducedMotion: () => false,
			hosts: {
				scene: {
					select: (n: unknown) => {
						renderIgniteJsx(root, jsx("p", {}), undefined, undefined);
						return n;
					},
					mount: () => {
						mounts++;
						return {};
					},
					dispose: () => undefined,
				},
			},
		};
		renderIgniteJsx(
			root,
			jsx("div", { children: jsx("canvas", { use: "scene" }) }),
			undefined,
			{ hosts: hosts as never },
		);
		expect(mounts).toBe(0);
	});
	it("a nested commit by the second copy hands the slot back", async () => {
		vi.resetModules();
		const second = await import(
			"../../../../ignite-renderer/src/renderers/jsx/renderer"
		);
		const root = document.createElement("div");
		const other = document.createElement("div");
		document.body.append(root, other);
		renderIgniteJsx(root, jsx("div", {}), undefined, undefined);
		let mounts = 0;
		const hosts = {
			snapshot: 1,
			send: () => undefined,
			reducedMotion: () => false,
			hosts: {
				a: {
					select: (n: unknown) => {
						second.renderIgniteJsx(other, jsx("b", {}), undefined, undefined);
						return n;
					},
					mount: () => ({}),
					dispose: () => undefined,
				},
				b: {
					select: (n: unknown) => {
						second.renderIgniteJsx(root, jsx("p", {}), undefined, undefined);
						return n;
					},
					mount: () => {
						mounts++;
						return {};
					},
					dispose: () => undefined,
				},
			},
		};
		renderIgniteJsx(
			root,
			jsx("div", {
				children: [jsx("canvas", { use: "a" }), jsx("canvas", { use: "b" })],
			}),
			undefined,
			{ hosts: hosts as never },
		);
		expect(mounts).toBe(0);
	});
});

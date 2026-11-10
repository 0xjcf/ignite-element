import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(
	new URL("../../../packages/ignite-element/package.json", import.meta.url),
);
const { JSDOM } = require("jsdom");
const { createMachine, createActor, assign } = require("xstate");
const dom = new JSDOM("<!doctype html><body></body>", {
	url: "https://example.test",
});
for (const name of [
	"window",
	"document",
	"HTMLElement",
	"Element",
	"customElements",
	"ShadowRoot",
	"Node",
	"SVGElement",
	"DocumentFragment",
	"Document",
	"HTMLInputElement",
	"HTMLSelectElement",
	"HTMLTextAreaElement",
	"MutationObserver",
	"Event",
	"CustomEvent",
])
	globalThis[name] = dom.window[name];
const { igniteCore } = await import(
	"../../../packages/ignite-element/dist/xstate.es.js"
);
const { jsx } = await import(
	"../../../packages/ignite-element/dist/jsx/index.es.js"
);
const source = createActor(
	createMachine({
		context: { count: 0 },
		on: {
			NEXT: { actions: assign({ count: ({ context }) => context.count + 1 }) },
		},
	}),
).start();
let mounts = 0;
let disposals = 0;
let refs = 0;
let refDisposals = 0;
const updates = [];
const core = igniteCore({
	source,
	hosts: {
		scene: {
			mount() {
				mounts++;
				return {};
			},
			update(_handle, count) {
				updates.push(count);
			},
			dispose() {
				disposals++;
			},
			select: (snapshot) => snapshot.context.count,
			describe: (count) => `${count} complete`,
		},
	},
	states: (snapshot) => ({ count: snapshot.context.count }),
});
const retainCanvas = () => {
	refs++;
	return () => {
		refDisposals++;
	};
};
core("packed-host-probe", () =>
	jsx("canvas", { use: "scene", ref: retainCanvas }),
);

try {
	const element = document.createElement("packed-host-probe");
	document.body.append(element);
	assert.equal(mounts, 1, "built consumer must install host runtime");
	const canvas = element.shadowRoot.querySelector("canvas");
	const description = () =>
		canvas.querySelector(`[id="${canvas.getAttribute("aria-describedby")}"]`)
			?.textContent;
	assert.equal(description(), "0 complete");
	source.send({ type: "NEXT" });
	assert.deepEqual(updates, [0, 1]);
	assert.equal(description(), "1 complete");
	assert.equal(refs, 1);
	element.remove();
	await Promise.resolve();
	await Promise.resolve();
	assert.equal(disposals, 1);
	assert.equal(refDisposals, 1);
	core.dispose();
	source.send({ type: "NEXT" });
	assert.equal(
		source.getSnapshot().context.count,
		2,
		"borrowed source must remain active",
	);
} finally {
	core.dispose();
	source.stop();
	dom.window.close();
}

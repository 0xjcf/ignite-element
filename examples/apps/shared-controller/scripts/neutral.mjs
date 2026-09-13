import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createFakePorts } from "./dist/fake-ports.js";
import { createOwner } from "./dist/owner.js";

const require = createRequire(import.meta.url);
for (const name of [
	"@actor-web/runtime",
	"lit-html",
	"react-dom",
	"xstate",
	"redux",
	"@reduxjs/toolkit",
	"mobx",
	"solid-js",
	"vue",
])
	assert.throws(() => require.resolve(name), { code: "MODULE_NOT_FOUND" });
for (const name of ["document", "HTMLElement", "customElements", "ShadowRoot"])
	assert.equal(typeof globalThis[name], "undefined");
await import("ignite-element/react");
const fake = createFakePorts();
const owner = createOwner({ account: "demo", epoch: "one" }, fake.ports);
const load = owner.core.execute({ command: "check" });
fake.reads[0].resolve({
	kind: "value",
	account: "demo",
	density: "comfortable",
});
await load;
assert.equal(owner.core.get("states").canChoose, true);
owner.dispose();
console.log(
	"Packed canonical controller passes without DOM or unrelated ecosystem peers.",
);

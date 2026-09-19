import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
for (const name of [
	"react-dom",
	"lit-html",
	"solid-js",
	"vue",
	"@actor-web/runtime",
]) {
	assert.throws(() => require.resolve(name), { code: "MODULE_NOT_FOUND" });
}
for (const name of [
	"ignite-element/xstate",
	"ignite-element/redux",
	"ignite-element/mobx",
	"ignite-element/react",
]) {
	assert.ok(
		import.meta
			.resolve(name)
			.startsWith(new URL("./node_modules/", import.meta.url).href),
	);
	await import(name);
}
for (const name of ["document", "HTMLElement", "customElements", "ShadowRoot"])
	assert.equal(typeof globalThis[name], "undefined");
console.log(
	"Packed native entries resolve locally without forbidden peers or fabricated DOM.",
);

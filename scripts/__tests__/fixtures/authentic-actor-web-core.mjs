import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createActorRef } from "@actor-web/runtime";
import { createActorSource } from "@actor-web/runtime/source";
import { igniteCore } from "ignite-element/actor-web";
import { assign, createMachine } from "xstate";

for (const name of ["document", "HTMLElement", "ShadowRoot", "customElements"])
	assert.equal(typeof globalThis[name], "undefined");
for (const name of [
	"react-dom",
	"lit-html",
	"react",
	"vue",
	"solid-js",
	"mobx",
	"@reduxjs/toolkit",
])
	assert.throws(() => createRequire(import.meta.url).resolve(name), {
		code: "MODULE_NOT_FOUND",
	});
const actor = createActorRef(
	createMachine({
		context: { count: 0 },
		on: {
			add: {
				actions: assign({
					count: ({ context, event }) => context.count + event.amount,
				}),
			},
		},
	}),
	{ id: "ignite-public-core-control" },
);
actor.start();
const source = createActorSource(actor);
const core = igniteCore({
	source,
	states: (snapshot) => ({ count: snapshot.context.count }),
	commands: ({ source: actor }) => ({
		add: (amount) => actor.send({ type: "add", amount }),
	}),
});
const seen = [];
let handle;
try {
	assert.equal(core.get("commands"), null);
	assert.equal(core.get("states").count, 0);
	handle = core.watch((next, previous) =>
		seen.push([previous.count, next.count]),
	);
	const result = await core.execute({ command: "add", input: 2 });
	assert.equal(result.snapshot.context.count, 2);
	assert.equal(result.states.count, 2);
	assert.ok(seen.some((pair) => pair[0] === 0 && pair[1] === 2));
	core.dispose();
	const delivered = seen.length;
	await source.send({ type: "add", amount: 3 });
	assert.equal(source.snapshot().context.count, 5);
	assert.equal(seen.length, delivered);
	const factoryCore = igniteCore({
		source: () => source,
		states: (snapshot) => ({ count: snapshot.context.count }),
	});
	assert.equal(factoryCore.get("states").count, 5);
	factoryCore.dispose();
	await source.send({ type: "add", amount: 1 });
	assert.equal(source.snapshot().context.count, 6);
	console.log(
		"Authentic packed Actor-Web source and Ignite core: paired execution, watch release, and caller-owned source/factory lifetime passed.",
	);
} finally {
	handle?.unsubscribe();
	core.dispose();
	await actor.stop();
}

import { afterEach, expect, it, vi } from "vitest";
import { assign, createActor, createMachine, emit, fromCallback } from "xstate";
import { jsx } from "../jsx/jsx-runtime";
import { requireBindingStore } from "../runtime/bindings";
import { igniteCore } from "../xstate";

afterEach(() => document.body.replaceChildren());
const machine = createMachine({
	context: { count: 0 },
	on: {
		INC: {
			actions: [
				assign({ count: ({ context }) => context.count + 1 }),
				emit({ type: "changed" }),
			],
		},
	},
});

it.each(["shared", "isolated"] as const)(
	"terminally ends connected %s registrations and keeps later connections inert",
	(kind) => {
		const source = kind === "shared" ? createActor(machine).start() : undefined;
		const stop = source ? vi.spyOn(source, "stop") : undefined;
		const core = igniteCore({
			source: source ?? machine,
			states: (snapshot) => ({ count: snapshot.context.count }),
			commands: ({ source: actor }) => ({
				increment: () => actor.send({ type: "INC" }),
			}),
		});
		const handle = core("terminal-" + kind, (ctx) =>
			jsx("button", { children: ctx.count, onClick: ctx.increment }),
		);
		const definition = customElements.get(handle.tagName);
		const host = document.createElement(handle.tagName);
		document.body.append(host);
		const held: unknown = Reflect.get(host, "increment");
		if (typeof held !== "function") throw Error("Command missing");
		try {
			held();
			expect(host.shadowRoot?.textContent).toBe("1");
			core.dispose();
			core.dispose();
			expect(host.shadowRoot?.textContent).toBe("");
			expect(() => held()).toThrow(/disposed/);
			const late = document.createElement(handle.tagName);
			document.body.append(late);
			expect(late.shadowRoot?.textContent).toBe("");
			host.remove();
			document.body.append(host);
			expect(host.shadowRoot?.textContent).toBe("");
			expect(customElements.get(handle.tagName)).toBe(definition);
			if (stop) expect(stop).not.toHaveBeenCalled();
		} finally {
			host.remove();
			source?.stop();
		}
	},
);

it("ends each actually acquired isolated actor and its native invocation once", () => {
	const actors: Array<{ getSnapshot(): { status: string } }> = [];
	const invocationRelease = vi.fn();
	const ownedMachine = createMachine({
		context: { count: 0 },
		entry: ({ self }) => {
			actors.push(self);
		},
		invoke: { src: fromCallback(() => invocationRelease) },
	});
	const core = igniteCore({ source: ownedMachine });
	const handle = core("actual-owned-actors", () =>
		jsx("span", { children: "active" }),
	);
	expect(actors).toHaveLength(0);
	const hosts = [
		document.createElement(handle.tagName),
		document.createElement(handle.tagName),
	];
	document.body.append(...hosts);
	expect(actors).toHaveLength(2);
	expect(actors.map((actor) => actor.getSnapshot().status)).toEqual([
		"active",
		"active",
	]);
	core.dispose();
	core.dispose();
	expect(actors.map((actor) => actor.getSnapshot().status)).toEqual([
		"stopped",
		"stopped",
	]);
	expect(invocationRelease).toHaveBeenCalledTimes(2);
	for (const host of hosts) {
		host.remove();
		document.body.append(host);
	}
	expect(actors).toHaveLength(2);
	expect(hosts.every((host) => host.shadowRoot?.textContent === "")).toBe(true);
	expect(invocationRelease).toHaveBeenCalledTimes(2);
});

it("does not render a view returned after disposal during rendering", () => {
	const source = createActor(machine).start();
	const core = igniteCore({ source });
	const handle = core("dispose-in-render", () => {
		core.dispose();
		return jsx("span", { children: "must not return" });
	});
	const host = document.createElement(handle.tagName);
	document.body.append(host);
	expect(host.shadowRoot?.textContent).toBe("");
	expect(source.getSnapshot().status).toBe("active");
	source.stop();
});

it("does not expose the retired registration rebinding operation", () => {
	const source = createActor(machine).start();
	const core = igniteCore({ source });
	const handle = core("no-rebinding", () => jsx("span", { children: "ok" }));
	try {
		expect(Reflect.has(handle, "bind")).toBe(false);
	} finally {
		core.dispose();
		source.stop();
	}
});

it("drains headless watch and event handles without shutting down a borrowed source", () => {
	const source = createActor(machine).start();
	const external = vi.fn();
	const externalHandle = source.on("changed", external);
	const core = igniteCore({
		source,
		events: (event) => ({ changed: event() }),
		commands: ({ source: actor }) => ({
			increment: () => actor.send({ type: "INC" }),
		}),
	});
	const states = vi.fn(),
		events = vi.fn();
	const watch = core.watch(states),
		on = core.on("changed", events);
	const held = requireBindingStore(core).read().increment;
	if (typeof held !== "function") throw Error("Command missing");
	core.dispose();
	core.dispose();
	const count = states.mock.calls.length;
	source.send({ type: "INC" });
	expect(states).toHaveBeenCalledTimes(count);
	expect(events).not.toHaveBeenCalled();
	expect(external).toHaveBeenCalledOnce();
	expect(source.getSnapshot().status).toBe("active");
	expect(() => held()).toThrow(/disposed/);
	watch.unsubscribe();
	on.unsubscribe();
	externalHandle.unsubscribe();
	source.stop();
});

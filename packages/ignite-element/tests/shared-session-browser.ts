import { jsx } from "ignite-element/jsx/jsx-runtime";
import { igniteCore } from "ignite-element/xstate";
import { createActor, SimulatedClock } from "xstate";
import {
	type PreferenceReceipt,
	type PreferenceRequest,
	preferenceMachine,
} from "../../../examples/adapters/xstate/shared-session";

export async function exerciseSessions() {
	const receipts: Array<(receipt: PreferenceReceipt) => void> = [];
	const writes: PreferenceRequest[] = [];
	const clock = new SimulatedClock();
	const source = createActor(preferenceMachine, {
		input: {
			uncertaintyMs: 20,
			ports: {
				save(request) {
					writes.push(request);
					return new Promise((resolve) => receipts.push(resolve));
				},
			},
		},
		clock,
	}).start();
	const core = igniteCore({
		source,
		states: (snapshot) => ({
			value: snapshot.context.value,
			generation: snapshot.context.generation,
			signedIn: snapshot.matches("active"),
			unknown: snapshot.matches({ active: { saving: "unknown" } }),
		}),
		commands: ({ source: actor }) => ({
			save: (value: string, generation: number) =>
				actor.send({ type: "SAVE", value, generation }),
		}),
	});
	let staleIntent = () => {};
	const editor = core("session-editor", (ctx) => {
		const intent = () => ctx.save("compact", ctx.generation);
		if (ctx.generation === 1) staleIntent = intent;
		return jsx("button", {
			onClick: intent,
			children: ctx.signedIn ? ctx.value : "Signed out",
		});
	});
	const summary = core("session-summary", (ctx) =>
		jsx("p", {
			children: ctx.unknown
				? "Unknown"
				: ctx.signedIn
					? ctx.value
					: "Signed out",
		}),
	);
	const names = [editor.tagName, summary.tagName];
	const definitions = names.map((name) => customElements.get(name));
	const hosts = names.map((name) => document.createElement(name));
	try {
		document.body.append(...hosts);
		source.send({ type: "SIGN_IN", account: "A", initial: "A-value" });
		hosts[0].shadowRoot?.querySelector("button")?.click();
		hosts[0].remove();
		clock.increment(20);
		const unknownWhileDetached = hosts[1].shadowRoot?.textContent === "Unknown";
		document.body.append(hosts[0]);
		receipts[0]({ ...writes[0], outcome: "confirmed" });
		await Promise.resolve();
		await Promise.resolve();
		const lateConfirmation = hosts.every(
			(host) => host.shadowRoot?.textContent === "compact",
		);
		hosts[0].shadowRoot?.querySelector("button")?.click();
		source.send({ type: "SIGN_OUT" });
		const signedOut = hosts.every(
			(host) => host.shadowRoot?.textContent === "Signed out",
		);
		source.send({ type: "SIGN_IN", account: "B", initial: "B-value" });
		staleIntent();
		receipts[1]({ ...writes[1], outcome: "confirmed" });
		await Promise.resolve();
		await Promise.resolve();
		const bIsolated =
			hosts.every((host) => host.shadowRoot?.textContent === "B-value") &&
			writes.length === 2;
		source.send({ type: "SIGN_OUT" });
		source.send({ type: "SIGN_IN", account: "A", initial: "fresh-A" });
		const freshA = hosts.every(
			(host) => host.shadowRoot?.textContent === "fresh-A",
		);
		const held: unknown = Reflect.get(hosts[0], "save");
		core.dispose();
		core.dispose();
		const cleared = hosts.every((host) => host.shadowRoot?.textContent === "");
		const late = document.createElement(names[0]);
		document.body.append(late);
		const inertConnection = late.shadowRoot?.textContent === "";
		let staleRejected = false;
		try {
			if (typeof held === "function")
				held("stale", source.getSnapshot().context.generation);
		} catch (error) {
			staleRejected = error instanceof Error && /disposed/.test(error.message);
		}
		return {
			unknownWhileDetached,
			lateConfirmation,
			signedOut,
			bIsolated,
			freshA,
			cleared,
			inertConnection,
			staleRejected,
			borrowedAlive: source.getSnapshot().status === "active",
			definitionsPreserved: names.every(
				(name, index) => customElements.get(name) === definitions[index],
			),
		};
	} finally {
		document.body.replaceChildren();
		source.stop();
	}
}

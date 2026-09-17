/** @jsxImportSource ignite-element/jsx */
import { igniteCore } from "ignite-element/xstate";
import { createActor } from "xstate";
import { type PreferencePorts, preferenceMachine } from "./shared-session";

const ports: PreferencePorts = {
	save: async (request) => ({ ...request, outcome: "confirmed" }),
};
// The application constructs and owns this actor, exactly as in the counter.
export const source = createActor(preferenceMachine, {
	input: { ports, uncertaintyMs: 5000 },
}).start();
export const core = igniteCore({
	source,
	states: (snapshot) => ({
		value: snapshot.context.value,
		generation: snapshot.context.generation,
		signedIn: snapshot.matches("active"),
		unknown: snapshot.matches({ active: { saving: "unknown" } }),
		pending: snapshot.matches({ active: { saving: "pending" } }),
		canSave: snapshot.can({
			type: "SAVE",
			value: "compact",
			generation: snapshot.context.generation,
		}),
	}),
	commands: ({ source: actor }) => ({
		signIn: (account: string, initial: string) =>
			actor.send({ type: "SIGN_IN", account, initial }),
		signOut: () => actor.send({ type: "SIGN_OUT" }),
		save: (value: string, generation: number) =>
			actor.send({ type: "SAVE", value, generation }),
	}),
});
export const editor = core("session-preference-editor", (ctx) => (
	<section>
		<output>{ctx.signedIn ? ctx.value : "Signed out"}</output>
		<button
			type="button"
			disabled={!ctx.canSave}
			onClick={() => ctx.save("compact", ctx.generation)}
		>
			Use compact
		</button>
	</section>
));
export const summary = core("session-preference-summary", (ctx) => (
	<p>
		{ctx.pending
			? "Pending"
			: ctx.unknown
				? "Outcome unknown"
				: ctx.signedIn
					? ctx.value
					: "Signed out"}
	</p>
));
source.send({
	type: "SIGN_IN",
	account: "synthetic-A",
	initial: "comfortable",
});
// core.dispose() never stops this borrowed source.
// At final shutdown the application separately calls source.stop().

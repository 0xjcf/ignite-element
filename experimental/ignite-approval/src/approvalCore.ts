import { igniteCore } from "ignite-element/xstate";
import { assign, createActor, setup } from "xstate";
import { confirmViewFromBytes } from "./confirmView";
import {
	type ApprovalSeed,
	type ApprovalState,
	applyEffects,
	initialApprovalState,
	step,
} from "./machine";
import type { SignedApprovalEvent } from "./types";

export type ApprovalMachineEvent =
	| { type: "SUBMIT_SIGNED"; signed?: SignedApprovalEvent }
	| { type: "CLOSE" };

/**
 * Source: the machine is the gatekeeper. Its only submit action commits
 * `step` and then `applyEffects`. Commands below only send that event.
 */
export function createApprovalMachine(seed: ApprovalSeed) {
	return setup({
		types: {
			context: {} as ApprovalState,
			events: {} as ApprovalMachineEvent,
		},
		actions: {
			commitSigned: assign(({ context, event }) => {
				if (event.type !== "SUBMIT_SIGNED" || !event.signed) return {};
				const trace = step(context, event.signed);
				const next = applyEffects(context, trace);
				return {
					...next,
					canonicalBytes: event.signed.canonicalBytes,
					authenticatorLabel: event.signed.authenticator.label,
					authenticatorKind: event.signed.authenticator.kind,
					provesUserPresence: event.signed.authenticator.provesUserPresence,
				};
			}),
			markClosed: assign({ phase: () => "closed" as const }),
		},
	}).createMachine({
		id: "ignite-approval-spike",
		context: initialApprovalState(seed),
		initial: "open",
		states: {
			open: {
				on: {
					SUBMIT_SIGNED: { actions: "commitSigned" },
					CLOSE: { target: "closed", actions: "markClosed" },
				},
			},
			closed: {},
		},
	});
}

/**
 * States and commands are inline so they stay typed against this machine.
 * The host starts one actor and shares it with the view.
 */
export function createApprovalCore(seed: ApprovalSeed) {
	const source = createActor(createApprovalMachine(seed)).start();
	return igniteCore({
		source,
		states: (snapshot) => {
			const canonicalBytes = snapshot.context.canonicalBytes;
			const confirm = confirmViewFromBytes(canonicalBytes);
			return {
				canonicalBytes,
				moves: confirm.moves,
				destructiveCount: confirm.destructiveCount,
				authenticatorLabel: snapshot.context.authenticatorLabel,
				authenticatorKind: snapshot.context.authenticatorKind,
				provesUserPresence: snapshot.context.provesUserPresence,
				refusal: snapshot.context.trace?.refusal ?? null,
				guards: snapshot.context.trace?.guards ?? null,
				canSubmitSigned: snapshot.can({ type: "SUBMIT_SIGNED" }),
				canClose: snapshot.can({ type: "CLOSE" }),
			};
		},
		commands: ({ source: actor }) => ({
			submitSigned: (signed: SignedApprovalEvent) => {
				actor.send({ type: "SUBMIT_SIGNED", signed });
			},
			close: () => {
				actor.send({ type: "CLOSE" });
			},
		}),
	});
}

export type ApprovalCore = ReturnType<typeof createApprovalCore>;

import { generateKeyPairSync, type KeyObject } from "node:crypto";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createActor } from "xstate";
import { ApprovalConfirmView } from "./ApprovalView";
import { createApprovalCore, createApprovalMachine } from "./approvalCore";
import {
	canonicalizeAction,
	type PendingAction,
	sequenceList,
	setList,
} from "./canonicalize";
import type { AuthenticatorPort } from "./challenge";
import { confirmViewFromBytes } from "./confirmView";
import { igniteApproval } from "./igniteApproval";
import {
	type ApprovalSeed,
	applyEffects,
	approvalBinds,
	hasValidChallenge,
	initialApprovalState,
	isOwner,
	step,
} from "./machine";
import { createMemoryChallengeClient } from "./memoryChallenge";
import {
	createTestAuthenticator,
	TEST_AUTHENTICATOR_LABEL,
} from "./testAuthenticator";
import type { Actor, SignedApprovalEvent } from "./types";

afterEach(cleanup);

function batch(
	projectIds: readonly string[],
	lines: readonly string[],
	secondMove = "rename",
): PendingAction {
	return {
		moves: sequenceList([
			{
				move: "drop",
				projectIds: setList(projectIds),
				lines: sequenceList(lines),
			},
			{
				move: secondMove,
				projectIds: setList(["p-a"]),
				lines: sequenceList(["t-1"]),
			},
		]),
	};
}

const owner: Actor = { id: "jose", kind: "human" };

function pem(key: KeyObject): string {
	const exported = key.export({ type: "spki", format: "pem" });
	if (typeof exported !== "string") throw new Error("expected pem");
	return exported;
}

async function collect(action: PendingAction, actor: Actor = owner) {
	const pair = generateKeyPairSync("ed25519");
	const now = 1_000_000;
	const challenges = createMemoryChallengeClient({
		ttlMs: 60_000,
		maxTtlMs: 120_000,
		now: () => now,
	});
	const approval = igniteApproval({
		challenges,
		authenticator: createTestAuthenticator(pair.privateKey),
	});
	const collection = await approval.collect(action, actor);
	if (!collection.collected) throw new Error("expected a collected signature");
	const seed: ApprovalSeed = {
		ownerId: "jose",
		ownerPublicKeyPem: pem(pair.publicKey),
		now,
		maxTtlMs: 120_000,
		issued: challenges.issued(),
	};
	return { approval, collection, seed, event: collection.event };
}

describe("canonical bytes", () => {
	it("treats a reordered set as the same bytes and a reordered sequence as different bytes", () => {
		const setFirst = canonicalizeAction(
			batch(["p-b", "p-a", "p-b"], ["t-3", "t-1"]),
		);
		const setSecond = canonicalizeAction(batch(["p-a", "p-b"], ["t-3", "t-1"]));
		expect(setFirst).toBe(setSecond);
		expect(setFirst).toContain('"items":["p-a","p-b"]');

		const sequenceFirst = canonicalizeAction(
			batch(["p-a"], ["t-3", "t-1", "t-1"]),
		);
		const sequenceSecond = canonicalizeAction(
			batch(["p-a"], ["t-1", "t-3", "t-1"]),
		);
		expect(sequenceFirst).not.toBe(sequenceSecond);
		expect(sequenceFirst).toContain('"items":["t-3","t-1","t-1"]');
		expect(sequenceSecond).toContain('"items":["t-1","t-3","t-1"]');
	});

	it("rejects an unmarked array", () => {
		expect(() =>
			canonicalizeAction({
				moves: ["drop"] as unknown as PendingAction["moves"],
			}),
		).toThrow(/Unmarked arrays/);
	});
});

describe("confirm view from bytes", () => {
	it("reads the change from the canonical bytes and counts destructive moves", () => {
		const action = batch(["p-b", "p-a"], ["t-3", "t-1"], "close");
		const bytes = canonicalizeAction(action);
		const view = confirmViewFromBytes(bytes);
		const parsed = JSON.parse(bytes) as {
			moves: {
				items: Array<{
					move: string;
					projectIds: { items: string[] };
					lines: { items: string[] };
				}>;
			};
		};

		expect(view.canonicalBytes).toBe(bytes);
		expect(view.unreadable).toBe(false);
		expect(view.moves.map((move) => move.move)).toEqual(
			parsed.moves.items.map((move) => move.move),
		);
		expect(view.moves[0]?.projectIds).toEqual(
			parsed.moves.items[0]?.projectIds.items,
		);
		expect(view.moves[0]?.lines).toEqual(parsed.moves.items[0]?.lines.items);
		expect(view.moves[0]?.projectIds).toEqual(["p-a", "p-b"]);
		expect(view.moves[0]?.lines).toEqual(["t-3", "t-1"]);
		expect(view.destructiveCount).toBe(2);
		expect(JSON.stringify(view)).not.toMatch(/summary/i);

		const reorderedLines = canonicalizeAction(
			batch(["p-b", "p-a"], ["t-1", "t-3"], "close"),
		);
		const reordered = confirmViewFromBytes(reorderedLines);
		expect(reordered.canonicalBytes).not.toBe(bytes);
		expect(reordered.moves[0]?.lines).toEqual(["t-1", "t-3"]);
		expect(reordered.destructiveCount).toBe(2);

		const unsorted = bytes.replace(
			'"projectIds":{"$list":"set","items":["p-a","p-b"]}',
			'"projectIds":{"$list":"set","items":["p-b","p-a"]}',
		);
		expect(confirmViewFromBytes(unsorted).moves[0]?.projectIds).toEqual([
			"p-b",
			"p-a",
		]);
	});
});

describe("machine guards", () => {
	it("refuses a tampered payload with approvalBinds", async () => {
		const action = batch(["p-b", "p-a"], ["t-3", "t-1"]);
		const { seed, event } = await collect(action);
		const tampered: SignedApprovalEvent = {
			...event,
			canonicalBytes: event.canonicalBytes.replace(
				'"move":"drop"',
				'"move":"rename"',
			),
		};
		const state = initialApprovalState(seed);
		expect(approvalBinds(state, tampered)).toBe(false);
		expect(approvalBinds(state, event)).toBe(true);

		const spentBefore = state.spent;
		const pure = step(state, tampered);
		expect(state.spent).toBe(spentBefore);
		expect(pure.guards.approvalBinds).toBe(false);
		expect(pure.guards.isOwner).toBe(true);
		expect(pure.guards.signatureHolds).toBeUndefined();
		expect(pure.refusal).toEqual({
			guard: "approvalBinds",
			code: "action_mismatch",
		});
		expect(pure.to).toBeUndefined();
		expect(pure.effects.map((effect) => effect.type)).toEqual([
			"spendChallenge",
			"audit",
		]);

		const core = createApprovalCore(seed);
		await core.execute({ command: "submitSigned", input: tampered });
		const states = core.get("states");
		expect(states.refusal).toEqual({
			guard: "approvalBinds",
			code: "action_mismatch",
		});
		expect(states.guards?.approvalBinds).toBe(false);
		expect(states.destructiveCount).toBe(0);
		expect(states.destructiveCount).toBe(
			confirmViewFromBytes(states.canonicalBytes).destructiveCount,
		);
		expect(states.canSubmitSigned).toBe(true);
		core.dispose();
	});

	it("refuses a replayed challenge with hasValidChallenge", async () => {
		const { seed, event } = await collect(
			batch(["p-a", "p-b"], ["t-3", "t-1"]),
		);
		const state = initialApprovalState(seed);
		expect(hasValidChallenge(state, event)).toBe(true);
		const first = step(state, event);
		expect(first.refusal).toBeUndefined();
		expect(first.to).toBe("open");
		const spent = applyEffects(state, first);
		expect(hasValidChallenge(spent, event)).toBe(false);
		expect(
			step(state, event).effects.some(
				(effect) => effect.type === "spendChallenge",
			),
		).toBe(true);

		const machine = createApprovalMachine(seed);
		const actor = createActor(machine).start();
		actor.send({ type: "SUBMIT_SIGNED", signed: event });
		const accepted = actor.getSnapshot();
		expect(accepted.context.trace?.refusal).toBeUndefined();
		expect(accepted.context.spent).toEqual([event.challengeId]);
		expect(accepted.context.audit.map((entry) => entry.event)).toEqual([
			"approved",
		]);

		actor.send({ type: "SUBMIT_SIGNED", signed: event });
		const replay = actor.getSnapshot();
		expect(replay.context.trace?.guards.hasValidChallenge).toBe(false);
		expect(replay.context.trace?.guards.challengeKnown).toBe(true);
		expect(replay.context.trace?.guards.isOwner).toBeUndefined();
		expect(replay.context.trace?.refusal).toEqual({
			guard: "hasValidChallenge",
			code: "replay",
		});
		expect(replay.context.trace?.effects.map((effect) => effect.type)).toEqual([
			"audit",
		]);
		expect(replay.context.spent).toEqual([event.challengeId]);
		expect(
			replay.context.audit.map((entry) => [entry.seq, entry.event, entry.code]),
		).toEqual([
			[1, "approved", undefined],
			[2, "refused", "replay"],
		]);
		actor.stop();
	});

	it("refuses a wrong actor with isOwner", async () => {
		const mallory: Actor = { id: "mallory", kind: "human" };
		const { seed, event } = await collect(batch(["p-a"], ["t-1"]), mallory);
		const state = initialApprovalState(seed);
		expect(isOwner(state, event)).toBe(false);
		expect(step(state, event).refusal).toEqual({
			guard: "isOwner",
			code: "wrong_actor",
		});

		const core = createApprovalCore(seed);
		await core.execute({ command: "submitSigned", input: event });
		const states = core.get("states");
		expect(states.guards?.actorIsHuman).toBe(true);
		expect(states.guards?.isOwner).toBe(false);
		expect(states.guards?.approvalBinds).toBeUndefined();
		expect(states.refusal).toEqual({ guard: "isOwner", code: "wrong_actor" });
		expect(states.authenticatorLabel).toBe(TEST_AUTHENTICATOR_LABEL);
		expect(states.provesUserPresence).toBe(false);
		core.dispose();
	});
});

describe("igniteApproval collection", () => {
	it("fails closed without ports and marks the test authenticator", async () => {
		const action = batch(["p-b", "p-a"], ["t-3", "t-1"]);
		expect(() => igniteApproval(undefined)).toThrow(/Named bind only/);
		const closed = igniteApproval({});
		expect(await closed.collect(action, owner)).toEqual({
			collected: false,
			reason: "not_collected",
		});

		const { approval, event } = await collect(action);
		expect(event.authenticator.kind).toBe("test-ed25519");
		expect(event.authenticator.provesUserPresence).toBe(false);
		expect(event.authenticator.label).toBe(TEST_AUTHENTICATOR_LABEL);
		expect(event.canonicalBytes).toBe(approval.canonicalBytes(action));
		expect(approval.confirm(action)).toEqual(
			confirmViewFromBytes(event.canonicalBytes),
		);
		expect(event).not.toHaveProperty("approved");

		const challenges = createMemoryChallengeClient({
			ttlMs: 1000,
			maxTtlMs: 2000,
			now: () => 1,
		});
		const lying: AuthenticatorPort = {
			async assert() {
				return {
					kind: "test-ed25519",
					label: TEST_AUTHENTICATOR_LABEL,
					provesUserPresence: true,
					provesUserVerification: false,
					signature: "aaaa",
				};
			},
		};
		const rejected = igniteApproval({ challenges, authenticator: lying });
		expect(await rejected.collect(action, owner)).toEqual({
			collected: false,
			reason: "not_collected",
		});

		const missingUv: AuthenticatorPort = {
			async assert() {
				return {
					kind: "webauthn",
					challenge: "ignored",
					flags: { up: true, uv: false },
					signature: "aaaa",
				};
			},
		};
		const webauthn = igniteApproval({ challenges, authenticator: missingUv });
		expect(await webauthn.collect(action, owner)).toEqual({
			collected: false,
			reason: "not_collected",
		});
	});
});

describe("confirm view and can flags", () => {
	it("renders the bytes, counts destructive moves, and follows real transitions", async () => {
		const action = batch(["p-b", "p-a"], ["t-3", "t-1"]);
		const { seed, event } = await collect(action);
		const core = createApprovalCore(seed);
		expect(core.get("states").canSubmitSigned).toBe(true);
		expect(core.get("states").canClose).toBe(true);

		await core.execute({ command: "submitSigned", input: event });
		render(<ApprovalConfirmView core={core} />);

		expect(screen.getByTestId("bytes").textContent).toBe(event.canonicalBytes);
		expect(screen.getAllByTestId("projects")[0]?.textContent).toBe("p-a,p-b");
		expect(screen.getAllByTestId("lines")[0]?.textContent).toBe("t-3,t-1");
		expect(screen.getByTestId("destructive-count").textContent).toBe("1");
		expect(screen.getByTestId("authenticator-mark").textContent).toBe(
			TEST_AUTHENTICATOR_LABEL,
		);
		expect(screen.getByTestId("presence").textContent).toBe(
			"Presence not proved",
		);
		expect(
			screen
				.getByRole("button", { name: "Submit signed event" })
				.hasAttribute("disabled"),
		).toBe(false);
		expect(screen.queryByTestId("refusal")).toBeNull();

		await act(async () => {
			await core.execute({ command: "close" });
		});
		expect(core.get("states").canSubmitSigned).toBe(false);
		expect(core.get("states").canClose).toBe(false);
		expect(
			screen
				.getByRole("button", { name: "Submit signed event" })
				.hasAttribute("disabled"),
		).toBe(true);
		core.dispose();
	});
});

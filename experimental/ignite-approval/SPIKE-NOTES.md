# SPIKE-NOTES

Exploratory and throwaway. Branch `spike/ignite-approval`, cut from `beta` at `6ffb9bc`. Do not merge. Nothing here is a package export.

Ledger pull request `#6` (`0xjcf/ledger`, SEC-1) was not readable from this environment: GitHub returned 404 and the repository name did not resolve. The machine in this folder is a lab-shaped stand-in (the attached challenge server and its README), using the guard names from the spike request. It is not ledger's machine. Replace it before any real slice.

## API sketch

Path: `experimental/ignite-approval/src`. Entry: `index.ts`.

1. **Canonical bytes.** `canonicalizeJson` is RFC 8785 for objects, arrays, strings, finite numbers, booleans, and null (UTF-16 key sort, no whitespace). `canonicalizeAction` runs first: every list is marked `set` or `sequence`. A `set` is sorted by each item's canonical form and de-duplicated. A `sequence` keeps order and duplicates. Unmarked arrays throw. `setList` and `sequenceList` build the markers. Project ids are a set. Ledger lines, and the batch of moves, are sequences.

2. **Confirm view.** `confirmViewFromBytes` parses those bytes. It does not take the original object and it does not build a summary string. `moves` is the marked document in byte order. `destructiveCount` is how many of those moves use a name in `DESTRUCTIVE_MOVE_NAMES` (`drop`, `close`, `remove`, `remove_dependency`, `delete`). `countedNames` is that legend, kept outside the signed document. `igniteApproval(...).confirm(action)` is `confirmViewFromBytes(canonicalizeAction(action))`.

3. **Challenge port.** `ChallengeClient.issue({ canonicalBytes })` returns a server-issued `challengeId`, `nonce`, `issuedAt`, `exp`, and `bindingHash`. The hash is SHA-256 of the JCS object `{ canonicalPayload, challengeId, nonce, issuedAt, exp }`. The helper asks the authenticator for user presence and user verification (`required` / `required`). The WebAuthn challenge string is that hash. `createMemoryChallengeClient` is a test double: it issues and stores, and it does not spend. The host copies `issued()` into the machine. The helper has no read method on the port.

4. **Signed event.** `igniteApproval({ challenges, authenticator }).collect(action, actor)` returns either `{ collected: false, reason: "not_collected" }` or `{ collected: true, event }`. The event carries the canonical bytes, the issued challenge fields, the binding hash, the signature, and an authenticator mark. There is no approved flag. Named bind only, same posture as `igniteTools`: a non-object or an unknown key throws; missing ports or a bad assertion collect nothing.

`createTestAuthenticator` is an Ed25519 software key. Its label is `TEST authenticator: Ed25519 software key. A software key does not prove user presence or user verification.` The helper drops a test assertion that claims presence or verification. Simulated UP/UV flags stay on the stub and are not copied onto the event. A software key does not prove user presence.

The React view is `ApprovalConfirmView`. It reads only through `useIgnite` from `ignite-element/react`, then parses `canonicalBytes` with `confirmViewFromBytes`. For `test-ed25519` it always renders "Presence not proved". `createApprovalCore` keeps `states` and `commands` inline on `igniteCore`. Commands send `SUBMIT_SIGNED` or `CLOSE`. `canSubmitSigned` and `canClose` are `snapshot.can(...)` for those events.

## Machine

`step` and the named guards (`challengeKnown`, `hasValidChallenge`, `actorIsHuman`, `isOwner`, `approvalBinds`, `signatureHolds`) are pure. `applyEffects` is the only place a challenge is marked spent or an audit row is appended. The XState machine's submit action calls `step`, then `applyEffects`. That order is the candidate gate for this spike. It is not helper behavior, and this note is not a procedure for the helper.

## Tests

`src/approval.test.tsx`

- A reordered, de-duplicated project-id set produces the same bytes. A reordered line sequence does not. An unmarked array throws.
- The confirm model is parsed from the bytes, including an unsorted set left as written, and its destructive count follows the move names in those bytes.
- Inside the example machine: a tampered payload makes `approvalBinds` refuse (`action_mismatch`), a replayed challenge makes `hasValidChallenge` refuse (`replay`), and another human makes `isOwner` refuse (`wrong_actor`). `step` does not mutate `spent`; the machine commits that effect.
- Collection without ports returns `not_collected`. A test assertion that claims user presence is not collected. The view shows the bytes, the destructive count, and the test-authenticator label.

Run:

```bash
pnpm --filter ignite-element exec vitest --config ../../experimental/ignite-approval/vitest.config.ts --run
pnpm exec tsc --noEmit --pretty false --project experimental/ignite-approval/tsconfig.json
```

These files sit outside `pnpm test` and `pnpm typecheck` on purpose, so the spike cannot ship inside `ignite-element`. Root `biome check` does include them.

## Open questions

- Binding preimage. This spike hashes a JCS object so concatenation order cannot change the meaning. Ledger may already hash a different byte string. The WebAuthn challenge should be the raw digest, with base64url only inside `clientDataJSON`. The spike uses the hex digest as the challenge string so tests can compare it directly.
- Number canonicalization. `JSON.stringify` is not a complete RFC 8785 number formatter. A real slice should use a full JCS implementation if ledger does not already have one.
- Set items other than strings, and whether duplicate project ids are a caller error instead of silent de-duplication.
- One signed document with many moves, versus one challenge per move. The destructive count assumes a sequence of moves. Ledger's action shape may be a single move.
- Which names are destructive. The legend above is local to the view. It must stay a name match against bytes, and ledger's vocabulary may differ.
- User verification for every collection, or only for moves ledger treats as high-value. The lab text points at UV for high-value moves. This helper requests UP and UV whenever it collects.
- Server-side authenticator-data checks. The helper refuses to emit an event whose assertion lacks UP and UV, and it refuses a software key that claims presence. That is collection filtering. It is not evidence a human touched a device. A production machine should verify WebAuthn authenticator data and should not accept `kind: "test-ed25519"`.
- How the host learns the issued record. The helper must not be the component that marks a challenge trusted. This spike copies `issued()` into machine context by hand.
- `igniteTools` already has a canonical snapshot for tool-call identity. It is not RFC 8785 and it does not mark sets. This helper should not call it.
- Whether `igniteApproval` ever becomes a public export. It should stay an application helper until the event fields match ledger.

## What to wait on from ledger

Do not start the real slice until these are visible on the SEC-1 machine (PR `#6` was not available here):

- Guard names and their inputs, including `hasValidChallenge`, `isSignedMove`, `isOwner`, `approvalBinds`, and any others already on that machine.
- The event the UI is allowed to send, field for field.
- Where spend, audit, and the challenge request run (invoked actors versus the server), and the refusal codes the UI may show.
- The issued-challenge record and the exact hash preimage.
- The canonical action schema: field names, which lists are sets, which lists are sequences.
- Whether a human approval is one batch or one line.
- Credential policy: rpId, origin, discoverable credentials, and which moves require user verification.

## Rough size of a real slice

About **8 days** if ledger's gate and challenge record are already the SEC-1 shape. Range **6–10 days**.

- Marked-list canonical bytes, confirm model, property tests against ledger fixtures: 1 day.
- Align the binding hash with ledger's preimage and call the real issue endpoint: 1 day.
- WebAuthn ceremony (UP and UV) in place of the test authenticator, test key kept out of production: 2 days.
- Feed the signed event into ledger's machine without moving guards into the helper; record the trace ledger already expects: 2 days.
- Confirm view on the app shell through `useIgnite`, including empty bytes and a refused event: 1–2 days.
- Spend and audit as effects beside that machine, plus replay and tamper tests on ledger fixtures: 1 day.

Add time if passkey registration and credential storage are not started, or if the SEC-1 guards are still a sketch. This spike does not include that work.

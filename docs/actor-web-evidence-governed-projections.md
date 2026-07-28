# Actor-Web Evidence-Governed Projections

## Status

Normative Ignite-side consumer contract.

## Purpose

This document defines the additive, optional, versioned, JSON-safe boundary
through which Ignite may consume Actor-Web runtime evidence without becoming
the execution authority.

Actor-Web keeps ownership of admission, execution-time authorization, durable
receipts, checkpoints, replay, rehydration, and reconciliation. Ignite may
project those facts, classify unsupported or degraded inputs, bind command
intent, and produce separate Story or narrative evidence.

## Labels

- `Current`: grounded by the current Ignite adapter surface or the current
  Actor-Web neutral runtime envelope.
- `Accepted target`: approved direction that still depends on upstream
  Actor-Web delivery.
- `Candidate`: useful shape or field grouping that may change before upstream
  confirmation.
- `Deferred`: explicitly not shipped yet and blocked on upstream Actor-Web
  contract work.

## Contract Boundaries

- This document is a consumer contract for Ignite and optional downstream FAS
  consumers.
- It does not define a new Actor-Web runtime authority.
- It does not add a public Ignite inspection, blueprint, orchestration,
  receipt-authority, or universal `InteractionPlan` API.
- `canExecute` or similar capability availability remains descriptive preflight
  only.
- `send` acceptance, optimistic projection, or Ignite Story output must never
  be treated as execution success.

## Envelope Taxonomy

Every envelope is JSON-safe and versioned. The discriminant below is the
consumer-facing taxonomy, not a claim that every upstream Actor-Web envelope is
already published.

| Envelope kind | Purpose | Primary owner | Maturity |
| --- | --- | --- | --- |
| `command_proposal` | Consumer intent before admission | consumer application / Ignite host | `Current` |
| `schema_admission` | Structural/schema validation result before runtime execution | Actor-Web runtime | `Accepted target` |
| `domain_acceptance` | Domain-meaningful allow/reject fact after explicit behavior and policy checks | Actor-Web runtime | `Accepted target` |
| `execution_authorization` | Execution-time authorization recheck for principal, approval, revision, idempotency, and policy freshness | Actor-Web runtime | `Accepted target` |
| `effect_intent` | Declared external work attempt correlated to runtime execution | Actor-Web runtime | `Accepted target` |
| `execution_receipt` | Durable authoritative result for execution and effect outcome | Actor-Web runtime | `Deferred` |
| `checkpoint` | Durable resumable session/checkpoint fact | Actor-Web runtime | `Deferred` |
| `rehydration` | Resume/restart fact for the same logical actor or session | Actor-Web runtime | `Deferred` |
| `reconciliation` | Post-attempt or post-resume truth alignment fact | Actor-Web runtime | `Deferred` |

Current upstream evidence is narrower than this taxonomy: Actor-Web currently
publishes a neutral `schemaVersion: 1` runtime event envelope with correlation
and causation identifiers. That envelope is useful current evidence, but it is
not yet the authoritative receipt, checkpoint, or rehydration contract this
document anticipates.

## Consumer Envelope Shape

Ignite consumes a versioned envelope shape with a stable outer frame and
kind-specific payload.

```json
{
  "schemaVersion": 1,
  "kind": "execution_receipt",
  "maturity": "deferred",
  "disposition": "unavailable",
  "provenance": {
    "producer": "actor-web",
    "artifact": "runtime-receipt",
    "artifactVersion": "candidate",
    "redaction": "summary",
    "freshness": {
      "capturedAt": "2026-07-28T16:48:37.288Z",
      "observedAt": "2026-07-28T16:48:37.288Z"
    }
  },
  "joinKeys": {
    "intentId": "intent-123",
    "correlationId": "corr-123",
    "causationId": "cause-123",
    "actorId": "shipment-actor",
    "sessionId": "session-123",
    "attemptId": "attempt-123",
    "sequenceId": "seq-123",
    "receiptId": "receipt-123"
  },
  "payload": {}
}
```

Rules:

- `schemaVersion` describes the consumer envelope version, not a promise about
  any future upstream package version.
- `maturity` must be explicit so deferred Actor-Web task briefs are never
  described as shipped compatibility.
- `disposition` fails closed when evidence is unsupported, malformed, stale,
  conflicting, redacted beyond safe use, or unavailable.
- `provenance` and `joinKeys` stay outside the domain payload so Ignite can
  correlate evidence without claiming authority over it.

## Source-Of-Truth Matrix

| Concern | Source of truth | Ignite role |
| --- | --- | --- |
| Domain command meaning and artifact intent | consumer application behavior | bind intent, preserve IDs |
| Schema admission and malformed rejection | Actor-Web runtime | project admitted/rejected fact |
| Principal, capability, approval, and policy version | Actor-Web runtime | render descriptive status only |
| Execution-time reauthorization | Actor-Web runtime | never infer success or permanence |
| Effect attempt and outcome | Actor-Web runtime | consume receipt when available |
| Durable receipt ordering and idempotency | Actor-Web runtime | preserve provenance and sequence |
| Checkpoint, resume, replay, and reconciliation truth | Actor-Web runtime | project lifecycle facts only |
| Story trace and narrative evidence | Ignite | keep separate from receipts |
| Workflow evidence normalization and review policy | FAS when optionally present | consume exported fixture only |

## Dispositions

Ignite must classify these states as explicit diagnostic facts rather than
throwing or silently inventing success:

| Disposition | Meaning | Expected Ignite behavior |
| --- | --- | --- |
| `unsupported_version` | Envelope version is not understood | fail closed and preserve provenance |
| `malformed` | Required frame or payload shape is invalid | emit deterministic diagnostic fact |
| `stale` | Freshness or revision window is no longer trustworthy | suppress authority claims |
| `conflicting` | Multiple inputs disagree on the same truth claim | preserve both references, do not reconcile locally |
| `redacted` | Sensitive fields were removed beyond safe interpretation | expose limited diagnostic summary only |
| `unavailable` | Expected evidence was not supplied | treat as missing authority, not success |

## Provenance And Join Keys

Ignite, Actor-Web, and FAS artifacts remain separate and are joined only
through explicit identifiers.

Required join-key vocabulary:

- `intentId`: consumer-side proposal identity
- `correlationId`: cross-envelope request lineage
- `causationId`: immediate parent event or command lineage
- `actorId`: authoritative Actor-Web actor identity
- `sessionId`: durable runtime or agent-session identity when applicable
- `attemptId`: individual execution/effect attempt
- `sequenceId`: ordering token within an actor or session stream
- `receiptId`: durable execution receipt identity when published
- `checkpointId`: durable checkpoint identity when published

Rules:

- Ignite Story traces keep their own IDs and may reference the join keys above,
  but they do not replace them.
- FAS bindings may correlate to the same join keys, but FAS remains an optional
  consumer of exported evidence rather than a runtime authority.
- Join keys must survive redaction when possible even if payload details do not.

## Freshness And Redaction

Retention, expiry, and redaction semantics are Actor-Web-owned facts. Ignite
must preserve them descriptively.

- Freshness metadata should identify at least capture time, observed time, and
  any revision or sequence boundary used to judge staleness.
- Redaction must keep enough provenance for audit joins while removing
  credentials, secrets, prompts, raw tool payloads, or other sensitive fields
  the upstream contract marks protected.
- When redaction removes required interpretation fields, the disposition becomes
  `redacted` rather than pretending the remaining payload is authoritative.

## Current Compatibility Floor

Ignite's current shipped compatibility is intentionally looser than the future
evidence contract.

- The compile-only compatibility lane proves that real
  `@actor-web/runtime` source types satisfy Ignite's loose structural
  `ActorWeb*` adapter surface today.
- That current proof covers source snapshots, command/read-model source shapes,
  branded addresses, transport status, and event-subscription options.
- The current Actor-Web neutral runtime event envelope is evidence that
  `schemaVersion: 1` event framing exists today.
- It is not yet proof of an authoritative admission, execution-receipt,
  checkpoint, rehydration, or reconciliation fixture.

## Standalone And Composed Adoption

Standalone Ignite use:

- Ignite may continue to consume the current loose Actor-Web source shape with
  no evidence-governed projection envelope at all.
- The new taxonomy is additive and optional.

Composed Ignite plus Actor-Web plus FAS use:

- Actor-Web may publish versioned evidence fixtures later.
- Ignite may project them without taking execution authority.
- FAS may consume the same exported fixture outside Ignite runtime for workflow
  evidence and review policy.

## Provisional Consumer Requirement Fixture

The example below is intentionally redacted, non-authoritative, and non-shipped.
It documents the minimum consumer expectations without importing FAS or
inventing an upstream Actor-Web schema.

```json
{
  "schemaVersion": 1,
  "kind": "execution_receipt",
  "maturity": "accepted-target",
  "disposition": "redacted",
  "provenance": {
    "producer": "actor-web",
    "artifact": "candidate-runtime-receipt",
    "artifactVersion": "pending-upstream-fixture",
    "redaction": "summary",
    "freshness": {
      "capturedAt": "2026-07-28T16:48:37.288Z",
      "observedAt": "2026-07-28T16:48:37.288Z",
      "sequenceId": "seq-0042"
    }
  },
  "joinKeys": {
    "intentId": "intent-shipment-create-001",
    "correlationId": "corr-shipment-001",
    "causationId": "cmd-shipment-001",
    "actorId": "shipment/primary",
    "sessionId": "session-redacted",
    "attemptId": "attempt-001",
    "sequenceId": "seq-0042",
    "receiptId": "receipt-001"
  },
  "payload": {
    "commandType": "CREATE_SHIPMENT",
    "authorization": {
      "result": "redacted",
      "policyVersion": "policy-2026-07-28"
    },
    "effect": {
      "kind": "transport-dispatch",
      "result": "acknowledged"
    },
    "sensitiveFieldsRemoved": [
      "principal",
      "credential",
      "toolPayload"
    ]
  }
}
```

## Upstream Reconfirmation Gate

No field names in the provisional fixture become an Ignite compatibility claim
until all of the following exist:

1. an authoritative versioned Actor-Web fixture published by the deferred
   upstream tasks
2. the exact upstream package version and fixture path recorded in live docs or
   tests
3. a refreshed Ignite compile-only or fixture-based compatibility assertion
   against that upstream artifact
4. reconfirmed retention, redaction, freshness, and ordering semantics

Until then, this document is the canonical Ignite-side consumer requirement, not
the canonical Actor-Web runtime schema.

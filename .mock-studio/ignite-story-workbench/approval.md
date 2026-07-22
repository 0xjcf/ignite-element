# Ignite Alchemy Approval Gate

Status: narrative-ready pass for the dev/test companion-tool direction; no
rendered acceptance claimed
Recorded: 2026-07-22
Task: `direct-1784661171192` / `task-1784655399770`

## Narrative readiness receipt

Narrative readiness: `pass`

Settled product role:

- Ignite Alchemy is a reusable development/testing companion shell like
  TanStack Devtools or Astro Dev Toolbar.
- Voice Workbench remains the subject application/fixture rendered or attached
  inside Alchemy's preview workspace.
- Alchemy is never the production end-user surface and never runtime authority.

Primary host contract:

- local host remains example-local and dev/test-only for the current POC;
- subject runtime may attach through a dev-only bridge or host adapter;
- headless/CI uses the same Story/controller semantics without rendering
  Alchemy; and
- the optimized subject application build must expose no Alchemy UI, route,
  assets, bridge, inspection endpoints, fixture data, or receipts by default.
  Alchemy may still be served or distributed separately as a dev/test tool.

Page-4 branch admission:

- `ALCH-NAR-001-BRANCH-TYPED-FALLBACK` is admitted from
  `submitPrompt: true` in
  `examples/agents/voice-workbench/src/workbench-narratives.test.ts:600-621`.
- `ALCH-NAR-001-BRANCH-RETRY-MICROPHONE` is admitted from
  `startVoiceCapture: true` in
  `examples/agents/voice-workbench/src/workbench-narratives.test.ts:600-613`
  and retry behavior proven in
  `examples/agents/voice-workbench/src/main.test.tsx:613-632`.

Operator synchronization:

- Step pauses at the page-4 branch boundary.
- Run uses the declared golden typed-fallback branch unless reviewer
  interaction is required.
- Branch choice is an Alchemy lane input recorded in replay/receipt.
- Back rebuilds to the branch boundary and changing choice truncates future
  evidence.
- Retry microphone materializes two explicit branch pages:
  `ALCH-NAR-001-BRANCH-RETRY-PAGE-01-INTENT-START-VOICE-RETRY` and
  `ALCH-NAR-001-BRANCH-RETRY-PAGE-02-CHECKPOINT-VOICE-ATTEMPT-LISTENING`.

Inspector direction:

- Inspector is the docked sibling split pane for Story, Debug, Machine, and
  Evidence.
- Machine owns the live statechart lens and exact `No XState lens` fallback.
- Machine must highlight the edge from the permission-denied recovery posture
  into the child listening attempt for the retry branch.
- Opening Inspector must reflow the subject preview rather than overlay it.

Blocking gaps:

- none for the revised narrative/tool-host contract

## Current gate

Narrative readiness passed for the dev/test companion-tool direction. Before
any new rendered acceptance claim:

- deferred downstream implementation remains tracked in `task-1784602868853`,
  `task-1784602883094`, `task-1784602901002`, `task-1784602939863`, and
  `task-1784602955608`;
- the preferred component must be resynced fresh;
- the next MagicPath revision must materialize the docked Inspector and
  dev/test tool-shell contract; then
- root browser validation and human visual approval remain required.

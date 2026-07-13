# Voice + text workbench — Round 2

This directory is the durable Mock Studio design source for the Ignite Element voice and text workbench example.

Round 2 and its artifact-proof correction were human-approved on 2026-07-13. The production port may proceed from this source under the contract in `mock-studio-handoff.md`; the deterministic fixture remains prototype-only.

## What the example proves

The center document is the observable result, not decorative sample content. The intended production flow is:

1. Text input or a browser speech transcript enters the same `submitPrompt` command with an explicit modality.
2. The model may propose `reviseArtifact` from the component's filtered `getSchema()` manifest.
3. The actor validates the command and stores the next semantic artifact revision.
4. The center document and schema render that accepted revision from Ignite view data.
5. Browser, terminal, and speech consumers commit the same accepted revision independently.

The static Mock Studio source uses a deterministic adoption-plan fixture so both input paths visibly advance revision 2 to revision 3 and add a semantic `plan` node. It is a design and interaction specification, not a live model or `igniteCore` runtime. The production example must make the same sequence real through the existing five-command component contract.

The production example starts from a genuinely empty actor session. It must not copy the prototype artifact, ids, titles, messages, counts, revisions, or responses into runtime source.

Open `source/index.html#ready` through a repository-root static server, or directly with `file://`. The prototype includes these addressable states:

- `#ready` — typed prompt composer and populated artifact.
- `#listening` — active speech capture with a live transcript.
- `#responding` — actor transition and semantic commit progress.
- `#artifact` — committed artifact with document/schema views and speech playback.
- `#permission` — recoverable microphone-permission failure.

## Region mapping

| Prototype region | Production target |
| --- | --- |
| Top runtime bar | Host page chrome around `<voice-workbench>` |
| Conversation and composer | `renderWorkbench` Ignite JSX projection |
| Speech capture state | Optional browser capture adapter that submits its final transcript through the existing `submitPrompt` command; not a new conversation-actor state |
| Artifact document/schema | Existing semantic document-node renderer in `workbench.tsx` |
| Causal teaching inspector | Read-only evidence from the same component: `getSchema()`, model allowlist decisions, current view/actor state, emitted facts, and channel commit receipts |
| Document commit | `createProjectionDocumentTarget` |
| Terminal commit | Direct injectable text/terminal callback; no DOM dependency |
| Speech playback commit | `createProjectionSpeechTarget` plus browser `speechSynthesis` adapter |
| Mock navigator | Prototype scaffolding only; never ships |

All production styles must consume the variables in `source/tokens.css`. Literal color values belong only in that token source.

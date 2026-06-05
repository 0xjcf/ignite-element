# Fix issue #57: conditional JSX children appended instead of replaced on re-render

## Source
Created with `fas create-task` on 2026-06-05.

## Problem
Renderer correctness bug (GitHub issue #57). When the same element toggles between JSX children and an innerHTML branch across re-renders (e.g. a ternary rendering <main>{sections}</main> vs <main innerHTML={html}/>), navigating back to the JSX branch APPENDS duplicate children instead of replacing — child count accumulates each round-trip. ROOT CAUSE (confirmed in packages/ignite-renderer/src/renderers/jsx/renderer.ts): innerHTML is applied as a live DOM property (patchProps -> applyProperty, el.innerHTML = value) that injects child nodes the normalized VDOM 'children' model never tracks, so the positional/append-only child diff desyncs from the real DOM. Two paths turn the desync into duplication: (a) the append-only fast path (patchChildren ~lines 194-217) appends new children and deliberately leaves extra untracked nodes untouched; (b) removeProp clears via Reflect.set(el,'innerHTML',undefined) (~lines 529-532) which is an unreliable subtree clear. innerHTML/textContent/dangerouslySetInnerHTML imperatively OWN an element subtree and are incompatible with the children diff. APPROACH: TDD — replicate FIRST with a failing regression test, then fix. FIX SHAPE: in patchNode/patchChildren, when newNode.props has innerHTML/textContent/dangerouslySetInnerHTML, apply it and SKIP child diffing (opaque subtree); when oldNode had one but newNode does not, hard-clear with element.replaceChildren() BEFORE diffing children (do not rely on Reflect.set(...,undefined)); ensure the append-only fast path cannot leave stale untracked nodes (e.g. gate on parent.childNodes.length === oldChildren.length). Keep the fix internal to the diff strategy; respect the renderer/shell boundary (no core I/O). Run ahead of the v3 docs polish batch (unrelated code).

## Acceptance criteria
- A FAILING regression test is added FIRST (in packages/ignite-element/src/tests/renderers, e.g. diffing.behavior.test.ts) reproducing issue #57: render an element with JSX children, re-render the SAME element with an innerHTML branch, then re-render back to JSX children, asserting the child/section count stays correct with NO duplication or accumulation across repeated toggles. The test MUST fail against current code (bug replicated/red) before the fix is applied
- Root cause fixed in packages/ignite-renderer/src/renderers/jsx/renderer.ts: elements whose subtree is imperatively owned by innerHTML/textContent/dangerouslySetInnerHTML no longer desync the child diff — the subtree prop is applied with child diffing skipped, transitions away hard-clear via replaceChildren() before diffing, and the append-only path does not leave stale untracked nodes
- The new regression test passes (green) and ALL existing renderer/element tests still pass; typecheck and behavior boundaries stay green
- No change to the public renderer API or the stable documented surface; the fix is internal to the JSX diff strategy
- Bug is replicated (red) and the fix verified (green) via npm run test before closeout
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.
- The task is queued in `.fas/queue/tasks.json` for the runtime.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-renderer/src/renderers/jsx/renderer.ts
- packages/ignite-element/src/tests/renderers/diffing.behavior.test.ts
- .gitignore

## Scope Amendments
- 2026-06-05: Added `.mcp.json` to `.gitignore`. The earlier `fas update`
  generate-client-surfaces step wrote a root `.mcp.json` (a generated MCP client
  surface, sibling to the already-ignored `.cursor/`/`.claude/`/`.codex/`); it
  was left untracked and tripped the whole-repo Biome format gate and the
  closeout unexpected-file check. Ignoring it is incidental repo hygiene needed
  to close this fix cleanly; no bearing on the renderer fix itself.

## Implementation plan
- Convert the supplied context into a scoped implementation plan before editing.
- Refresh affected-file scope before implementation if the generated hints are incomplete.

## Verification plan
- Run `fas validate-task` for the inner-loop verification gate.
- Run `.fas/scripts/verify.sh --full` at the final release-quality gate when tracked files change.

## Risks
- Validate generated scope, acceptance criteria, and verification evidence before closeout to avoid workflow drift.

## Dependencies
- None known at task creation.

## Open questions
- None captured at task creation.

## Artifact links
- Planning: `.fas/state/planning.json`
- Task packet: `.fas/state/task-packet.json`
- Commit plan: `.fas/state/commit-plan.json`
- Verification: `.fas/state/verification/latest.json`
- Review: `.fas/state/boundary-review-findings.md`
- Workflow: `.fas/state/workflows/`

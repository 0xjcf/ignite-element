# examples/react: formalize IgniteReactRef public type + land ignite-jsx demo fix (test + docs + changeset)

## Source
Created with `fas create-task` on 2026-06-19.

## Problem
examples/react: formalize IgniteReactRef public type + land ignite-jsx demo fix (test + docs + changeset)

## Acceptance criteria
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Use the supplied problem context, acceptance criteria, and affected-file hints to draft the concrete implementation approach during planning.

## Alternatives considered
- None recorded at task creation. Add rejected approaches during planning if scope tradeoffs appear.

## Affected files
- packages/ignite-element/src/react/igniteReact.tsx
- packages/ignite-element/src/react/index.ts
- packages/ignite-element/src/tests/types/igniteReact.types.test.ts
- packages/ignite-element/src/examples/frameworks/react/src/counter.ignite.tsx
- packages/ignite-element/src/examples/frameworks/react/src/App.tsx
- packages/ignite-element/src/examples/frameworks/react/package.json
- docs/ignite-react.md
- docs/site/src/content/docs/guides/host-app-integration.mdx
- .changeset/ignite-react-ref.md
- packages/ignite-element/src/examples/frameworks/react/src/counter.react.ts
- packages/ignite-element/src/examples/frameworks/react/README.md
- packages/ignite-element/src/examples/frameworks/react/src/counter.css
- packages/ignite-element/src/examples/frameworks/react/src/env.d.ts
- packages/ignite-element/src/examples/frameworks/react/index.html

## Scope Amendments
- Type: scope-refresh
- Added at: 2026-06-19
- Trigger: Option 2 demo split (owner decision)
- Reason: Split the React binding (igniteReact + CounterRef) out of counter.ignite.tsx into a new counter.react.ts to keep the ignite element framework-neutral; updated README to match.
- Added paths: packages/ignite-element/src/examples/frameworks/react/src/counter.react.ts, packages/ignite-element/src/examples/frameworks/react/README.md

- Type: scope-refresh
- Added at: 2026-06-19
- Trigger: owner request: style the demo counter to stand out
- Reason: Inject shadow-DOM styles (counter.css) into the ignite-jsx view; add a *.css?raw type decl (env.d.ts); remove dead shadow-isolated counter rules from index.html.
- Added paths: packages/ignite-element/src/examples/frameworks/react/src/counter.css, packages/ignite-element/src/examples/frameworks/react/src/env.d.ts, packages/ignite-element/src/examples/frameworks/react/index.html

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

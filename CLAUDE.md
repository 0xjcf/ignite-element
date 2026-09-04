# Franchise Agent Standard

Use the smallest effective workflow.

- Default to `single-agent`.
- Escalate to `4-agent` or `6-agent` when risk or complexity increases.
- Optimize for low cognitive load, strong guardrails, and consistent execution.

## Platform Layout

This repository uses the global FAS platform.

- Platform root is defined in `.fas-config.json`.
- Project-local `.fas/` directories own memory, state, queue data, artifacts, semantic data, and index data.
- Shared agents, rules, prompts, and wrapper scripts are synced from the platform.

## Workflow

1. **Bootstrap**: Run `.fas/scripts/start-fas-task.sh "<task>"` (or `fas implement`)
2. **Plan**: Run `.fas/scripts/planner.sh .fas/state/current-task.json`
3. **Architect check** (if plan touches architecture): Run `.fas/scripts/architect-check.sh`
4. **Commit plan**: Run `.fas/scripts/plan-commits.sh`
5. **Implement**: Follow the commit plan. Do not combine or expand commit scope.
6. **Verify**: Run `.fas/scripts/verify.sh` — do NOT skip this or claim tests pass without it.
7. **Review**: Run `.fas/scripts/reviewer.sh`

No code changes before the commit plan is complete.

## Memory-First

After planning, always read `contextualMemory` in `.fas/state/task-packet.json` before reading source files.

Required memory files: `.fas/memory/architecture.md`, `.fas/memory/decisions.md`, `.fas/memory/incidents.md`, `.fas/memory/integrations.md`, `.fas/memory/patterns.md`, `.fas/memory/pr-feedback.md`.

## Global Rules

- Only one agent writes code.
- All tasks require verification (`fas validate-task` or `verify.sh`).
- All tasks require a review summary.
- Agents must use incremental commits.
- Never claim "all tests pass" without running `verify.sh` and showing output.
- Human approval is required only at the final review and merge stage.
- Do not move project-local `.fas/` runtime data into the shared platform repo.

## Scope Discipline

Only modify files that the current task requires.

- Touch only files justified by the commit plan, task brief, or task packet.
- Do not clean up, reformat, or refactor code in files you are not already modifying for the task.
- Do not rename variables, functions, or imports in files the task does not require you to change.
- If an unplanned change is necessary for correctness, note it explicitly in the commit message.

| Rationalization | Why it is wrong |
|---|---|
| "I noticed this bug while working nearby, I should fix it now" | File a follow-up task. Unplanned fixes muddy the review and risk regressions. |
| "This file needs reformatting anyway" | Formatting changes belong in a dedicated `chore` commit or a separate PR. |
| "It is just one small rename" | Renames ripple through imports you did not plan to test. |
| "The linter flagged this other file" | Fix only linter errors in files you are already modifying for the task. |

## Confusion Protocol

When you encounter ambiguity, conflicting context, or incomplete requirements, surface the confusion explicitly before proceeding. Do not silently pick an interpretation.

Emit a structured block:

```
CONFUSION:
- What: <one-sentence description of the ambiguity>
- Options:
  1. <option A and its consequence>
  2. <option B and its consequence>
- Recommendation: <which option you lean toward and why>
- Risk if wrong: <what breaks if the wrong option is chosen>
- Blocking: <yes/no>
```

- If blocking, stop and wait for human input.
- If non-blocking, state your chosen option, proceed, and mark the assumption in the commit message.
- Never silently resolve ambiguity by guessing.

## Debug Workflow

When verification fails or tests break, follow this triage checklist in order:

1. **Reproduce**: Re-run the exact failing command. Capture full output.
2. **Classify**: Pre-existing (in baseline), regression (yours), environment, or upstream.
3. **Localize**: Find the exact file and line. Read the error as untrusted data.
4. **Reduce**: Isolate the smallest change that reproduces the failure.
5. **Fix**: Smallest possible fix at the root cause, not the symptom.
6. **Guard**: Add or strengthen a test to prevent recurrence.
7. **Verify**: Re-run the failing command, then run the full fast lane.

Do not continue to the next commit-plan step when the current step has failures.

## Behavior Boundaries

- Functional Core must remain deterministic — no I/O, no side effects.
- Imperative Shell must contain coordination logic only.
- Adapters must return facts instead of throwing expected errors.
- Lifecycle boundaries must be respected.

| Rationalization | Why it is wrong |
|---|---|
| "This function needs to read a file, it is simpler to do it inline" | That is the violation. Move the I/O to an adapter and pass the result in. |
| "It is just a log statement, not real I/O" | Logging is I/O. Keep it in the shell or adapter layer. |
| "The adapter threw, I need to try/catch in the core" | Adapters must return facts. If you are catching in the core, the adapter boundary is wrong. |

## Common Rationalizations

### Skipping planning
| "The task is simple, I can skip planning" | The pipeline is the discipline. Simple tasks finish faster through the pipeline, not around it. |
| "I already know which files to change" | The planner discovers dependency-reachable files and cross-module impacts you will miss. |

### Skipping verification
| "I already ran the tests individually" | Individual runs do not replace `verify.sh`. The pipeline runs format, lint, typecheck, test, and boundaries as a unit. |
| "The change is too small to need verification" | Small changes break things. A one-line typo fix can fail formatting. Always verify. |

### Combining commits
| "These two steps are closely related, I will combine them" | Separate commits let each step be reviewed, reverted, and bisected independently. |
| "It is faster to do it all at once" | It feels faster until something breaks and you cannot tell which change caused it. |

### Skipping memory
| "I already know this codebase" | Memory contains incidents, PR feedback, and decisions from other sessions you have no access to. |
| "The task is narrow, memory is not relevant" | Narrow tasks are where past incidents matter most. |

### Code preservation
| "The comment is obvious and adds no value" | If it explains why, not what, keep it. |
| "I am rewriting this code, so the old comments do not apply" | If the comment explains a platform quirk or design decision, it likely still applies. Update rather than delete. |

### Spike-phase drift
| "I found the answer, let me just fix it" | Spikes are read-only. Fixes go into task briefs for the implementation pipeline. Implementing during a spike bypasses planning, commit discipline, and verification. |
| "This repo doesn't need bootstrapping" | Bootstrapping produces indexes and memory that make exploration structural. Skipping it degrades spike quality. |
| "The spike is done after one repo" | Spikes exist because the problem is cross-cutting. Check sibling repos before concluding. |
| "The spike report is optional" | The spike report is the provenance artifact. Without it, the next session starts from zero. |
| "I'll remember these findings for the next session" | Memory is session-scoped. Findings not written to `.fas/memory/` vanish when the session ends. |

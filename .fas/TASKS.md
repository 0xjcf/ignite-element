# Task Tracker

## Active Tasks

_None currently._

## Completed Tasks

### Task: refactor igniteCore so commands express intent, add effects-based event emission, preserve deprecated emit-in-commands compatibility, and prepare agent-readable runtime hooks

- Title: refactor igniteCore so commands express intent, add effects-based event emission, preserve deprecated emit-in-commands compatibility, and prepare agent-readable runtime hooks
- Mode: 4-agent
- Status: done
- Owner: reviewer
### Task: finish igniteCore migration path for effects-based events

- Title: finish igniteCore migration path for effects-based events
- Mode: 4-agent
- Status: done
- Owner: reviewer
- Brief: .fas/tasks/finish-ignitecore-migration-path-for-effects-based-events.md
### Task: add igniteCore agent schema generation

- Title: add igniteCore agent schema generation
- Mode: 4-agent
- Status: done
- Owner: reviewer
- Brief: .fas/tasks/add-ignitecore-agent-schema-generation.md
### Task: add effects-aligned testing DSL for ignite components

- Title: add effects-aligned testing DSL for ignite components
- Mode: 4-agent
- Status: done
- Owner: reviewer
- Brief: .fas/tasks/add-effects-aligned-testing-dsl-for-ignite-components.md
### Task: formalize deterministic replay semantics for ignite effects

- Title: formalize deterministic replay semantics for ignite effects
- Mode: 4-agent
- Status: done
- Owner: reviewer
- Brief: .fas/tasks/formalize-deterministic-replay-semantics-for-ignite-effects.md
### Task: remove deprecated emit from commands and finalize command-only API

- Title: remove deprecated emit from commands and finalize command-only API
- Mode: 4-agent
- Status: done
- Owner: reviewer
- Brief: .fas/tasks/remove-deprecated-emit-from-commands-and-finalize-command-on.md
### Task: rename ignite-store to ignite-adapters and normalize adapter package boundaries

- Title: rename ignite-store to ignite-adapters and normalize adapter package boundaries
- Mode: single-agent
- Status: done
- Owner: reviewer
- Brief: .fas/tasks/rename-ignite-store-to-ignite-adapters-and-normalize-adapter.md
### Task: move xstate integration out of ignite-core and make ignite-core adapter-agnostic

- Title: move xstate integration out of ignite-core and make ignite-core adapter-agnostic
- Mode: single-agent
- Status: done
- Owner: reviewer
- Brief: .fas/tasks/move-xstate-integration-out-of-ignite-core-and-make-ignite-c.md
### Task: collapse duplicate projection and component factory assembly into one shared path

- Title: collapse duplicate projection and component factory assembly into one shared path
- Mode: single-agent
- Status: done
- Owner: reviewer
- Brief: .fas/tasks/collapse-duplicate-projection-and-component-factory-assembly.md
### Task: clean package surfaces, remove generated source artifacts, and document the public package contract

- Title: clean package surfaces, remove generated source artifacts, and document the public package contract
- Mode: single-agent
- Status: done
- Owner: reviewer
- Brief: .fas/tasks/clean-package-surfaces-remove-generated-source-artifacts-and.md
### Task: investigate ignite inspector runtime requirements, schema metadata gaps, and effects ergonomics follow-up tasks

- Title: investigate ignite inspector runtime requirements, schema metadata gaps, and effects ergonomics follow-up tasks
- Mode: 6-agent
- Status: done
- Owner: reviewer
- Brief: .fas/tasks/investigate-ignite-inspector-runtime-requirements-schema-met.md
### Task: shared architecture ADR and model alignment

- Title: shared architecture ADR and model alignment
- Mode: 6-agent
- Status: done
- Owner: implementer
- Brief: .fas/tasks/shared-architecture-adr-and-model-alignment.md
- Verification lane: fast
- Policy sensitivity: standard
- Blast radius: cross-cutting
- Artifacts: brief=.fas/tasks/shared-architecture-adr-and-model-alignment.md; planning=.fas/state/planning.json; taskPacket=.fas/state/task-packet.json; commitPlan=.fas/state/commit-plan.json; verification=.fas/state/verification/latest.json; review=.fas/state/review-summary.md; workflow=.fas/state/workflows
### Task: align ignite-element package boundaries with ADR-003

- Title: align ignite-element package boundaries with ADR-003
- Mode: 6-agent
- Status: implementing
- Owner: implementer
- Brief: .fas/tasks/align-ignite-element-package-boundaries-with-adr-003.md
- Verification lane: fast
- Policy sensitivity: standard
- Blast radius: cross-cutting
- Artifacts: brief=.fas/tasks/align-ignite-element-package-boundaries-with-adr-003.md; planning=.fas/state/planning.json; taskPacket=.fas/state/task-packet.json; commitPlan=.fas/state/commit-plan.json; verification=.fas/state/verification/latest.json; review=.fas/state/review-summary.md; workflow=.fas/state/workflows
## Template

### Task: <short task title>

- Title: <short task title>
- Mode: <single-agent | 4-agent | 6-agent>
- Status: <backlog | debug | code-review | planning | commit-planning | implementing | validation | closeout | verifying | review | architecture-review | blocked | done>
- Owner: <role>
- Brief: .fas/tasks/<slug>.md (optional — omit if no brief exists)

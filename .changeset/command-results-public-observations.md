---
"ignite-element": minor
---

Return only the command-defined awaited value or void from core.execute and remove
IgniteAgentExecutionResult. Migrate tools to explicit result/states/declared-event
observations without native snapshots. Clarify completion and existing source
ownership; migrate public consumers and docs. This is a breaking beta migration;
the existing four-package fixed prerelease group determines version effects.

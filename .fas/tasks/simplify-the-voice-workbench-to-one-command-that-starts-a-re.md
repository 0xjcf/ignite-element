# Simplify the voice workbench to one command that starts a recommended MLX model server and the web example with safe lifecycle, configuration, documentation, and verification

## Source
Created with `fas create-task` on 2026-07-13.

## Problem
Provide a root package.json command that gives Apple Silicon developers a smooth local voice-workbench startup: an isolated, pinned MLX LM server using a documented tool-capable default model plus the Vite example, with readiness gating and coordinated shutdown. Keep this entirely in the example/developer-tooling boundary and do not add Ignite runtime API surface.


## Acceptance criteria
- Running pnpm example:voice-workbench from the repository root bootstraps an isolated cached Python environment, starts the MLX server, and starts Vite without manual VITE_MLX_* configuration.
- The default is mlx-community/Mistral-7B-Instruct-v0.3-4bit with mlx-lm 0.31.3; model, package version, Python executable, cache directory, ports, and endpoint may be overridden through documented environment variables.
- The launcher fails clearly on unsupported hardware, missing or incompatible Python, environment bootstrap failure, invalid configuration, startup timeout, port conflicts, or premature child exit.
- Vite starts only after the MLX OpenAI-compatible endpoint is ready, and SIGINT/SIGTERM tear down every launcher-owned child without killing reused external services.
- A handled interactive shutdown exits cleanly without nested package-manager lifecycle errors.
- The launcher behavior is covered by deterministic tests that do not install packages, download a model, or require microphone/network access.
- README documents one-command startup, first-run environment/model download, cache location, local-development security limits, overrides, and the existing manual two-server alternative.
- The work is tracked in `.fas/TASKS.md`.
- The task has a clear implementation and verification plan before execution starts.

## Proposed solution
- Add `pnpm example:voice-workbench` at the repository root and delegate to an
  example-local, dependency-free Node launcher.
- Have the launcher resolve validated environment overrides, require Apple
  Silicon plus Python, create a cache-local virtual environment, install pinned
  `mlx-lm` without mutating system Python, wait for the loopback `/v1/models`
  endpoint, and only then start Vite with the resolved model configuration.
- Treat every child process and external endpoint as an owned resource: forward
  termination to launcher-owned children, never stop a reused server, and fail
  with actionable diagnostics when readiness or a child lifecycle breaks.

## Alternatives considered
- Add `concurrently` or another npm process manager. Rejected because it does
  not provide the endpoint readiness, ownership, and failure semantics this
  example needs without another wrapper layer.
- Use a shell script with a hand-managed virtual environment. Rejected because
  signal behavior and dependency setup would be harder to test and less
  portable across developer shells.
- Require or install `uv`. Rejected after live preflight found `uv` absent on
  the target Apple Silicon machine; adding a separate prerequisite contradicts
  the one-command goal, while the Python standard-library `venv` module already
  provides the required isolation.

## Project standards
- Keep the browser shell thin and keep lifecycle/derived state inside the
  existing XState and `igniteCore.view` boundaries.
- Keep MLX as an optional local adapter; do not add Ignite runtime API surface.
- Use errors-as-data for expected startup failures and deterministic seams for
  tests; do not create environments, install packages, download models, or
  require network/hardware in the test lane.
- Bind the MLX development server to loopback and document its non-production
  security boundary.

## Affected files
- package.json
- examples/agents/voice-workbench/package.json
- examples/agents/voice-workbench/scripts/dev-with-mlx.mjs
- examples/agents/voice-workbench/scripts/dev-with-mlx.test.mjs
- examples/agents/voice-workbench/README.md

## Scope Amendments
- Type: implementation-scope
- Added at: 2026-07-13
- Trigger: Generated plan had zero explicit affected paths
- Reason: The one-command launcher must remain confined to root/example scripts, deterministic tests, and documentation.
- Added paths: package.json, examples/agents/voice-workbench/package.json, examples/agents/voice-workbench/scripts/dev-with-mlx.mjs, examples/agents/voice-workbench/scripts/dev-with-mlx.test.mjs, examples/agents/voice-workbench/README.md
- Evidence source: Primary-source model and launcher research
- Evidence: Primary-source model and launcher research | https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/SERVER.md | MLX documents the local server command and Mistral 7B Instruct 4-bit example; Mistral's model card confirms function calling and the MLX repository is about 4.08 GB.

- Type: design-reassessment
- Added at: 2026-07-13
- Trigger: Live preflight found uv absent on the target Apple Silicon development machine
- Reason: A required manual uv install contradicts the one-command DX goal; a cache-local standard-library venv preserves isolation without extra tooling.
- Evidence source: Local prerequisite preflight and Python packaging boundary
- Evidence: Local prerequisite preflight and Python packaging boundary | examples/agents/voice-workbench/scripts/dev-with-mlx.mjs | Target has python3 3.14 on Darwin arm64 but no uv; mlx-lm declares Python >=3.8 and can be installed into an isolated venv.

## Implementation plan
- Add the root and example package scripts plus a dependency-free Node process orchestrator that creates a cache-local Python virtual environment, installs pinned mlx-lm without mutating system Python, waits on /v1/models, starts Vite with resolved MLX environment, and owns cleanup.
- Factor configuration, bootstrap, readiness, child-exit, and shutdown behavior into testable seams; add deterministic tests with fake processes/fetch/timers.
- Update the voice-workbench README and package metadata without changing Ignite runtime APIs or production component ownership.

## Verification plan
- Run focused launcher tests and the existing voice-workbench suite/typecheck/build.
- Exercise fake-process environment bootstrap, readiness, timeout, premature-exit, external-server reuse, and signal cleanup paths without installing mlx-lm or downloading the model.
- Run fas validate-task, exact-head full verification, and a findings-aware review.

## Risks
- mlx-lm.server is local-development software with basic security checks and must bind to loopback only.
- The first run installs the pinned Python package into a user cache and downloads roughly 4.08 GB; it may take several minutes.
- Tool-calling quality depends on model/server compatibility; keep model and package overrides explicit.
- Python package compatibility may vary by interpreter; provide a Python executable override and never mutate system Python.

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

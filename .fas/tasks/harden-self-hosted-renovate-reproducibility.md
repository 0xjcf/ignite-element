# Harden self-hosted Renovate reproducibility and self-maintenance

## Source
PR #91 CodeRabbit review, merged 2026-07-09.

## Problem
The self-hosted Renovate workflow currently hardcodes the repository slug and
uses the GitHub Action's default Renovate runtime version. The Renovate config
also enables only the npm manager, so it cannot maintain the pinned GitHub
Actions dependencies that run Renovate itself. These are non-blocking rollout
gaps, but leaving them in place makes scheduled dependency automation less
portable, reproducible, and self-maintaining.

## Affected files
- `.github/workflows/renovate.yml`
- `renovate.json`

## Code suggestions from review
Target: `.github/workflows/renovate.yml`, Renovate job environment.

```diff
-          RENOVATE_REPOSITORIES: 0xjcf/ignite-element
+          RENOVATE_REPOSITORIES: ${{ github.repository }}
```

## Acceptance criteria
- `RENOVATE_REPOSITORIES` is derived from `github.repository` instead of a
  hardcoded owner/repository slug.
- The `renovatebot/github-action` step pins `renovate-version` to an explicit
  full version or immutable digest supported by the action.
- `enabledManagers` includes `github-actions` alongside `npm`, allowing
  Renovate to maintain the workflow action and runtime pins.
- Existing npm package rules, `beta` targeting, human-review requirement, and
  no-automerge policy remain unchanged.
- The Renovate configuration and workflow syntax are validated before closeout.

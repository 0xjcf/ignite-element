# V3 beta staged release

This procedure separates version preparation, validation, private registry
staging, independent review, public approval, and verification. It never makes
`main` a v3 product branch: `beta` is the prerelease authority, while
`ignite-element@latest` remains on the v2 stable line.

## One-time external configuration

GitHub can dispatch a manual workflow only when its workflow file exists on the
default branch `main`. Register `.github/workflows/publish.yml` on `main`
without merging v3 source, packages, documentation, or Changesets into that
branch. The workflow must remain byte-identical to the reviewed workflow on the
v3 candidate.

Configure a trusted publisher separately for each of these four npm packages:

| npm package | Trusted-publisher configuration |
| --- | --- |
| `@ignite-element/core` | Provider: GitHub Actions; Owner/organization: 0xjcf; Repository: ignite-element; Workflow filename: publish.yml; Environment: npm-stage; Allowed action: npm stage publish only |
| `@ignite-element/adapters` | Provider: GitHub Actions; Owner/organization: 0xjcf; Repository: ignite-element; Workflow filename: publish.yml; Environment: npm-stage; Allowed action: npm stage publish only |
| `@ignite-element/renderer` | Provider: GitHub Actions; Owner/organization: 0xjcf; Repository: ignite-element; Workflow filename: publish.yml; Environment: npm-stage; Allowed action: npm stage publish only |
| `ignite-element` | Provider: GitHub Actions; Owner/organization: 0xjcf; Repository: ignite-element; Workflow filename: publish.yml; Environment: npm-stage; Allowed action: npm stage publish only |

The npm configuration does not specify the Git branch. GitHub owns the `beta` ref guard
and binds the run to the dispatched commit. Before release use, protect `beta` with
branch protection or an equivalent ruleset.

Create the protected GitHub Environment `npm-stage` and require Operator
approval before its job can start. After trusted publishing is configured and
authenticated for all four packages, change traditional package publishing
access to **Require two-factor authentication and disallow tokens**. No
replacement npm automation token is required, and no publication token belongs
in GitHub secrets or repository configuration.

GitHub tags and Releases remain separate approvals. This procedure does not
create either one.

## Prepare a version commit

Start from a clean local `beta` branch containing reviewed changesets, then run:

```sh
pnpm run release:beta
```

The command checks beta prerelease state, temporarily disables the repository's
Changesets auto-commit setting, runs `changeset version`, restores the config
byte-for-byte, formats only the version output, validates lockstep versions and
internal workspace dependencies, and leaves all changes unstaged for review.
It does not commit, tag, push, stage, or publish. Review and validate those
changes before making the version commit through the normal repository process.

If preparation fails after version mutation, preserve the diagnostic and review
the working-tree diff. Restore only the generated version files to the reviewed
commit before trying again; never continue with a partial or mismatched version
set.

## Pre-dispatch check

An authenticated npm maintainer checks for abandoned or conflicting private
stages before every dispatch:

```sh
npm stage list --json
```

Resolve any conflict through an authenticated interactive session before
starting a new run. The workflow cannot list, approve, or reject existing
stages.

## Dispatch the reviewed beta commit

After the reviewed version commit is on `beta`, dispatch **Stage v3 beta
packages** with the `beta` ref:

```sh
gh workflow run publish.yml --ref beta
```

The workflow file is loaded from the default branch registration, while the run
checks out and validates the exact `beta` revision selected by the dispatch.
Every other ref fails closed.

The validation job has only `contents: read`; it has neither the protected npm
environment nor OIDC authority. It performs a frozen install without release
dependency caching, builds declarations and exports, checks the four package
repository identities, packs core, adapters, renderer, and facade exactly once,
records byte sizes and SHA-256 digests, verifies exact internal dependencies,
tests those exact tarballs as downstream dependencies, and runs the complete
validation profile. It uploads one bounded payload and exposes the artifact ID,
artifact digest, payload digest, commit, and tree to the staging job.

Only after validation succeeds may the staging job enter `npm-stage`. That job
has `contents: read` and `id-token: write`, checks out the validated commit,
uses Node 22 and exactly npm 11.19.1, downloads the validation artifact by its
exact artifact ID, and verifies the artifact binding, payload hash, commit,
tree, manifest hash, package identities, internal versions, tarball sizes, and
tarball hashes. It installs no workspace dependencies and runs no build or test.
It stages only the four downloaded tarballs, in dependency order, using
`--tag beta`, provenance, and OIDC.

Structured `--json` output supplies each stage UUID. The receipt is written
before staging and after every successful package so a partial failure remains
reviewable. The uploaded receipt is not publication approval.

## Independent review

Independent review must match the receipt commit and tree, artifact and payload
identities, all four tarball hashes, validation entries, and stage IDs. A
reviewer can use an authenticated interactive npm session to inspect without
approving:

```sh
npm stage view <stage-id> --json
npm stage download <stage-id>
shasum -a 256 <downloaded-tarball>
```

The downloaded digest must equal the receipt before approval.

## Operator approval and tags

With 2FA present, approve in dependency order. Adapters and renderer may be
approved in either order after core; the deterministic workflow order is core,
adapters, renderer, then facade. The facade is always last.

```sh
npm stage approve <core-stage-id>
npm stage approve <adapters-stage-id>
npm stage approve <renderer-stage-id>
npm stage approve <facade-stage-id>
```

After approval, explicitly reconcile tags. Every package's `beta` tag and the
three scoped packages' `latest` tags point to the approved beta version. The
unscoped facade's `latest` tag stays on v2.

```sh
npm dist-tag add @ignite-element/core@<version> beta
npm dist-tag add @ignite-element/core@<version> latest
npm dist-tag add @ignite-element/adapters@<version> beta
npm dist-tag add @ignite-element/adapters@<version> latest
npm dist-tag add @ignite-element/renderer@<version> beta
npm dist-tag add @ignite-element/renderer@<version> latest
npm dist-tag add ignite-element@<version> beta
```

Do not add the v3 prerelease to `ignite-element@latest`.

Finally run the read-only registry check:

```sh
pnpm run release:beta:verify -- <version>
```

It requires all four exact versions, expected beta and latest tags, exact
internal dependency versions, and exposed provenance attestations. A failed
check is not permission to overwrite or delete a public version.

## Recovery

- **Only some packages staged:** approve none. Preserve the partial receipt,
  inspect `npm stage list --json` and each `npm stage view`, reject the partial
  stages with an interactive 2FA session, then redispatch the unchanged reviewed
  commit. The OIDC job cannot query or reject stages and must fail closed.
- **A staged artifact differs:** approve none. Reject every stage from that run,
  correct the candidate in a new reviewed commit and version if necessary, and
  dispatch again. Never stage a replacement over an existing public version.
- **Only some packages approved:** never unpublish them. Continue only after
  confirming the approved dependencies and tags; approve remaining packages in
  dependency order. Withhold the facade until core, adapters, and renderer are
  public and resolvable.
- **Approval succeeded but a dist-tag update failed:** re-read online dist-tags,
  apply only the missing command from the explicit list above with fresh 2FA,
  then rerun the verifier. Do not republish.
- **Facade withheld:** leave it staged or reject it according to Operator
  judgment. Repair or approve the unavailable dependency first, verify all
  three dependencies, then approve the unchanged matching facade stage. If its
  reviewed artifact is no longer valid, reject it and prepare a later version.

Git tags, GitHub Releases, branch mutation, and stable-v3 integration are
separate approvals and are outside this procedure.

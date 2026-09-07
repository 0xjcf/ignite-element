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
pnpm run release:beta:verify 3.0.0-beta.11
```

Substitute the approved beta version. Both the canonical form above and
`pnpm run release:beta:verify -- 3.0.0-beta.11` are supported, as are direct
`node scripts/verify-beta-release.mjs 3.0.0-beta.11` and the same Node command
with one leading `--`. Exactly one canonical `x.y.z-beta.n` version is required;
numeric components permit zero but not leading zeroes. Whitespace and trailing
newlines are rejected. Invalid input is rejected before any registry request,
including through the exported verifier.

The verifier anonymously queries the public npm registry from a disposable
working directory, with an explicitly pinned npm project root, empty project,
user, and global configuration, and one writable cache shared across that
execution's requests. It excludes inherited authentication
and npm configuration, does not use the repository's project configuration, and
removes its temporary workspace on success or failure. Ancestor project settings
are excluded even when the temporary directory is nested under a project.
It does not require maintainer credentials or repair the workstation's default cache.

This metadata check requires all four exact versions, expected beta and latest
tags, exact internal dependency versions, and presence of attestation metadata.
It does not download or hash tarballs, nor cryptographically verify provenance
signatures. Downloaded-byte and provenance verification remain separate
publication-evidence operations: bind each package to the authoritative workflow
manifest, and verify provenance against the repository, workflow, ref and release
commit using the approved publication procedure. A failed check is not permission
to overwrite or delete a public version.

## Artifact comparison and evidence reuse

Within one release, workflow-generated, staged, and publicly downloaded tarballs
must match the authoritative workflow manifest's **exact raw byte sizes and
hashes**. Record each original size and SHA-256 using:

```sh
wc -c < package.tgz
shasum -a 256 package.tgz
```

For historical or cross-environment comparison only, the previously accepted
differences are limited to:

- The gzip OS-header byte at offset 9, with otherwise identical decompressed
  tar data. Preserve the raw identities, inspect the differing raw bytes with
  `cmp -l historical.tgz current.tgz`, and compare decompressed data using
  `cmp <(gzip -dc historical.tgz) <(gzip -dc current.tgz)` in Bash.
- Dependency-key ordering in the aggregate `package/package.json`, with
  identical dependency values and all other required member content, order and
  metadata. Record precisely which dependency keys were reordered and the
  member-by-member comparison evidence; ordinary semantic JSON equality alone
  is insufficient. This runbook does not introduce an archive-normalization
  tool or authorize repacking published artifacts.

Normalized equivalence must never override a raw mismatch in the
workflow-to-stage-to-publication chain. Record both original raw identities and
the precise comparison result. Any additional difference requires investigation.

Reuse validation only when the relevant content, lockfile/dependency graph,
toolchain, validation profile, declarations/exports and environment inputs match.
A ref-name change or squash merge with the identical relevant tree need not
invalidate evidence; changed validation inputs do. Identify the prerequisite and
candidate commit/tree and the inputs relevant to each reused result. When an
incremental patch digest is useful, generate it reproducibly (replace the two
revision placeholders with authenticated commits):

```sh
git diff --binary --full-index --no-ext-diff --no-textconv --no-renames \
  --src-prefix=a/ --dst-prefix=b/ <prerequisite> <candidate> -- | shasum -a 256
```

This digest describes that exact patch, not validation execution or release
tarball equality. Mandatory Git hooks still run: reused evidence never authorizes
hook bypass. Do not add redundant comparison digests without a defined generation
command and a distinct review purpose.

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

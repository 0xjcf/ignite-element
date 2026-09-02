# V3 beta staged release

This procedure separates version preparation, private registry staging, human
review, public approval, and verification. It never makes `main` a v3 branch:
`beta` is the prerelease authority, while `ignite-element@latest` remains on the
v2 stable line.

## One-time external configuration

Repository administrators configure the protected GitHub Environment
`npm-stage` and an npm trusted publisher for `.github/workflows/publish.yml` on
the `beta` branch. The trust relationship permits `npm stage publish`, uses
GitHub Actions OIDC, and does not grant ordinary unattended publication. No npm
token belongs in GitHub secrets or repository configuration.

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

## Stage reviewed artifacts

After the reviewed version commit is on `beta`, manually dispatch **Stage v3
beta packages** for that exact branch revision. The workflow refuses every
other ref and runs under `npm-stage` with only `contents: read` and
`id-token: write`.

The job authenticates Node 22, npm 11.19.1, and the repository-pinned pnpm;
performs a frozen install; rejects dirty, mismatched, already-public, or
unconsumed-Changesets candidates; builds declarations and exports; packs core,
adapters, renderer, and facade exactly once; records file size and SHA-256;
tests those exact files as downstream dependencies; runs the complete suite;
then stages the same files with `--tag beta`, provenance, and OIDC. Structured
`--json` output supplies each stage ID. The uploaded receipt is not publication
approval.

Independent review must match the receipt commit and tree, all four tarball
hashes, validation entries, and stage IDs. A reviewer can use an authenticated
interactive npm session to inspect without approving:

```sh
npm stage view <stage-id> --json
npm stage download <stage-id>
shasum -a 256 <downloaded-tarball>
```

The downloaded digest must equal the receipt before approval.

## Operator approval and tags

With 2FA present, approve in dependency order. Adapters and renderer may be
approved in either order after core; the facade is always last.

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

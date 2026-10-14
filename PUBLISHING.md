# Publishing

> **Publishing is CI-only. Never publish or stage from a local machine.** Do not run `changeset version`,
> `changeset publish`, `npm publish`, `npm stage publish`, `pnpm publish`, or the internal `ci:stage-release`
> script yourself. A local release bypasses the signed release commit and npm OIDC trusted publishing. Your job as
> a contributor is to land a changeset (see "Day-to-day") and let CI prepare the release; an npm maintainer
> performs the final 2FA approval.

Releases are driven by [changesets](https://github.com/changesets/changesets). Packages are versioned
independently (there is no `fixed` group); `updateInternalDependencies: patch` bumps dependents when a workspace
dependency is released.

## Day-to-day: add a changeset

Every PR that changes files inside a published package must include a changeset. From the repo root:

```bash
pnpm exec changeset
```

Pick the packages and bump type and write a user-facing changelog entry. For changes with no consumer impact
(internal refactors, chores), record an empty changeset instead:

```bash
pnpm exec changeset add --empty
```

The `Changeset check` CI job fails a PR that touches a package without one.

## Release flow (automated)

1. Merging PRs with changesets into `master` triggers the `Release` workflow
   (`.github/workflows/npm-release-trigger.yml`), which opens or updates a **`changesets: Release / Deploy`** PR.
   That PR applies the pending changesets, bumps package versions, and updates each `CHANGELOG.md`.
2. Review and merge that Release PR.
3. On merge, the same workflow uses npm `11.15.0` and runs the release gates (`ci:release-gates`: build,
   typecheck, lint, release script tests, and the full test suite against an anvil fork) before the release bot
   token is minted, so build and test code never sees it. It then packs every publishable package whose version
   is not yet on npm with pnpm, which rewrites `workspace:` ranges to real versions, and fails if any `workspace:`
   range remains.
4. The workflow sends the tarballs to `npm stage publish` under the `latest` dist-tag via **OIDC trusted
   publishing** (no `NPM_TOKEN`). After each package stages, Changesets pushes its package tag (e.g.
   `@0xsequence/wallet-core@3.0.14`) and creates a GitHub Release from its `CHANGELOG.md` entry.
5. An npm maintainer inspects and approves every staged package with 2FA. **Approve in the order listed in the
   workflow run summary** (dependencies first, e.g. `wallet-primitives` before `wallet-core` before `wallet-wdk`)
   so each approved package's dependencies are already installable.

Version-bump commits are signed by GitHub's GPG key (`commitMode: github-api`). The package tags and GitHub
Releases record that CI staged the exact release artifacts; they do not mean npm approval has finished.

### Approve a staged release

On npmjs.com, open each package's **Staged Packages** tab and approve, or from the CLI:

```bash
npm stage list @0xsequence/wallet-core
npm stage view <stage-id>
npm stage approve <stage-id> # prompts for 2FA
```

If one tarball stages and a later tarball fails, do not merge another release. The workflow creates the
successful packages' tags before failing; after fixing the cause, rerun that workflow and the release helper will
skip the tagged stages. If staging succeeded but its package tag was not created, reject that partial stage with
`npm stage reject <stage-id>` before retrying because staging reserves the package version.

## Prerelease / snapshot builds

To prepare a throwaway prerelease under a non-`latest` npm dist-tag, manually dispatch the **Release** workflow —
this is still CI, not a local release:

1. GitHub → **Actions** → **Release** → **Run workflow** (on `master` or a feature branch).
2. Set the **`snapshot_tag`** input to a non-semver dist-tag (e.g. `canary`, `pre-3.0.14`).

The workflow versions **every** publishable package as `0.0.0-<tag>-<timestamp>` on the runner (never committed),
so snapshot packages only depend on each other, then packs and stages them. The snapshot path skips git tags and
GitHub Releases, so **`snapshot_tag` must be a lowercase, non-version tag other than `latest` or `v2-legacy`**. An
npm maintainer must approve the stages before consumers can install them with
`pnpm add @0xsequence/wallet-wdk@<tag>`.

## v2 (`v2-legacy`)

The `v2` branch has its own `npm-release-trigger.yml` with the same flow, except it stages under the
**`v2-legacy`** dist-tag so v2 releases never move `latest` (which belongs to v3). The workflow file name is the
same on both branches, so one trusted publisher configuration per package covers both.

## One-time setup (admins)

- **npm trusted publishers:** run `./scripts/configure-npm-trust.sh` (runs npm 11.15.0 via `npx`; needs an npm login with
  publish rights, and 2FA). It registers `0xsequence/sequence.js` + `npm-release-trigger.yml` as a **stage-only**
  trusted publisher (`--allow-stage-publish`, no `--allow-publish`) for every package on `master` and `v2`, so CI
  can stage but never publish directly. Afterwards, set each package's publishing access to "Require two-factor
  authentication and disallow tokens" and revoke old automation tokens.
- **GitHub:** the release workflow authenticates as the **0xsequence Changesets Release Bot** GitHub App, owned
  by the `0xsequence` org (Polygon's `0xpolygon-changesets-release-bot` is private to `0xPolygon` and cannot be
  installed here). The app needs repository permissions **Contents: read & write** and **Pull requests: read &
  write**, no webhook, and is installed on this repository only. Its App ID and a private key are stored as the
  repository secrets `CHANGESET_RELEASE_BOT_APP_ID` and `CHANGESET_RELEASE_BOT_APP_PRIVATE_KEY`. The app (not the
  default `GITHUB_TOKEN`) is required so the release PR triggers CI and its commits are signed. To rotate the key,
  generate a new one in the app settings, update the secret, then delete the old key.

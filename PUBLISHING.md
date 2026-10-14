# Publishing (v2)

> **Publishing is CI-only. Never publish or stage from a local machine.** Do not run `changeset:version`,
> `changeset:publish`, `npm publish`, `npm stage publish`, or the internal `ci:stage-release` script yourself.

v2 uses the same staged publishing flow as `master`; see `PUBLISHING.md` on `master` for the full description,
approval steps, failure recovery, and one-time setup. The differences on this branch:

- **Dist-tag:** releases stage under **`v2-legacy`**, never `latest` (which belongs to v3). Install v2 with
  `pnpm add @0xsequence/<package>@v2-legacy`.
- **Trigger:** merging changesets into `v2` opens a `changesets: Release / Deploy (v2)` PR; merging that PR stages
  the packages. Versioning runs `pnpm changeset:version`, which also updates the embedded version constant and the
  network names doc.
- **Release gates:** build (which includes typecheck), lint, and the release script tests, run before the release bot
  token is minted. The per-package test matrix in
  `tests.yml` already runs on every push to `v2`, including the release PR merge.
- **Linked versions:** all `@0xsequence/*` packages are `linked`, so a release stages every package at one version.

## Day-to-day: add a changeset

```bash
pnpm changeset
```

The `Changeset check` CI job fails a PR into `v2` that touches a package without one
(`pnpm changeset add --empty` for changes with no consumer impact).

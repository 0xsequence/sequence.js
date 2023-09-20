0xsequence
==========

[Sequence](https://sequence.xyz): a modular web3 stack and smart wallet for Ethereum chains

## Usage

`npm install 0xsequence ethers`

or

`pnpm install 0xsequence ethers`

or

`yarn add 0xsequence ethers`


## Packages

- [0xsequence](./packages/0xsequence)
- [@0xsequence/abi](./packages/abi)
- [@0xsequence/api](./packages/api)
- [@0xsequence/auth](./packages/auth)
- [@0xsequence/core](./packages/core)
- [@0xsequence/deployer](./packages/deployer)
- [@0xsequence/guard](./packages/guard)
- [@0xsequence/multicall](./packages/multicall)
- [@0xsequence/network](./packages/network)
- [@0xsequence/provider](./packages/provider)
- [@0xsequence/relayer](./packages/relayer)
- [@0xsequence/replacer](./packages/replacer)
- [@0xsequence/sessions](./packages/sessions)
- [@0xsequence/signhub](./packages/signhub)
- [@0xsequence/utils](./packages/utils)
- [@0xsequence/wallet](./packages/wallet)


## Development Environment

Below are notes and instructions on how to get your development environment up and running,
and enjoyable.

1. **Install dependencies**
   Run, `pnpm install`

2. **Workflow** -- we use the amazing [preconstruct](https://github.com/preconstruct/preconstruct)
   package to handle our monorepo build system.

3. **Local dev** -- when you're working on the code in this repository, you can safely run
   `pnpm dev` at the root-level, which will link all packages/** together, so that when a
   local dependency from packages/** is used by another, it will automatically be linked
   without having to run a build command. Just remember: run `pnpm dev` anytime you developing
   in this repo. Note, that when you run `pnpm build` it will clear the dev environment, so
   you will need to run `pnpm dev` again after a build. However, `pnpm build` should only be
   used when making a release.

4. **Testing** -- to test the system, you can run `pnpm test` at the top-level or at an individual
   package-level.

5. **Type-checking** -- to typecheck the system you can run `pnpm typecheck` at any level.

6. **Building** -- to _compile_ the project to dist files for a release, run `pnpm build` at
   the root-level. Note building packages repeatedly during development is unnecessary with
   `preconstruct`. During local development run `pnpm dev` and when building to make a release,
   run `pnpm build`.

7. **Versioning** -- this repository uses the handy [changesets](https://github.com/atlassian/changesets)
   package for package versioning across the monorepo, as well as changelogs. See _Releasing_ section below.


## Releasing to NPM

0xsequence uses changesets to do versioning. This makes releasing really easy and changelogs are automatically generated.

### How to do a release

1. Run `pnpm` to make sure everything is up to date
2. Code.. do your magic
3. Run `pnpm changeset` to generate a new .changeset/ entry explaining the code changes
4. Version bump all packages regardless of them having changes or not
5. Run `pnpm i` to update the pnpm-lock.yaml.
6. Commit and submit your changes as a PR for review
7. Once merged and you're ready to make a release, continue to the next step. If you're not
   ready to make a release, then go back to step 2.
8. Run `pnpm build && pnpm test` to double check all tests pass
9. Run `pnpm version-packages` to bump versions of the packages
10. Run `pnpm install` so we update our pnpm-lock.yaml file with our newly created version
11. Commit files after versioning. This is the commit that will be published and tagged: `git push --no-verify`
12. Run `pnpm release`. If the 2FA code timesout while publishing, run the command again
    with a new code, only the packages that were not published will be published.
13. Finally, push your git tags, via: `git push --tags --no-verify`


## How to do a snapshot release

Snapshot releases are versioned as 0.0.0-YYYYmmddHHMMSS and are intended for testing builds only.

1. `pnpm snapshot` (select all packages even if unchanged, the message is not important)
2. Do not commit any changes to package.json's or CHANGELOG.md's that happened during 1.

## NOTES

1. Browser tests can be run with `pnpm test` or, separately `pnpm test:server` and `pnpm test:run`
2. To run a specific test, run `pnpm test:only <test-file-basename>`, ie. `pnpm test:only window-transport`


## TIPS

* If you're using node v18+ and you hit the error `Error: error:0308010C:digital envelope routines::unsupported`,
  make sure to first set, `export NODE_OPTIONS=--openssl-legacy-provider`


## LICENSE

Apache-2.0

Copyright (c) 2017-present Horizon Blockchain Games Inc. / https://horizon.io

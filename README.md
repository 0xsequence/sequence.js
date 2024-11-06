# 0xsequence

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
- [@0xsequence/marketplace](./packages/marketplace)
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

Authorization on https://www.npmjs.com/ to push to the 0xsequence organization's packages is required.

0. (first time) `pnpm login`
1. check that master is passing tests on github
2. (warning: destructive) start from a clean repo:
   `git checkout master && git reset --hard && git clean -dfx && pnpm i`
3. for each new change:
   a. `pnpm changeset`
   b. select all packages
   c. update all packages with either a minor or patch bump according to semver
   d. add a summary of the form: `package: description of a single change`
   e. repeat a-d until all changes are accounted for
4. `pnpm changeset:version && pnpm i && pnpm build && pnpm i`
5. `git diff` and copy the newest version according to the changelogs
6. `git commit -a -m <new version here>`
7. `git push`
8. `pnpm changeset:publish` and enter your 2fa totp token when prompted
9. `git push --tags`

## How to do a snapshot release

Authorization on https://www.npmjs.com/ to push to the 0xsequence organization's packages is required.

Snapshot releases are versioned as 0.0.0-YYYYmmddHHMMSS and are intended for testing builds only.

0. (first time) `pnpm login`
1. (warning: destructive) start from a clean repo:
   `git checkout <branch or commit to snapshot> && git reset --hard && git clean -dfx && pnpm i`
2. `pnpm changeset:snapshot`
   a. select all packages
   b. update all packages with a patch bump
   c. any summary is ok
   d. enter your 2fa totp token when prompted
   e. note the snapshot version 0.0.0-YYYYmmddHHMMSS
3. `git reset --hard`

## NOTES

1. Browser tests can be run with `pnpm test` or, separately `pnpm test:server` and `pnpm test:run`
2. To run a specific test, run `pnpm test:only <test-file-basename>`, ie. `pnpm test:only window-transport`

## TIPS

- If you're using node v18+ and you hit the error `Error: error:0308010C:digital envelope routines::unsupported`,
  make sure to first set, `export NODE_OPTIONS=--openssl-legacy-provider`

## LICENSE

Apache-2.0

Copyright (c) 2017-present Horizon Blockchain Games Inc. / https://horizon.io

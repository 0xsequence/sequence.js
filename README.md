0xsequence.js
=============

A simple & powerful Ethereum development library and Web-based smart wallet.


## Usage

`yarn install 0xsequence`

## Packages

* 0xsequence
* abi
* api
* auth
* bridge
* chaind
* deployer
* guard
* networks
* provider
* transactions
* wallet


## Development Environment

Below are notes and instructions on how to get your development environment up and running,
and enjoyable.

1. **Install dependencies** -- we use yarn workspaces, so please use yarn instead of npm.
Run,  `yarn install`

2. **Workflow** -- we use the amazing [preconstruct](https://github.com/preconstruct/preconstruct)
package to handle our monorepo build system.

3. **Local dev** -- when you're working on the code in this repository, you can safely run
`yarn dev` at the root-level, which will link all packages/** together, so that when a
local dependency from packages/** is used by another, it will automatically be linked
without having to run a build command. Just remember: run `yarn dev` anytime you developing
in this repo. Note, that when you run `yarn build` it will clear the dev environment, so
you will need to run `yarn dev` again after a build. However, `yarn build` should only be
used when making a release.

4. **Testing** -- to test the system, you can run `yarn test` at the top-level or at an individual
package-level.

5. **Type-checking** -- to typecheck the system you can run `yarn typecheck` at any level.

6. **Building** -- to *compile* the project to dist files for a release, run `yarn build` at
the root-level. Note building packages repeatedly during development is unnecessary with
`preconstruct`. During local development run `yarn dev` and when building to make a release,
run `yarn build`. 

7. **Versioning** -- this repository uses the handy [changesets](https://github.com/atlassian/changesets)
package for package versioning across the monorepo, as well as changelogs. See *Releasing* section below.

## Releasing to NPM

0xsequence uses changesets to do versioning. This makes releasing really easy and changelogs are automatically generated.

### How to do a release

1. Run `yarn` to make sure everything is up to date
2. Run `yarn version-packages`
3. Run NPM_CONFIG_OTP=PUTANOTPCODEHERE `yarn release`. If the 2FA code times out while publishing, run the command again
with a new code, only the packages that were not published will be published.


## NOTES

1. Browser tests can be run with `yarn test` or, separately `yarn test:server` and `yarn test:run`
2. To run a specific test, run `yarn test:only <test-file-basename>`, ie. `yarn test:only window-transport`


## LICENSE

Apache-2.0

Copyright (c) 2017-present Horizon Blockchain Games Inc. / https://horizon.io

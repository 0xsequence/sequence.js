0xsequence
==========

## Install

`npm install 0xsequence ethers`

or

`pnpm install 0xsequence ethers`

or

`yarn add 0xsequence ethers`


## Development Workflow

Sequence is a critical piece of software and any change should be delivered via a TDD (test-driven development)
workflow. 

As well, sequence.js's monorepo tooling is setup with preconstruct, which links all sub-packages together
so it feels like a single program and is easy to work with. Please run `pnpm dev` in the root of `sequence.js/`
folder to ensure the monorepo is in 'dev-mode'.

Second, you can run the test suite directly from console with a single `pnpm test`, or you can boot up the Typescript
compiling server (`pnpm test:server`) and ethereum test node (`pnpm start:hardhat` and `pnpm start:hardhat2`) manually
in separate terminals, and then run a specific test directly from your browser instance. We recommend running the
test stack separately and running specific browser tests manually during development. See [here for recommended setup](./#from-browser).


## Running E2E Tests

This 0xsequence top-level package contains e2e tests which run in a headless chrome browser.

You can view tests running directly from the browser directly, or from the cli which will communicate
to the headless browser behind the scenes. See below. Please note, for an improved development workflow
we highly recommend to view your tests running from the browser as its more clear and better experience.


### From Browser

1. `pnpm test:server` -- in one terminal, to start the webpack server compiling typescript
2. `pnpm start:hardhat` -- in a second terminal, to start hardhat local ethereum test node
3. `pnpm start:hardhat2` -- (2nd chain) in a third terminal, to start hardhat2 local ethereum test node
4. open browser to `http://localhost:9999/{browser-test-dir}/{test-filename}.test.html` for example,
   http://localhost:9999/wallet-provider/dapp.test.html
5. open your browser console so you can see the tests running and their results.

Finally, if you'd like to run only a specific test case, either add a temporary "return" statement
following the last test case, so you will preempt the runner after a certain test case.

As well, since you have all the services running in terminals, you can also execute commands via
the cli by calling `test:run`, which is similar to step 4 above, but executing all tests from the terminal.
There is also the `test:only` command if you'd like to execute a specific test from ./tests/browser/*.spec.ts
file, ie. `pnpm test:only window-transport`.


### From CLI

With a single command, you can spin up the testing stack and execute tests:

`pnpm test`

This is useful for a sanity check to ensure tests pass, or using it with the CI. However, if you're
developing on sequence.js, its highly recommended you follow the [development workflow instructions](./#development-workflow).


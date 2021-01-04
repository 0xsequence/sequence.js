0xsequence
==========

## Install

```
yarn install 0xsequence
```


## Running Browser E2E Tests

The 0xsequence top-level package also contains e2e tests which run in a headless chrome browser.

You can run the test suite directly from console with a single `yarn test`, or you can boot up the typescript
compiling server (`yarn test:server`) and ethereum test node (`yarn start:hardhat`) manually in separate
terminals, and then run a specific test directly from your browser instance by visiting the path:

* `http://localhost:9999/{browser-test-dir}/{test-filename}.test.html`
* ie. tests/browser/wallet-provider/dapp.test.ts is accessible via: http://localhost:9999/wallet-provider/dapp.test.html

### From CLI

`yarn test`

### From Browser

1. `yarn test:server` -- in one terminal, to start the webpack server compiling typescript
2. `yarn start:hard` -- in another terminal, to start hardhat local ethereum test node
3. open browser to `http://localhost:9999/{browser-test-dir}/{test-filename}.test.html` for example,
   http://localhost:9999/wallet-provider/dapp.test.html

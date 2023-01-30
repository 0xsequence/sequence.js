# @0xsequence/indexer

## 0.43.14

### Patch Changes

- bump

## 0.43.13

### Patch Changes

- update rpc bindings

## 0.43.12

### Patch Changes

- provider: single wallet init, and add new unregisterWallet() method

## 0.43.11

### Patch Changes

- fix lockfiles
- re-add mocha type deleter

## 0.43.10

### Patch Changes

- various improvements

## 0.43.9

### Patch Changes

- update deps

## 0.43.8

### Patch Changes

- network: JsonRpcProvider with caching

## 0.43.7

### Patch Changes

- provider: fix wallet network init

## 0.43.6

### Patch Changes

- metadatata: update rpc bindings

## 0.43.5

### Patch Changes

- provider: do not set default network for connect messages
- provider: forward missing error message

## 0.43.4

### Patch Changes

- no-change version bump to fix incorrectly tagged snapshot build

## 0.43.3

### Patch Changes

- metadata: update bindings

## 0.43.2

### Patch Changes

- provider: implement connectUnchecked

## 0.43.1

### Patch Changes

- update to latest ethauth dep

## 0.43.0

### Minor Changes

- move ethers to a peer dependency

## 0.42.10

### Patch Changes

- add auxDataProvider

## 0.42.9

### Patch Changes

- provider: add eip-191 exceptions

## 0.42.8

### Patch Changes

- provider: skip setting intent origin if we're unity plugin

## 0.42.7

### Patch Changes

- Add sign in options to connection settings

## 0.42.6

### Patch Changes

- api bindings update

## 0.42.5

### Patch Changes

- relayer: don't treat missing receipt as hard failure

## 0.42.4

### Patch Changes

- provider: add custom app protocol to connect options

## 0.42.3

### Patch Changes

- update api bindings

## 0.42.2

### Patch Changes

- disable rinkeby network

## 0.42.1

### Patch Changes

- wallet: optional waitForReceipt parameter

## 0.42.0

### Minor Changes

- relayer: estimateGasLimits -> simulate
- add simulator package

### Patch Changes

- transactions: fix flattenAuxTransactions
- provider: only filter nullish values
- provider: re-map transaction 'gas' back to 'gasLimit'

## 0.41.3

### Patch Changes

- api bindings update

## 0.41.2

### Patch Changes

- api bindings update

## 0.41.1

### Patch Changes

- update default networks

## 0.41.0

### Minor Changes

- relayer: fix Relayer.wait() interface

  The interface for calling Relayer.wait() has changed. Instead of a single optional ill-defined timeout/delay parameter, there are three optional parameters, in order:

  - timeout: the maximum time to wait for the transaction receipt
  - delay: the polling interval, i.e. the time to wait between requests
  - maxFails: the maximum number of hard failures to tolerate before giving up

  Please update your codebase accordingly.

- relayer: add optional waitForReceipt parameter to Relayer.relay

  The behaviour of Relayer.relay() was not well-defined with respect to whether or not it waited for a receipt.
  This change allows the caller to specify whether to wait or not, with the default behaviour being to wait.

### Patch Changes

- relayer: wait receipt retry logic
- fix wrapped object error
- provider: forward delegateCall and revertOnError transaction fields

## 0.40.6

### Patch Changes

- add arbitrum-nova chain

## 0.40.5

### Patch Changes

- api: update bindings

## 0.40.4

### Patch Changes

- add unreal transport

## 0.40.3

### Patch Changes

- provider: fix MessageToSign message type

## 0.40.2

### Patch Changes

- Wallet provider, loadSession method

## 0.40.1

### Patch Changes

- export sequence.initWallet and sequence.getWallet

## 0.40.0

### Minor Changes

- add sequence.initWallet(network, config) and sequence.getWallet() helper methods

## 0.39.6

### Patch Changes

- indexer: update client bindings

## 0.39.5

### Patch Changes

- provider: fix networkRpcUrl config option

## 0.39.4

### Patch Changes

- api: update client bindings

## 0.39.3

### Patch Changes

- add request method on Web3Provider

## 0.39.2

### Patch Changes

- update umd name

## 0.39.1

### Patch Changes

- add Aurora network
- add origin info for accountsChanged event to handle it per dapp

## 0.39.0

### Minor Changes

- abstract window.localStorage to interface type

## 0.38.2

### Patch Changes

- provider: add Settings.defaultPurchaseAmount

## 0.38.1

### Patch Changes

- update api and metadata rpc bindings

## 0.38.0

### Minor Changes

- api: update bindings, change TokenPrice interface
- bridge: remove @0xsequence/bridge package
- api: update bindings, rename ContractCallArg to TupleComponent

## 0.37.1

### Patch Changes

- Add back sortNetworks - Removing sorting was a breaking change for dapps on older versions which directly integrate sequence.

## 0.37.0

### Minor Changes

- network related fixes and improvements
- api: bindings: exchange rate lookups

## 0.36.13

### Patch Changes

- api: update bindings with new price endpoints

## 0.36.12

### Patch Changes

- wallet: skip remote signers if not needed
- auth: check that signature meets threshold before requesting auth token

## 0.36.11

### Patch Changes

- Prefix EIP191 message on wallet-request-handler

## 0.36.10

### Patch Changes

- support bannerUrl on connect

## 0.36.9

### Patch Changes

- minor dev xp improvements

## 0.36.8

### Patch Changes

- more connect options (theme, payment providers, funding currencies)

## 0.36.7

### Patch Changes

- fix missing break

## 0.36.6

### Patch Changes

- wallet_switchEthereumChain support

## 0.36.5

### Patch Changes

- auth: bump ethauth to 0.7.0
  network, wallet: don't assume position of auth network in list
  api/indexer/metadata: trim trailing slash on hostname, and add endpoint urls
  relayer: Allow to specify local relayer transaction parameters like gas price or gas limit

## 0.36.4

### Patch Changes

- Updating list of chain ids to include other ethereum compatible chains

## 0.36.3

### Patch Changes

- provider: pass connect options to prompter methods

## 0.36.2

### Patch Changes

- transactions: Setting target to 0x0 when empty to during SequenceTxAbiEncode

## 0.36.1

### Patch Changes

- metadata: update client with more fields

## 0.36.0

### Minor Changes

- relayer, wallet: fee quote support

## 0.35.12

### Patch Changes

- provider: rename wallet.commands to wallet.utils

## 0.35.11

### Patch Changes

- provider/utils: smoother message validation

## 0.35.10

### Patch Changes

- upgrade deps

## 0.35.9

### Patch Changes

- provider: window-transport override event handlers with new wallet instance

## 0.35.8

### Patch Changes

- provider: async wallet sign in improvements

## 0.35.7

### Patch Changes

- config: cache wallet configs

## 0.35.6

### Patch Changes

- provider: support async signin of wallet request handler

## 0.35.5

### Patch Changes

- wallet: skip threshold check during fee estimation

## 0.35.4

### Patch Changes

- - browser extension mode, center window

## 0.35.3

### Patch Changes

- - update window position when in browser extension mode

## 0.35.2

### Patch Changes

- - provider: WindowMessageHandler accept optional windowHref

## 0.35.1

### Patch Changes

- wallet: update config on undeployed too

## 0.35.0

### Minor Changes

- - config: add buildStubSignature
  - provider: add checks to signing cases for wallet deployment and config statuses
  - provider: add prompt for wallet deployment
  - relayer: add BaseRelayer.prependWalletDeploy
  - relayer: add Relayer.feeOptions
  - relayer: account for wallet deployment in fee estimation
  - transactions: add fromTransactionish
  - wallet: add Account.prependConfigUpdate
  - wallet: add Account.getFeeOptions

## 0.34.0

### Minor Changes

- - upgrade deps

## 0.31.0

### Minor Changes

- - upgrading to ethers v5.5

## 0.30.0

### Minor Changes

- - upgrade most deps

## 0.29.8

### Patch Changes

- update api

## 0.29.3

### Patch Changes

- indexer: add bridge contract types

## 0.29.0

### Minor Changes

- major architectural changes in Sequence design

  - only one API instance, API is no longer a per-chain service
  - separate per-chain indexer service, API no longer handles indexing
  - single contract metadata service, API no longer serves metadata

  chaind package has been removed, indexer and metadata packages have been added

  stronger typing with new explicit ChainId type

  multicall fixes and improvements

  forbid "wait" transactions in sendTransactionBatch calls

# @0xsequence/guard

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

## 0.28.0

### Minor Changes

- extension provider

## 0.27.0

### Minor Changes

- Add requireFreshSigner lib to sessions

## 0.25.1

### Patch Changes

- Fix build typescrypt issue

## 0.25.0

### Minor Changes

- 10c8af8: Add estimator package
  Fix multicall few calls bug

## 0.23.0

### Minor Changes

- - relayer: offer variety of gas fee options from the relayer service"

## 0.22.2

### Patch Changes

- e1c109e: Fix authProof on expired sessions

## 0.22.1

### Patch Changes

- transport session cache

## 0.22.0

### Minor Changes

- e667b65: Expose all relayer options on networks

## 0.21.5

### Patch Changes

- Give priority to metaTxnId returned by relayer

## 0.21.4

### Patch Changes

- Add has enough signers method

## 0.21.3

### Patch Changes

- add window session cache

## 0.21.2

### Patch Changes

- exception handlind in relayer

## 0.21.0

### Minor Changes

- - fix gas estimation on wallets with large number of signers
  - update to session handling and wallet config construction upon auth

## 0.19.3

### Patch Changes

- jwtAuth visibility, package version sync

## 0.19.0

### Minor Changes

- - provider, improve dapp / wallet transport io

## 0.18.0

### Minor Changes

- relayer improvements and pending transaction handling

## 0.16.0

### Minor Changes

- relayer as its own service separate from chaind

## 0.15.1

### Patch Changes

- update api clients

## 0.14.3

### Patch Changes

- Fix 0xSequence relayer dependencies

## 0.14.2

### Patch Changes

- Add debug logs to rpc-relayer

## 0.14.0

### Minor Changes

- update sequence utils finder which includes optimization

## 0.13.0

### Minor Changes

- Update SequenceUtils deployed contract

## 0.12.1

### Patch Changes

- npm bump

## 0.12.0

### Minor Changes

- provider: improvements to window transport

## 0.11.4

### Patch Changes

- update api client

## 0.11.3

### Patch Changes

- improve openWindow state options handling

## 0.11.2

### Patch Changes

- Fix multicall proxy scopes

## 0.11.1

### Patch Changes

- Add support for dynamic and nested signatures

## 0.11.0

### Minor Changes

- Update wallet context to 1.7 contracts

## 0.10.9

### Patch Changes

- add support for public addresses as signers in session.open

## 0.10.8

### Patch Changes

- Multicall production configuration

## 0.10.7

### Patch Changes

- allow provider transport to force disconnect

## 0.10.6

### Patch Changes

- - fix getWalletState method

## 0.10.5

### Patch Changes

- update relayer gas refund options

## 0.10.4

### Patch Changes

- Update api proto

## 0.10.3

### Patch Changes

- Fix loading config cross-chain

## 0.10.2

### Patch Changes

- - message digest fix

## 0.10.1

### Patch Changes

- upgrade deps

## 0.10.0

### Minor Changes

- Deployed new contracts with ERC1271 signer support

## 0.9.6

### Patch Changes

- Update ABIs for latest sequence contracts

## 0.9.3

### Patch Changes

- - minor improvements

## 0.9.1

### Patch Changes

- - patch bump

## 0.9.0

### Minor Changes

- - provider transport hardening

## 0.8.5

### Patch Changes

- - use latest wallet-contracts

## 0.8.4

### Patch Changes

- - minor improvements, name updates and comments

## 0.8.3

### Patch Changes

- - refinements

  - normalize signer address in config

  - provider: getWalletState() method to WalletProvider

## 0.8.2

### Patch Changes

- - field rename and ethauth dependency bump

## 0.8.1

### Patch Changes

- - variety of optimizations

## 0.8.0

### Minor Changes

- - changeset fix

## 0.7.0

### Patch Changes

- 6f11ed7: sequence.js, init release

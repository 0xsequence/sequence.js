# @0xsequence/estimator

## 0.42.9

### Patch Changes

- provider: add eip-191 exceptions
- Updated dependencies
  - @0xsequence/abi@0.42.9
  - @0xsequence/config@0.42.9
  - @0xsequence/network@0.42.9
  - @0xsequence/transactions@0.42.9
  - @0xsequence/utils@0.42.9

## 0.42.8

### Patch Changes

- provider: skip setting intent origin if we're unity plugin
- Updated dependencies
  - @0xsequence/abi@0.42.8
  - @0xsequence/config@0.42.8
  - @0xsequence/network@0.42.8
  - @0xsequence/transactions@0.42.8
  - @0xsequence/utils@0.42.8

## 0.42.7

### Patch Changes

- Add sign in options to connection settings
- Updated dependencies
  - @0xsequence/abi@0.42.7
  - @0xsequence/config@0.42.7
  - @0xsequence/network@0.42.7
  - @0xsequence/transactions@0.42.7
  - @0xsequence/utils@0.42.7

## 0.42.6

### Patch Changes

- api bindings update
- Updated dependencies
  - @0xsequence/abi@0.42.6
  - @0xsequence/config@0.42.6
  - @0xsequence/network@0.42.6
  - @0xsequence/transactions@0.42.6
  - @0xsequence/utils@0.42.6

## 0.42.5

### Patch Changes

- relayer: don't treat missing receipt as hard failure
- Updated dependencies
  - @0xsequence/abi@0.42.5
  - @0xsequence/config@0.42.5
  - @0xsequence/network@0.42.5
  - @0xsequence/transactions@0.42.5
  - @0xsequence/utils@0.42.5

## 0.42.4

### Patch Changes

- provider: add custom app protocol to connect options
- Updated dependencies
  - @0xsequence/abi@0.42.4
  - @0xsequence/config@0.42.4
  - @0xsequence/network@0.42.4
  - @0xsequence/transactions@0.42.4
  - @0xsequence/utils@0.42.4

## 0.42.3

### Patch Changes

- update api bindings
- Updated dependencies
  - @0xsequence/abi@0.42.3
  - @0xsequence/config@0.42.3
  - @0xsequence/network@0.42.3
  - @0xsequence/transactions@0.42.3
  - @0xsequence/utils@0.42.3

## 0.42.2

### Patch Changes

- disable rinkeby network
- Updated dependencies
  - @0xsequence/abi@0.42.2
  - @0xsequence/config@0.42.2
  - @0xsequence/network@0.42.2
  - @0xsequence/transactions@0.42.2
  - @0xsequence/utils@0.42.2

## 0.42.1

### Patch Changes

- wallet: optional waitForReceipt parameter
- Updated dependencies
  - @0xsequence/abi@0.42.1
  - @0xsequence/config@0.42.1
  - @0xsequence/network@0.42.1
  - @0xsequence/transactions@0.42.1
  - @0xsequence/utils@0.42.1

## 0.42.0

### Minor Changes

- relayer: estimateGasLimits -> simulate
- add simulator package

### Patch Changes

- transactions: fix flattenAuxTransactions
- provider: only filter nullish values
- provider: re-map transaction 'gas' back to 'gasLimit'
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @0xsequence/abi@0.42.0
  - @0xsequence/config@0.42.0
  - @0xsequence/network@0.42.0
  - @0xsequence/transactions@0.42.0
  - @0xsequence/utils@0.42.0

## 0.41.3

### Patch Changes

- api bindings update
- Updated dependencies
  - @0xsequence/abi@0.41.3
  - @0xsequence/config@0.41.3
  - @0xsequence/network@0.41.3
  - @0xsequence/transactions@0.41.3
  - @0xsequence/utils@0.41.3

## 0.41.2

### Patch Changes

- api bindings update
- Updated dependencies
  - @0xsequence/abi@0.41.2
  - @0xsequence/config@0.41.2
  - @0xsequence/network@0.41.2
  - @0xsequence/transactions@0.41.2
  - @0xsequence/utils@0.41.2

## 0.41.1

### Patch Changes

- update default networks
- Updated dependencies
  - @0xsequence/abi@0.41.1
  - @0xsequence/config@0.41.1
  - @0xsequence/network@0.41.1
  - @0xsequence/transactions@0.41.1
  - @0xsequence/utils@0.41.1

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
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @0xsequence/abi@0.41.0
  - @0xsequence/config@0.41.0
  - @0xsequence/network@0.41.0
  - @0xsequence/transactions@0.41.0
  - @0xsequence/utils@0.41.0

## 0.40.6

### Patch Changes

- add arbitrum-nova chain
- Updated dependencies
  - @0xsequence/abi@0.40.6
  - @0xsequence/config@0.40.6
  - @0xsequence/network@0.40.6
  - @0xsequence/transactions@0.40.6
  - @0xsequence/utils@0.40.6

## 0.40.5

### Patch Changes

- api: update bindings
- Updated dependencies
  - @0xsequence/abi@0.40.5
  - @0xsequence/config@0.40.5
  - @0xsequence/network@0.40.5
  - @0xsequence/transactions@0.40.5
  - @0xsequence/utils@0.40.5

## 0.40.4

### Patch Changes

- add unreal transport
- Updated dependencies
  - @0xsequence/abi@0.40.4
  - @0xsequence/config@0.40.4
  - @0xsequence/network@0.40.4
  - @0xsequence/transactions@0.40.4
  - @0xsequence/utils@0.40.4

## 0.40.3

### Patch Changes

- provider: fix MessageToSign message type
- Updated dependencies
  - @0xsequence/abi@0.40.3
  - @0xsequence/config@0.40.3
  - @0xsequence/network@0.40.3
  - @0xsequence/transactions@0.40.3
  - @0xsequence/utils@0.40.3

## 0.40.2

### Patch Changes

- Wallet provider, loadSession method
- Updated dependencies
  - @0xsequence/abi@0.40.2
  - @0xsequence/config@0.40.2
  - @0xsequence/network@0.40.2
  - @0xsequence/transactions@0.40.2
  - @0xsequence/utils@0.40.2

## 0.40.1

### Patch Changes

- export sequence.initWallet and sequence.getWallet
- Updated dependencies
  - @0xsequence/abi@0.40.1
  - @0xsequence/config@0.40.1
  - @0xsequence/network@0.40.1
  - @0xsequence/transactions@0.40.1
  - @0xsequence/utils@0.40.1

## 0.40.0

### Minor Changes

- add sequence.initWallet(network, config) and sequence.getWallet() helper methods

### Patch Changes

- Updated dependencies
  - @0xsequence/abi@0.40.0
  - @0xsequence/config@0.40.0
  - @0xsequence/network@0.40.0
  - @0xsequence/transactions@0.40.0
  - @0xsequence/utils@0.40.0

## 0.39.6

### Patch Changes

- indexer: update client bindings
- Updated dependencies
  - @0xsequence/abi@0.39.6
  - @0xsequence/config@0.39.6
  - @0xsequence/network@0.39.6
  - @0xsequence/transactions@0.39.6
  - @0xsequence/utils@0.39.6

## 0.39.5

### Patch Changes

- provider: fix networkRpcUrl config option
- Updated dependencies
  - @0xsequence/abi@0.39.5
  - @0xsequence/config@0.39.5
  - @0xsequence/network@0.39.5
  - @0xsequence/transactions@0.39.5
  - @0xsequence/utils@0.39.5

## 0.39.4

### Patch Changes

- api: update client bindings
- Updated dependencies
  - @0xsequence/abi@0.39.4
  - @0xsequence/config@0.39.4
  - @0xsequence/network@0.39.4
  - @0xsequence/transactions@0.39.4
  - @0xsequence/utils@0.39.4

## 0.39.3

### Patch Changes

- add request method on Web3Provider
- Updated dependencies
  - @0xsequence/abi@0.39.3
  - @0xsequence/config@0.39.3
  - @0xsequence/network@0.39.3
  - @0xsequence/transactions@0.39.3
  - @0xsequence/utils@0.39.3

## 0.39.2

### Patch Changes

- update umd name
- Updated dependencies
  - @0xsequence/abi@0.39.2
  - @0xsequence/config@0.39.2
  - @0xsequence/network@0.39.2
  - @0xsequence/transactions@0.39.2
  - @0xsequence/utils@0.39.2

## 0.39.1

### Patch Changes

- add Aurora network
- add origin info for accountsChanged event to handle it per dapp
- Updated dependencies
- Updated dependencies
  - @0xsequence/abi@0.39.1
  - @0xsequence/config@0.39.1
  - @0xsequence/network@0.39.1
  - @0xsequence/transactions@0.39.1
  - @0xsequence/utils@0.39.1

## 0.39.0

### Minor Changes

- abstract window.localStorage to interface type

### Patch Changes

- Updated dependencies
  - @0xsequence/abi@0.39.0
  - @0xsequence/config@0.39.0
  - @0xsequence/network@0.39.0
  - @0xsequence/transactions@0.39.0
  - @0xsequence/utils@0.39.0

## 0.38.2

### Patch Changes

- provider: add Settings.defaultPurchaseAmount
- Updated dependencies
  - @0xsequence/abi@0.38.2
  - @0xsequence/config@0.38.2
  - @0xsequence/network@0.38.2
  - @0xsequence/transactions@0.38.2
  - @0xsequence/utils@0.38.2

## 0.38.1

### Patch Changes

- update api and metadata rpc bindings
- Updated dependencies
  - @0xsequence/abi@0.38.1
  - @0xsequence/config@0.38.1
  - @0xsequence/network@0.38.1
  - @0xsequence/transactions@0.38.1
  - @0xsequence/utils@0.38.1

## 0.38.0

### Minor Changes

- api: update bindings, change TokenPrice interface
- bridge: remove @0xsequence/bridge package
- api: update bindings, rename ContractCallArg to TupleComponent

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @0xsequence/abi@0.38.0
  - @0xsequence/config@0.38.0
  - @0xsequence/network@0.38.0
  - @0xsequence/transactions@0.38.0
  - @0xsequence/utils@0.38.0

## 0.37.1

### Patch Changes

- Add back sortNetworks - Removing sorting was a breaking change for dapps on older versions which directly integrate sequence.
- Updated dependencies
  - @0xsequence/abi@0.37.1
  - @0xsequence/config@0.37.1
  - @0xsequence/network@0.37.1
  - @0xsequence/transactions@0.37.1
  - @0xsequence/utils@0.37.1

## 0.37.0

### Minor Changes

- network related fixes and improvements
- api: bindings: exchange rate lookups

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @0xsequence/abi@0.37.0
  - @0xsequence/config@0.37.0
  - @0xsequence/network@0.37.0
  - @0xsequence/transactions@0.37.0
  - @0xsequence/utils@0.37.0

## 0.36.13

### Patch Changes

- api: update bindings with new price endpoints
- Updated dependencies
  - @0xsequence/abi@0.36.13
  - @0xsequence/config@0.36.13
  - @0xsequence/network@0.36.13
  - @0xsequence/transactions@0.36.13
  - @0xsequence/utils@0.36.13

## 0.36.12

### Patch Changes

- wallet: skip remote signers if not needed
- auth: check that signature meets threshold before requesting auth token
- Updated dependencies
- Updated dependencies
  - @0xsequence/abi@0.36.12
  - @0xsequence/config@0.36.12
  - @0xsequence/network@0.36.12
  - @0xsequence/transactions@0.36.12
  - @0xsequence/utils@0.36.12

## 0.36.11

### Patch Changes

- Prefix EIP191 message on wallet-request-handler
- Updated dependencies
  - @0xsequence/abi@0.36.11
  - @0xsequence/config@0.36.11
  - @0xsequence/network@0.36.11
  - @0xsequence/transactions@0.36.11
  - @0xsequence/utils@0.36.11

## 0.36.10

### Patch Changes

- support bannerUrl on connect
- Updated dependencies
  - @0xsequence/abi@0.36.10
  - @0xsequence/config@0.36.10
  - @0xsequence/network@0.36.10
  - @0xsequence/transactions@0.36.10
  - @0xsequence/utils@0.36.10

## 0.36.9

### Patch Changes

- minor dev xp improvements
- Updated dependencies
  - @0xsequence/abi@0.36.9
  - @0xsequence/config@0.36.9
  - @0xsequence/network@0.36.9
  - @0xsequence/transactions@0.36.9
  - @0xsequence/utils@0.36.9

## 0.36.8

### Patch Changes

- more connect options (theme, payment providers, funding currencies)
- Updated dependencies
  - @0xsequence/abi@0.36.8
  - @0xsequence/config@0.36.8
  - @0xsequence/network@0.36.8
  - @0xsequence/transactions@0.36.8
  - @0xsequence/utils@0.36.8

## 0.36.7

### Patch Changes

- fix missing break
- Updated dependencies
  - @0xsequence/abi@0.36.7
  - @0xsequence/config@0.36.7
  - @0xsequence/network@0.36.7
  - @0xsequence/transactions@0.36.7
  - @0xsequence/utils@0.36.7

## 0.36.6

### Patch Changes

- wallet_switchEthereumChain support
- Updated dependencies
  - @0xsequence/abi@0.36.6
  - @0xsequence/config@0.36.6
  - @0xsequence/network@0.36.6
  - @0xsequence/transactions@0.36.6
  - @0xsequence/utils@0.36.6

## 0.36.5

### Patch Changes

- auth: bump ethauth to 0.7.0
  network, wallet: don't assume position of auth network in list
  api/indexer/metadata: trim trailing slash on hostname, and add endpoint urls
  relayer: Allow to specify local relayer transaction parameters like gas price or gas limit
- Updated dependencies
  - @0xsequence/abi@0.36.5
  - @0xsequence/config@0.36.5
  - @0xsequence/network@0.36.5
  - @0xsequence/transactions@0.36.5
  - @0xsequence/utils@0.36.5

## 0.36.4

### Patch Changes

- Updating list of chain ids to include other ethereum compatible chains
- Updated dependencies
  - @0xsequence/abi@0.36.4
  - @0xsequence/config@0.36.4
  - @0xsequence/network@0.36.4
  - @0xsequence/transactions@0.36.4
  - @0xsequence/utils@0.36.4

## 0.36.3

### Patch Changes

- provider: pass connect options to prompter methods
- Updated dependencies
  - @0xsequence/abi@0.36.3
  - @0xsequence/config@0.36.3
  - @0xsequence/network@0.36.3
  - @0xsequence/transactions@0.36.3
  - @0xsequence/utils@0.36.3

## 0.36.2

### Patch Changes

- transactions: Setting target to 0x0 when empty to during SequenceTxAbiEncode
- Updated dependencies
  - @0xsequence/abi@0.36.2
  - @0xsequence/config@0.36.2
  - @0xsequence/network@0.36.2
  - @0xsequence/transactions@0.36.2
  - @0xsequence/utils@0.36.2

## 0.36.1

### Patch Changes

- metadata: update client with more fields
- Updated dependencies
  - @0xsequence/abi@0.36.1
  - @0xsequence/config@0.36.1
  - @0xsequence/network@0.36.1
  - @0xsequence/transactions@0.36.1
  - @0xsequence/utils@0.36.1

## 0.36.0

### Minor Changes

- relayer, wallet: fee quote support

### Patch Changes

- Updated dependencies
  - @0xsequence/abi@0.36.0
  - @0xsequence/config@0.36.0
  - @0xsequence/network@0.36.0
  - @0xsequence/transactions@0.36.0
  - @0xsequence/utils@0.36.0

## 0.35.12

### Patch Changes

- provider: rename wallet.commands to wallet.utils
- Updated dependencies
  - @0xsequence/abi@0.35.12
  - @0xsequence/config@0.35.12
  - @0xsequence/network@0.35.12
  - @0xsequence/transactions@0.35.12
  - @0xsequence/utils@0.35.12

## 0.35.11

### Patch Changes

- provider/utils: smoother message validation
- Updated dependencies
  - @0xsequence/abi@0.35.11
  - @0xsequence/config@0.35.11
  - @0xsequence/network@0.35.11
  - @0xsequence/transactions@0.35.11
  - @0xsequence/utils@0.35.11

## 0.35.10

### Patch Changes

- upgrade deps
- Updated dependencies
  - @0xsequence/abi@0.35.10
  - @0xsequence/config@0.35.10
  - @0xsequence/network@0.35.10
  - @0xsequence/transactions@0.35.10
  - @0xsequence/utils@0.35.10

## 0.35.9

### Patch Changes

- provider: window-transport override event handlers with new wallet instance
- Updated dependencies
  - @0xsequence/abi@0.35.9
  - @0xsequence/config@0.35.9
  - @0xsequence/network@0.35.9
  - @0xsequence/transactions@0.35.9
  - @0xsequence/utils@0.35.9

## 0.35.8

### Patch Changes

- provider: async wallet sign in improvements
- Updated dependencies
  - @0xsequence/abi@0.35.8
  - @0xsequence/config@0.35.8
  - @0xsequence/network@0.35.8
  - @0xsequence/transactions@0.35.8
  - @0xsequence/utils@0.35.8

## 0.35.7

### Patch Changes

- config: cache wallet configs
- Updated dependencies
  - @0xsequence/abi@0.35.7
  - @0xsequence/config@0.35.7
  - @0xsequence/network@0.35.7
  - @0xsequence/transactions@0.35.7
  - @0xsequence/utils@0.35.7

## 0.35.6

### Patch Changes

- provider: support async signin of wallet request handler
- Updated dependencies
  - @0xsequence/abi@0.35.6
  - @0xsequence/config@0.35.6
  - @0xsequence/network@0.35.6
  - @0xsequence/transactions@0.35.6
  - @0xsequence/utils@0.35.6

## 0.35.5

### Patch Changes

- wallet: skip threshold check during fee estimation
- Updated dependencies
  - @0xsequence/abi@0.35.5
  - @0xsequence/config@0.35.5
  - @0xsequence/network@0.35.5
  - @0xsequence/transactions@0.35.5
  - @0xsequence/utils@0.35.5

## 0.35.4

### Patch Changes

- - browser extension mode, center window
- Updated dependencies
  - @0xsequence/abi@0.35.4
  - @0xsequence/config@0.35.4
  - @0xsequence/network@0.35.4
  - @0xsequence/transactions@0.35.4
  - @0xsequence/utils@0.35.4

## 0.35.3

### Patch Changes

- - update window position when in browser extension mode
- Updated dependencies
  - @0xsequence/abi@0.35.3
  - @0xsequence/config@0.35.3
  - @0xsequence/network@0.35.3
  - @0xsequence/transactions@0.35.3
  - @0xsequence/utils@0.35.3

## 0.35.2

### Patch Changes

- - provider: WindowMessageHandler accept optional windowHref
- Updated dependencies
  - @0xsequence/abi@0.35.2
  - @0xsequence/config@0.35.2
  - @0xsequence/network@0.35.2
  - @0xsequence/transactions@0.35.2
  - @0xsequence/utils@0.35.2

## 0.35.1

### Patch Changes

- wallet: update config on undeployed too
- Updated dependencies
  - @0xsequence/abi@0.35.1
  - @0xsequence/config@0.35.1
  - @0xsequence/network@0.35.1
  - @0xsequence/transactions@0.35.1
  - @0xsequence/utils@0.35.1

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

### Patch Changes

- Updated dependencies
  - @0xsequence/abi@0.35.0
  - @0xsequence/config@0.35.0
  - @0xsequence/network@0.35.0
  - @0xsequence/transactions@0.35.0
  - @0xsequence/utils@0.35.0

## 0.34.0

### Minor Changes

- - upgrade deps

### Patch Changes

- Updated dependencies
  - @0xsequence/abi@0.34.0
  - @0xsequence/config@0.34.0
  - @0xsequence/network@0.34.0
  - @0xsequence/transactions@0.34.0
  - @0xsequence/utils@0.34.0

## 0.33.2

### Patch Changes

- Updated dependencies
  - @0xsequence/transactions@0.33.2

## 0.31.0

### Minor Changes

- - upgrading to ethers v5.5

### Patch Changes

- Updated dependencies
  - @0xsequence/abi@0.31.0
  - @0xsequence/config@0.31.0
  - @0xsequence/network@0.31.0
  - @0xsequence/transactions@0.31.0
  - @0xsequence/utils@0.31.0

## 0.30.0

### Minor Changes

- - upgrade most deps

### Patch Changes

- Updated dependencies
  - @0xsequence/abi@0.30.0
  - @0xsequence/config@0.30.0
  - @0xsequence/network@0.30.0
  - @0xsequence/transactions@0.30.0
  - @0xsequence/utils@0.30.0

## 0.29.8

### Patch Changes

- update api
- Updated dependencies [undefined]
  - @0xsequence/abi@0.29.8
  - @0xsequence/config@0.29.8
  - @0xsequence/network@0.29.8
  - @0xsequence/transactions@0.29.8
  - @0xsequence/utils@0.29.8

## 0.29.6

### Patch Changes

- Updated dependencies [undefined]
  - @0xsequence/network@0.29.6
  - @0xsequence/config@0.29.6
  - @0xsequence/transactions@0.29.6

## 0.29.5

### Patch Changes

- Updated dependencies [undefined]
  - @0xsequence/config@0.29.5

## 0.29.0

### Patch Changes

- Updated dependencies [undefined]
  - @0xsequence/config@0.29.0
  - @0xsequence/network@0.29.0
  - @0xsequence/transactions@0.29.0
  - @0xsequence/abi@0.29.0
  - @0xsequence/utils@0.29.0

## 0.28.0

### Minor Changes

- extension provider

### Patch Changes

- Updated dependencies [undefined]
  - @0xsequence/abi@0.28.0
  - @0xsequence/config@0.28.0
  - @0xsequence/network@0.28.0
  - @0xsequence/transactions@0.28.0
  - @0xsequence/utils@0.28.0

## 0.27.0

### Minor Changes

- Add requireFreshSigner lib to sessions

### Patch Changes

- Updated dependencies [undefined]
  - @0xsequence/abi@0.27.0
  - @0xsequence/config@0.27.0
  - @0xsequence/network@0.27.0
  - @0xsequence/transactions@0.27.0
  - @0xsequence/utils@0.27.0

## 0.25.1

### Patch Changes

- Fix build typescrypt issue
- Updated dependencies [undefined]
  - @0xsequence/abi@0.25.1
  - @0xsequence/config@0.25.1
  - @0xsequence/network@0.25.1
  - @0xsequence/transactions@0.25.1
  - @0xsequence/utils@0.25.1

## 0.25.0

### Minor Changes

- 10c8af8: Add estimator package
  Fix multicall few calls bug

### Patch Changes

- Updated dependencies [10c8af8]
  - @0xsequence/abi@0.25.0
  - @0xsequence/config@0.25.0
  - @0xsequence/network@0.25.0
  - @0xsequence/transactions@0.25.0
  - @0xsequence/utils@0.25.0

# @0xsequence/core

## 1.6.3

### Patch Changes

- network list update
- Updated dependencies
  - @0xsequence/abi@1.6.3

## 1.6.2

### Patch Changes

- auth: projectAccessKey option
- wallet: use 12 bytes for random space
- Updated dependencies
- Updated dependencies
  - @0xsequence/abi@1.6.2

## 1.6.1

### Patch Changes

- core: add simple config from subdigest support
- core: fix encode tree with subdigest
- account: implement buildOnChainSignature on Account
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @0xsequence/abi@1.6.1

## 1.6.0

### Minor Changes

- account, wallet: parallel transactions by default

### Patch Changes

- provider: emit disconnect on sign out
- Updated dependencies
- Updated dependencies
  - @0xsequence/abi@1.6.0

## 1.5.0

### Minor Changes

- signhub: add 'signing' signer status

### Patch Changes

- auth: Session.open: onAccountAddress callback
- account: allow empty transaction bundles
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @0xsequence/abi@1.5.0

## 1.4.9

### Patch Changes

- rename SequenceMetadataClient to SequenceMetadata
- Updated dependencies
  - @0xsequence/abi@1.4.9

## 1.4.8

### Patch Changes

- account: Account.getSigners
- Updated dependencies
  - @0xsequence/abi@1.4.8

## 1.4.7

### Patch Changes

- update indexer client bindings
- Updated dependencies
  - @0xsequence/abi@1.4.7

## 1.4.6

### Patch Changes

- - add sepolia networks, mark goerli as deprecated
  - update indexer client bindings
- Updated dependencies
  - @0xsequence/abi@1.4.6

## 1.4.5

### Patch Changes

- indexer/metadata: update client bindings
- auth: selectWallet with new address
- Updated dependencies
- Updated dependencies
  - @0xsequence/abi@1.4.5

## 1.4.4

### Patch Changes

- indexer: update bindings
- auth: handle jwt expiry
- Updated dependencies
- Updated dependencies
  - @0xsequence/abi@1.4.4

## 1.4.3

### Patch Changes

- guard: return active status from GuardSigner.getAuthMethods
- Updated dependencies
  - @0xsequence/abi@1.4.3

## 1.4.2

### Patch Changes

- guard: update bindings
- Updated dependencies
  - @0xsequence/abi@1.4.2

## 1.4.1

### Patch Changes

- network: remove unused networks
- signhub: orchestrator interface
- guard: auth methods interface
- guard: update bindings for pin and totp
- guard: no more retry logic
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @0xsequence/abi@1.4.1

## 1.4.0

### Minor Changes

- project access key support

### Patch Changes

- Updated dependencies
  - @0xsequence/abi@1.4.0

## 1.3.0

### Minor Changes

- signhub: account children

### Patch Changes

- guard: do not throw when building deploy transaction
- network: snowtrace.io -> subnets.avax.network/c-chain
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @0xsequence/abi@1.3.0

## 1.2.9

### Patch Changes

- account: AccountSigner.sendTransaction simulateForFeeOptions
- relayer: update bindings
- Updated dependencies
- Updated dependencies
  - @0xsequence/abi@1.2.9

## 1.2.8

### Patch Changes

- rename X-Sequence-Token-Key header to X-Access-Key
- Updated dependencies
  - @0xsequence/abi@1.2.8

## 1.2.7

### Patch Changes

- add x-sequence-token-key to clients
- Updated dependencies
  - @0xsequence/abi@1.2.7

## 1.2.6

### Patch Changes

- Fix bind multicall provider
- Updated dependencies
  - @0xsequence/abi@1.2.6

## 1.2.5

### Patch Changes

- Multicall default configuration fixes
- Updated dependencies
  - @0xsequence/abi@1.2.5

## 1.2.4

### Patch Changes

- provider: Adding missing payment provider types to PaymentProviderOption
- provider: WalletRequestHandler.notifyChainChanged
- Updated dependencies
- Updated dependencies
  - @0xsequence/abi@1.2.4

## 1.2.3

### Patch Changes

- auth, provider: connect to accept optional authorizeNonce
- Updated dependencies
  - @0xsequence/abi@1.2.3

## 1.2.2

### Patch Changes

- provider: allow createContract calls
- core: check for explicit zero address in contract deployments
- Updated dependencies
- Updated dependencies
  - @0xsequence/abi@1.2.2

## 1.2.1

### Patch Changes

- auth: use sequence api chain id as reference chain id if available
- Updated dependencies
  - @0xsequence/abi@1.2.1

## 1.2.0

### Minor Changes

- split services from session, better local support

### Patch Changes

- Updated dependencies
  - @0xsequence/abi@1.2.0

## 1.1.15

### Patch Changes

- guard: remove error filtering
- Updated dependencies
  - @0xsequence/abi@1.1.15

## 1.1.14

### Patch Changes

- guard: add GuardSigner.onError
- Updated dependencies
  - @0xsequence/abi@1.1.14

## 1.1.13

### Patch Changes

- provider: pass client version with connect options
- provider: removing large from BannerSize
- Updated dependencies
- Updated dependencies
  - @0xsequence/abi@1.1.13

## 1.1.12

### Patch Changes

- provider: adding bannerSize to ConnectOptions
- Updated dependencies
  - @0xsequence/abi@1.1.12

## 1.1.11

### Patch Changes

- add homeverse configs
- Updated dependencies
  - @0xsequence/abi@1.1.11

## 1.1.10

### Patch Changes

- handle default EIP6492 on send
- Updated dependencies
  - @0xsequence/abi@1.1.10

## 1.1.9

### Patch Changes

- Custom default EIP6492 on client
- Updated dependencies
  - @0xsequence/abi@1.1.9

## 1.1.8

### Patch Changes

- metadata: searchMetadata: add types filter
- Updated dependencies
  - @0xsequence/abi@1.1.8

## 1.1.7

### Patch Changes

- adding signInWith connect settings option to allow dapps to automatically login their users with a certain provider optimizing the normal authentication flow
- Updated dependencies
  - @0xsequence/abi@1.1.7

## 1.1.6

### Patch Changes

- metadata: searchMetadata: add chainID and excludeTokenMetadata filters
- Updated dependencies
  - @0xsequence/abi@1.1.6

## 1.1.5

### Patch Changes

- account: re-compute meta-transaction id for wallet deployment transactions
- Updated dependencies
  - @0xsequence/abi@1.1.5

## 1.1.4

### Patch Changes

- network: rename base-mainnet to base
- provider: override isDefaultChain with ConnectOptions.networkId if provided
- Updated dependencies
- Updated dependencies
  - @0xsequence/abi@1.1.4

## 1.1.3

### Patch Changes

- provider: use network id from transport session
- provider: sign authorization using ConnectOptions.networkId if provided
- Updated dependencies
- Updated dependencies
  - @0xsequence/abi@1.1.3

## 1.1.2

### Patch Changes

- provider: jsonrpc chain id fixes
- Updated dependencies
  - @0xsequence/abi@1.1.2

## 1.1.1

### Patch Changes

- network: add base mainnet and sepolia
- provider: reject toxic transaction requests
- Updated dependencies
- Updated dependencies
  - @0xsequence/abi@1.1.1

## 1.1.0

### Minor Changes

- Refactor dapp facing provider

### Patch Changes

- Updated dependencies
  - @0xsequence/abi@1.1.0

## 1.0.5

### Patch Changes

- network: export network constants
- guard: use the correct global for fetch
- network: nova-explorer.arbitrum.io -> nova.arbiscan.io
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @0xsequence/abi@1.0.5

## 1.0.4

### Patch Changes

- provider: accept name or number for networkId
- Updated dependencies
  - @0xsequence/abi@1.0.4

## 1.0.3

### Patch Changes

- Simpler isValidSignature helpers
- Updated dependencies
  - @0xsequence/abi@1.0.3

## 1.0.2

### Patch Changes

- add extra signature validation utils methods
- Updated dependencies
  - @0xsequence/abi@1.0.2

## 1.0.1

### Patch Changes

- add homeverse testnet
- Updated dependencies
  - @0xsequence/abi@1.0.1

## 1.0.0

### Major Changes

- https://sequence.xyz/blog/sequence-wallet-light-state-sync-full-merkle-wallets

### Patch Changes

- Updated dependencies
  - @0xsequence/abi@1.0.0

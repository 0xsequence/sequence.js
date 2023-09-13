# @0xsequence/sessions

## 1.2.2

### Patch Changes

- provider: allow createContract calls
- core: check for explicit zero address in contract deployments
- Updated dependencies
- Updated dependencies
  - @0xsequence/core@1.2.2
  - @0xsequence/migration@1.2.2
  - @0xsequence/replacer@1.2.2

## 1.2.1

### Patch Changes

- auth: use sequence api chain id as reference chain id if available
- Updated dependencies
  - @0xsequence/core@1.2.1
  - @0xsequence/migration@1.2.1
  - @0xsequence/replacer@1.2.1

## 1.2.0

### Minor Changes

- split services from session, better local support

### Patch Changes

- Updated dependencies
  - @0xsequence/core@1.2.0
  - @0xsequence/migration@1.2.0
  - @0xsequence/replacer@1.2.0

## 1.1.15

### Patch Changes

- guard: remove error filtering
- Updated dependencies
  - @0xsequence/core@1.1.15
  - @0xsequence/migration@1.1.15
  - @0xsequence/replacer@1.1.15

## 1.1.14

### Patch Changes

- guard: add GuardSigner.onError
- Updated dependencies
  - @0xsequence/core@1.1.14
  - @0xsequence/migration@1.1.14
  - @0xsequence/replacer@1.1.14

## 1.1.13

### Patch Changes

- provider: pass client version with connect options
- provider: removing large from BannerSize
- Updated dependencies
- Updated dependencies
  - @0xsequence/core@1.1.13
  - @0xsequence/migration@1.1.13
  - @0xsequence/replacer@1.1.13

## 1.1.12

### Patch Changes

- provider: adding bannerSize to ConnectOptions
- Updated dependencies
  - @0xsequence/core@1.1.12
  - @0xsequence/migration@1.1.12
  - @0xsequence/replacer@1.1.12

## 1.1.11

### Patch Changes

- add homeverse configs
- Updated dependencies
  - @0xsequence/core@1.1.11
  - @0xsequence/migration@1.1.11
  - @0xsequence/replacer@1.1.11

## 1.1.10

### Patch Changes

- handle default EIP6492 on send
- Updated dependencies
  - @0xsequence/core@1.1.10
  - @0xsequence/migration@1.1.10
  - @0xsequence/replacer@1.1.10

## 1.1.9

### Patch Changes

- Custom default EIP6492 on client
- Updated dependencies
  - @0xsequence/core@1.1.9
  - @0xsequence/migration@1.1.9
  - @0xsequence/replacer@1.1.9

## 1.1.8

### Patch Changes

- metadata: searchMetadata: add types filter
- Updated dependencies
  - @0xsequence/core@1.1.8
  - @0xsequence/migration@1.1.8
  - @0xsequence/replacer@1.1.8

## 1.1.7

### Patch Changes

- adding signInWith connect settings option to allow dapps to automatically login their users with a certain provider optimizing the normal authentication flow
- Updated dependencies
  - @0xsequence/core@1.1.7
  - @0xsequence/migration@1.1.7
  - @0xsequence/replacer@1.1.7

## 1.1.6

### Patch Changes

- metadata: searchMetadata: add chainID and excludeTokenMetadata filters
- Updated dependencies
  - @0xsequence/core@1.1.6
  - @0xsequence/migration@1.1.6
  - @0xsequence/replacer@1.1.6

## 1.1.5

### Patch Changes

- account: re-compute meta-transaction id for wallet deployment transactions
- Updated dependencies
  - @0xsequence/core@1.1.5
  - @0xsequence/migration@1.1.5
  - @0xsequence/replacer@1.1.5

## 1.1.4

### Patch Changes

- network: rename base-mainnet to base
- provider: override isDefaultChain with ConnectOptions.networkId if provided
- Updated dependencies
- Updated dependencies
  - @0xsequence/core@1.1.4
  - @0xsequence/migration@1.1.4
  - @0xsequence/replacer@1.1.4

## 1.1.3

### Patch Changes

- provider: use network id from transport session
- provider: sign authorization using ConnectOptions.networkId if provided
- Updated dependencies
- Updated dependencies
  - @0xsequence/core@1.1.3
  - @0xsequence/migration@1.1.3
  - @0xsequence/replacer@1.1.3

## 1.1.2

### Patch Changes

- provider: jsonrpc chain id fixes
- Updated dependencies
  - @0xsequence/core@1.1.2
  - @0xsequence/migration@1.1.2
  - @0xsequence/replacer@1.1.2

## 1.1.1

### Patch Changes

- network: add base mainnet and sepolia
- provider: reject toxic transaction requests
- Updated dependencies
- Updated dependencies
  - @0xsequence/core@1.1.1
  - @0xsequence/migration@1.1.1
  - @0xsequence/replacer@1.1.1

## 1.1.0

### Minor Changes

- Refactor dapp facing provider

### Patch Changes

- Updated dependencies
  - @0xsequence/core@1.1.0
  - @0xsequence/migration@1.1.0
  - @0xsequence/replacer@1.1.0

## 1.0.5

### Patch Changes

- network: export network constants
- guard: use the correct global for fetch
- network: nova-explorer.arbitrum.io -> nova.arbiscan.io
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @0xsequence/core@1.0.5
  - @0xsequence/migration@1.0.5
  - @0xsequence/replacer@1.0.5

## 1.0.4

### Patch Changes

- provider: accept name or number for networkId
- Updated dependencies
  - @0xsequence/core@1.0.4
  - @0xsequence/migration@1.0.4
  - @0xsequence/replacer@1.0.4

## 1.0.3

### Patch Changes

- Simpler isValidSignature helpers
- Updated dependencies
  - @0xsequence/core@1.0.3
  - @0xsequence/migration@1.0.3
  - @0xsequence/replacer@1.0.3

## 1.0.2

### Patch Changes

- add extra signature validation utils methods
- Updated dependencies
  - @0xsequence/core@1.0.2
  - @0xsequence/migration@1.0.2
  - @0xsequence/replacer@1.0.2

## 1.0.1

### Patch Changes

- add homeverse testnet
- Updated dependencies
  - @0xsequence/core@1.0.1
  - @0xsequence/migration@1.0.1
  - @0xsequence/replacer@1.0.1

## 1.0.0

### Major Changes

- https://sequence.xyz/blog/sequence-wallet-light-state-sync-full-merkle-wallets

### Patch Changes

- Updated dependencies
  - @0xsequence/core@1.0.0
  - @0xsequence/migration@1.0.0
  - @0xsequence/replacer@1.0.0

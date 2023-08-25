# @0xsequence/signhub

## 0.0.0-20230825081759

### Minor Changes

- Simpler support for sessions

## 1.1.12

### Patch Changes

- provider: adding bannerSize to ConnectOptions

## 1.1.11

### Patch Changes

- add homeverse configs

## 1.1.10

### Patch Changes

- handle default EIP6492 on send

## 1.1.9

### Patch Changes

- Custom default EIP6492 on client

## 1.1.8

### Patch Changes

- metadata: searchMetadata: add types filter

## 1.1.7

### Patch Changes

- adding signInWith connect settings option to allow dapps to automatically login their users with a certain provider optimizing the normal authentication flow

## 1.1.6

### Patch Changes

- metadata: searchMetadata: add chainID and excludeTokenMetadata filters

## 1.1.5

### Patch Changes

- account: re-compute meta-transaction id for wallet deployment transactions

## 1.1.4

### Patch Changes

- network: rename base-mainnet to base
- provider: override isDefaultChain with ConnectOptions.networkId if provided

## 1.1.3

### Patch Changes

- provider: use network id from transport session
- provider: sign authorization using ConnectOptions.networkId if provided

## 1.1.2

### Patch Changes

- provider: jsonrpc chain id fixes

## 1.1.1

### Patch Changes

- network: add base mainnet and sepolia
- provider: reject toxic transaction requests

## 1.1.0

### Minor Changes

- Refactor dapp facing provider

## 1.0.5

### Patch Changes

- network: export network constants
- guard: use the correct global for fetch
- network: nova-explorer.arbitrum.io -> nova.arbiscan.io

## 1.0.4

### Patch Changes

- provider: accept name or number for networkId

## 1.0.3

### Patch Changes

- Simpler isValidSignature helpers

## 1.0.2

### Patch Changes

- add extra signature validation utils methods

## 1.0.1

### Patch Changes

- add homeverse testnet

## 1.0.0

### Major Changes

- https://sequence.xyz/blog/sequence-wallet-light-state-sync-full-merkle-wallets

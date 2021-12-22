# @0xsequence/indexer

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

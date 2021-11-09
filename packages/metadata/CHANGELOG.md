# @0xsequence/metadata

## 0.29.8

### Patch Changes

- update api

## 0.29.1

### Patch Changes

- metadata: ContractInfo.decimals is now optional, i.e. may be undefined

  api: new APIs for user storage and isUsingGoogleMail

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

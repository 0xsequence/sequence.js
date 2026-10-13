---
'@0xsequence/wallet-core': patch
---

Fix fee options simulation failing for wallets with pending config updates signed by sapient or ERC-1271 signers (e.g. passkeys). `buildFeeOptionsTransaction` now stubs the signatures of pending updates in the chained signature suffix, not only the current configuration, so the relayer no longer rejects `FeeOptions` with `InvalidPasskeySignature`.

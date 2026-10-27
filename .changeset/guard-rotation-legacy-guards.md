---
'@0xsequence/wallet-wdk': minor
---

Support changing the guard: `legacyGuardAddresses` keeps wallets that use an old guard working, configuration updates (except logouts) replace the old guard with the current one, `needsGuardMigration` / `migrateGuard` let wallet apps do it when a wallet loads, and `prepareGuardSettlement` / `completeGuardSettlement` send an `updateImageHash` transaction through the relayer to each chain where the wallet is deployed or funded and its on-chain configuration still has the old guard.

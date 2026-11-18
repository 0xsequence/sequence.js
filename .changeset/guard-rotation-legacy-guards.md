---
'@0xsequence/wallet-wdk': minor
---

`legacyGuardAddresses` lets existing wallets sign with their configured guard. New wallets use `guardAddresses`. Set `enableGuardMigration` to move wallets to the current guard when they open or change configuration. Settlement requests collect signatures only if a relayer sponsors the `updateImageHash` transaction on a chain that needs it.

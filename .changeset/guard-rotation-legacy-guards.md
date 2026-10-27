---
'@0xsequence/wallet-wdk': minor
---

Support guard rotation: `legacyGuardAddresses` keeps wallets that reference rotated-out guards working, every configuration update moves them to the current guards, and `needsGuardMigration` / `migrateGuard` let a logged-in device migrate on demand.

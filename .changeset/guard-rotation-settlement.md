---
'@0xsequence/wallet-wdk': minor
---

Add guard settlements: after a wallet moves to a new guard, `prepareGuardSettlement` / `completeGuardSettlement` sign a chain-agnostic transaction that writes the new configuration on-chain, handed to `ManagerOptions.onGuardSettlement` for relaying.

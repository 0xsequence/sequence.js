---
'@0xsequence/wallet-wdk': minor
---

Add guard settlements: after a wallet moves to a new guard, `prepareGuardSettlement` / `completeGuardSettlement` sign one chain-agnostic transaction that writes the latest configuration on-chain and send it through the relayer to every chain where the wallet is deployed or funded and still has a configuration with a rotated-out guard. Each configuration settles in its own nonce space. Nothing is stored: wallet apps call it on every open and failed chains are retried.

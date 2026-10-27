---
'@0xsequence/wallet-core': minor
'@0xsequence/wallet-wdk': patch
---

Guard settlements are saved to the key machine (`SaveGuardSettlement`) by default: `State.Provider.saveGuardSettlement` (implemented by the Sequence key machine provider, forwarded by `Cached` when its source supports it) is the default `onGuardSettlement`.

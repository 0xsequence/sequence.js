---
'@0xsequence/wallet-core': minor
'@0xsequence/wallet-wdk': patch
---

Guard settlements are saved to the key machine (`SaveGuardSettlement`) through the optional `State.Provider.saveGuardSettlement`, implemented by the Sequence key machine provider and forwarded by `Cached` when its source supports it. The WDK only asks for a settlement when the state provider can store it.

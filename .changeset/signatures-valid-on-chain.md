---
'@0xsequence/sessions': patch
'@0xsequence/account': patch
---

Return signatures that are valid on the target chain. `RemoteConfigTracker` takes optional `signerWallets` and `providerFor`: for the target chain it reads each signer wallet's `externalImageHash()` and passes it to the key machine as `signerConfigs`; `Account.status` passes its chain. `ArweaveReader` takes optional `validationProviders(chainId)`: when a signer published several signatures for the same payload it uses the newest one that is valid on that payload's chain (migrations are checked against their transactions digest), and never one that was checked and found invalid when another is usable.

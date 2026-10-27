---
'@0xsequence/sessions': patch
'@0xsequence/account': patch
---

RemoteConfigTracker: optional `signerWallets` and `providerFor`. For the target chain it reads each signer wallet's `externalImageHash()` and passes it to the key machine as `signerConfigs`, so it returns the signatures that are valid on that chain. `Account.status` passes its chain to `loadPresignedConfiguration`.

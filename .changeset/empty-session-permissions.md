---
'@0xsequence/wallet-primitives': patch
'@0xsequence/wallet-wdk': patch
---

Wallets whose sessions configuration contains an explicit session with no permissions can be read and updated again, and new sessions must now have at least one permission.

- `decodeSessionPermissions` accepts a permission count of zero, matching the encoder and the on-chain decoder, so such a session can be listed and removed.
- `SessionConfig.addExplicitSession` (and the WDK's `addExplicitSession` / `modifyExplicitSession`) reject `permissions` that is not a non-empty array.
- The WDK checks that an updated sessions configuration decodes before saving it or requesting a signature.

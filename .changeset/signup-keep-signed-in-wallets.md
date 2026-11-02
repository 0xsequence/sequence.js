---
'@0xsequence/wallet-wdk': patch
---

Keep wallets that are already signed in on this device when signing up again with the same login. The wallet selector's `create-new` and `abort-signup` results no longer overwrite or delete their sessions, so a second wallet can be created for a login while the first stays signed in

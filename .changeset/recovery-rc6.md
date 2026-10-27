---
'@0xsequence/wallet-wdk': patch
'@0xsequence/wallet-primitives': patch
---

Add the rc6 recovery module and use it by default. Wallets with the recovery module of an earlier release are moved to it on their next configuration update, keeping their recovery signers

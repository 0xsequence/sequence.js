---
'@0xsequence/wallet-wdk': patch
---

Add `credentialId` to passkey sign-up, so a new wallet can be created with a passkey already stored on this device instead of a new one.
Passkey signers built from a stored credential (sign-up with `credentialId`, and login with `credentialId`) now embed the public key's metadata when it has any, so their signatures prove the passkey's image hash.

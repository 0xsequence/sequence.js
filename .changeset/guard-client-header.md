---
'@0xsequence/guard': patch
'@0xsequence/dapp-client': patch
---

The guard client takes optional request headers; dapp-client sends `X-Sequence-Client: dapp-client` with session co-sign requests. Requires the guard to allow the header in CORS before release.

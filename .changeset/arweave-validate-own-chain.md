---
'@0xsequence/sessions': patch
---

ArweaveReader: `validationProviders(chainId)` replaces `validationProvider`, so signatures are checked on their own chain (no-chain-id ones on the chain returned for chain id 0). Migrations are checked against the transactions digest. A signature that can't be checked (no provider, signer without code, RPC error) is preferred over one that was checked and is invalid.

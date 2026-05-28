---
'@0xsequence/dapp-client': minor
---

Add `isSponsored` for explicit sponsorship checks.

`DappClient.isSponsored(chainId, transactions)` and
`ChainSessionManager.isSponsored(calls)` return `true` only when the relayer's
`/FeeOptions` endpoint explicitly reports sponsorship. Any error, network
failure, or absence of sponsorship returns `false`, so a `true` result is
always safe to surface as "free gas" in UI.

Prefer this over inferring sponsorship from an empty `getFeeOptions` array — a
swallowed `/FeeOptions` error also produces an empty array, so the inference
can misclassify a failed quote as a real subsidy. The new method uses the
positive `sponsored: boolean` signal from `@0xsequence/relayer`'s widened
`feeOptions` return.

`getFeeOptions` is unchanged.

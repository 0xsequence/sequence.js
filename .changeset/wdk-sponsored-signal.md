---
'@0xsequence/wallet-wdk': minor
---

Carry `sponsored` / `failed` through `StandardRelayerOption`.

`StandardRelayerOption` now exposes two optional fields:

- `sponsored?: boolean` — populated from the relayer SDK's new `feeOptions`
  return field. `true` means the server confirmed an active sponsorship policy
  match; `false` means it did not (or the quote failed).
- `failed?: boolean` — `true` when the relayer's `feeOptions` call was swallowed
  due to a transport or server error.

Both fields are populated on the empty-options construction branch and the
per-option mapping branch in `transactions.ts`. The new `isStandardRelayerOption`
and `isERC4337RelayerOption` runtime helpers are now re-exported from the
package root for consumers that need to narrow `RelayerOption` before reading
the new fields.

UI / wallet consumers that previously classified sponsorship by "no `feeOption`
attached" should switch to `sponsored === true` so a real subsidy is no longer
indistinguishable from a swallowed `/FeeOptions` error.

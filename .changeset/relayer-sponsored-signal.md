---
'@0xsequence/relayer': minor
---

Surface explicit sponsorship signal on `feeOptions` and an error marker on
`feeOptions` / `feeTokens`.

- `RpcRelayer.feeOptions` now returns `sponsored: boolean`, forwarded from the
  server's `FeeOptionsReturn.sponsored`. The `Relayer` interface and all
  bundled implementations (`RpcRelayer`, `SequenceRelayer`, `LocalRelayer`,
  `EIP6963Relayer`, `PkRelayer`) carry the new field.
- When `feeOptions` swallows a transport / server error it now returns
  `{ options: [], sponsored: false, failed: true }` (was `{ options: [] }`).
- When `feeTokens` swallows an error it now returns
  `{ isFeeRequired: false, failed: true }` (was `{ isFeeRequired: false }`).

These changes are additive — existing consumers that ignore the new fields are
unaffected. Consumers that classified sponsorship by "no fee option attached"
should migrate to `sponsored === true` to distinguish a real subsidy from a
swallowed `/FeeOptions` error.

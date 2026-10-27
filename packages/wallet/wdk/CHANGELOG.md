# @0xsequence/wallet-wdk

## 3.1.3

### Patch Changes

- [#1048](https://github.com/0xsequence/sequence.js/pull/1048) [`012973f`](https://github.com/0xsequence/sequence.js/commit/012973f1808bb6e870115db0570db12ad96aaf13) Thanks [@Agusx1211](https://github.com/Agusx1211)! - Use an unusable placeholder leaf for recovery trees without signers, clean up zero address recovery leaves on every configuration update, and reject recovery leaves for the zero address

- [#1048](https://github.com/0xsequence/sequence.js/pull/1048) [`012973f`](https://github.com/0xsequence/sequence.js/commit/012973f1808bb6e870115db0570db12ad96aaf13) Thanks [@Agusx1211](https://github.com/Agusx1211)! - Add the rc6 recovery module and use it by default. Wallets with the recovery module of an earlier release are moved to it on their next configuration update, keeping their recovery signers

- Updated dependencies [[`eb3ce9c`](https://github.com/0xsequence/sequence.js/commit/eb3ce9c3a41ccd11c5e7cf1b6f21a40743706295), [`012973f`](https://github.com/0xsequence/sequence.js/commit/012973f1808bb6e870115db0570db12ad96aaf13), [`012973f`](https://github.com/0xsequence/sequence.js/commit/012973f1808bb6e870115db0570db12ad96aaf13), [`87874ae`](https://github.com/0xsequence/sequence.js/commit/87874aed1b79432c8f9ff51a2bae7041bfb36a8b)]:
  - @0xsequence/wallet-primitives@3.0.15

## 3.1.2

### Patch Changes

- Remove dead networks
- Updated dependencies
  - @0xsequence/guard@3.0.13
  - @0xsequence/identity-instrument@3.0.13
  - @0xsequence/relayer@3.1.2
  - @0xsequence/wallet-core@3.0.13
  - @0xsequence/wallet-primitives@3.0.13

## 3.1.1

### Patch Changes

- WDK fix
- Updated dependencies
  - @0xsequence/guard@3.0.12
  - @0xsequence/identity-instrument@3.0.12
  - @0xsequence/relayer@3.1.1
  - @0xsequence/wallet-core@3.0.12
  - @0xsequence/wallet-primitives@3.0.12

## 3.1.0

### Minor Changes

- 55121af: Carry `sponsored` / `failed` through `StandardRelayerOption`.

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

### Patch Changes

- Fix for relayer sponsored fees
- Updated dependencies
- Updated dependencies [55121af]
  - @0xsequence/guard@3.0.11
  - @0xsequence/identity-instrument@3.0.11
  - @0xsequence/relayer@3.1.0
  - @0xsequence/wallet-core@3.0.11
  - @0xsequence/wallet-primitives@3.0.11

## 3.0.10

### Patch Changes

- Minor network updates, relayer interface
- Updated dependencies
  - @0xsequence/guard@3.0.10
  - @0xsequence/identity-instrument@3.0.10
  - @0xsequence/relayer@3.0.10
  - @0xsequence/wallet-core@3.0.10
  - @0xsequence/wallet-primitives@3.0.10

## 3.0.9

### Patch Changes

- Fee options fixes
- Updated dependencies
  - @0xsequence/guard@3.0.9
  - @0xsequence/identity-instrument@3.0.9
  - @0xsequence/relayer@3.0.9
  - @0xsequence/wallet-core@3.0.9
  - @0xsequence/wallet-primitives@3.0.9

## 3.0.8

### Patch Changes

- Bug fix for relayer fee options handling
- Updated dependencies
  - @0xsequence/guard@3.0.8
  - @0xsequence/identity-instrument@3.0.8
  - @0xsequence/relayer@3.0.8
  - @0xsequence/wallet-core@3.0.8
  - @0xsequence/wallet-primitives@3.0.8

## 3.0.7

### Patch Changes

- Minor bug fixes
- Updated dependencies
  - @0xsequence/guard@3.0.7
  - @0xsequence/identity-instrument@3.0.7
  - @0xsequence/relayer@3.0.7
  - @0xsequence/wallet-core@3.0.7
  - @0xsequence/wallet-primitives@3.0.7

## 3.0.6

### Patch Changes

- userdata upgrade, arweave support
- Updated dependencies
  - @0xsequence/guard@3.0.6
  - @0xsequence/identity-instrument@3.0.6
  - @0xsequence/relayer@3.0.6
  - @0xsequence/wallet-core@3.0.6
  - @0xsequence/wallet-primitives@3.0.6

## 3.0.5

### Patch Changes

- Account federation support
- Updated dependencies
  - @0xsequence/guard@3.0.5
  - @0xsequence/identity-instrument@3.0.5
  - @0xsequence/relayer@3.0.5
  - @0xsequence/wallet-core@3.0.5
  - @0xsequence/wallet-primitives@3.0.5

## 3.0.4

### Patch Changes

- id-token login support
- Updated dependencies
  - @0xsequence/guard@3.0.4
  - @0xsequence/identity-instrument@3.0.4
  - @0xsequence/relayer@3.0.4
  - @0xsequence/wallet-core@3.0.4
  - @0xsequence/wallet-primitives@3.0.4

## 3.0.3

### Patch Changes

- 3.0.3
- Updated dependencies
  - @0xsequence/guard@3.0.3
  - @0xsequence/identity-instrument@3.0.3
  - @0xsequence/relayer@3.0.3
  - @0xsequence/wallet-core@3.0.3
  - @0xsequence/wallet-primitives@3.0.3

## 3.0.2

### Patch Changes

- allow native self transfer
- Updated dependencies
  - @0xsequence/guard@3.0.2
  - @0xsequence/identity-instrument@3.0.2
  - @0xsequence/relayer@3.0.2
  - @0xsequence/wallet-core@3.0.2
  - @0xsequence/wallet-primitives@3.0.2

## 3.0.1

### Patch Changes

- Network and session fixes
- Updated dependencies
  - @0xsequence/guard@3.0.1
  - @0xsequence/identity-instrument@3.0.1
  - @0xsequence/relayer@3.0.1
  - @0xsequence/wallet-core@3.0.1
  - @0xsequence/wallet-primitives@3.0.1

## 3.0.0

### Patch Changes

- f68be62: ethauth support
- 49d8a2f: New chains, minor fixes
- 3411232: Beta release with dapp connector fixes
- 23cb9e9: New chains, relayer rpc fix
- f5f6a7a: dapp-client updates
- e7de3b1: Fix signer 404 error, minor fixes
- 493836f: multicall3 optimization
- 30e1f1a: 3.0.0 beta
- d5017e8: Beta release for v3
- 24a5fab: Final RC before 3.0.0
- e5e1a03: Apple auth fixes
- 0b63113: Apple auth fix
- a89134a: Userdata service updates
- 7c6c811: 3.0.0-beta.3 with fixes
- 3.0.0 release
- 98ce38b: 3.0.0-beta.2 with identity instrument updates
- 747e6b5: Relayer fee options fix
- 40c19ff: dapp client updates for EOA login
- 6d5de25: 3.0.0-beta.1
- 934acd1: RC5 upgrade
- Updated dependencies [f68be62]
- Updated dependencies [49d8a2f]
- Updated dependencies [3411232]
- Updated dependencies [23cb9e9]
- Updated dependencies [f5f6a7a]
- Updated dependencies [e7de3b1]
- Updated dependencies [493836f]
- Updated dependencies [30e1f1a]
- Updated dependencies [d5017e8]
- Updated dependencies [24a5fab]
- Updated dependencies [e5e1a03]
- Updated dependencies [0b63113]
- Updated dependencies [a89134a]
- Updated dependencies [7c6c811]
- Updated dependencies
- Updated dependencies [98ce38b]
- Updated dependencies [747e6b5]
- Updated dependencies [40c19ff]
- Updated dependencies [6d5de25]
- Updated dependencies [934acd1]
  - @0xsequence/guard@3.0.0
  - @0xsequence/identity-instrument@3.0.0
  - @0xsequence/relayer@3.0.0
  - @0xsequence/wallet-core@3.0.0
  - @0xsequence/wallet-primitives@3.0.0

## 3.0.0-beta.19

### Patch Changes

- Final RC before 3.0.0
- Updated dependencies
  - @0xsequence/guard@3.0.0-beta.19
  - @0xsequence/identity-instrument@3.0.0-beta.19
  - @0xsequence/relayer@3.0.0-beta.19
  - @0xsequence/wallet-core@3.0.0-beta.19
  - @0xsequence/wallet-primitives@3.0.0-beta.19

## 3.0.0-beta.18

### Patch Changes

- multicall3 optimization
- Updated dependencies
  - @0xsequence/guard@3.0.0-beta.18
  - @0xsequence/identity-instrument@3.0.0-beta.18
  - @0xsequence/relayer@3.0.0-beta.18
  - @0xsequence/wallet-core@3.0.0-beta.18
  - @0xsequence/wallet-primitives@3.0.0-beta.18

## 3.0.0-beta.17

### Patch Changes

- New chains, relayer rpc fix
- Updated dependencies
  - @0xsequence/guard@3.0.0-beta.17
  - @0xsequence/identity-instrument@3.0.0-beta.17
  - @0xsequence/relayer@3.0.0-beta.17
  - @0xsequence/wallet-core@3.0.0-beta.17
  - @0xsequence/wallet-primitives@3.0.0-beta.17

## 3.0.0-beta.16

### Patch Changes

- ethauth support
- Updated dependencies
  - @0xsequence/guard@3.0.0-beta.16
  - @0xsequence/identity-instrument@3.0.0-beta.16
  - @0xsequence/relayer@3.0.0-beta.16
  - @0xsequence/wallet-core@3.0.0-beta.16
  - @0xsequence/wallet-primitives@3.0.0-beta.16

## 3.0.0-beta.15

### Patch Changes

- New chains, minor fixes
- Updated dependencies
  - @0xsequence/guard@3.0.0-beta.15
  - @0xsequence/identity-instrument@3.0.0-beta.15
  - @0xsequence/relayer@3.0.0-beta.15
  - @0xsequence/wallet-core@3.0.0-beta.15
  - @0xsequence/wallet-primitives@3.0.0-beta.15

## 3.0.0-beta.14

### Patch Changes

- Relayer fee options fix
- Updated dependencies
  - @0xsequence/guard@3.0.0-beta.14
  - @0xsequence/identity-instrument@3.0.0-beta.14
  - @0xsequence/relayer@3.0.0-beta.14
  - @0xsequence/wallet-core@3.0.0-beta.14
  - @0xsequence/wallet-primitives@3.0.0-beta.14

## 3.0.0-beta.13

### Patch Changes

- Userdata service updates
- Updated dependencies
  - @0xsequence/guard@3.0.0-beta.13
  - @0xsequence/identity-instrument@3.0.0-beta.13
  - @0xsequence/relayer@3.0.0-beta.13
  - @0xsequence/wallet-core@3.0.0-beta.13
  - @0xsequence/wallet-primitives@3.0.0-beta.13

## 3.0.0-beta.12

### Patch Changes

- Beta release with dapp connector fixes
- Updated dependencies
  - @0xsequence/guard@3.0.0-beta.12
  - @0xsequence/identity-instrument@3.0.0-beta.12
  - @0xsequence/relayer@3.0.0-beta.12
  - @0xsequence/wallet-core@3.0.0-beta.12
  - @0xsequence/wallet-primitives@3.0.0-beta.12

## 3.0.0-beta.11

### Patch Changes

- 3.0.0 beta
- Updated dependencies
  - @0xsequence/guard@3.0.0-beta.11
  - @0xsequence/identity-instrument@3.0.0-beta.11
  - @0xsequence/relayer@3.0.0-beta.11
  - @0xsequence/wallet-core@3.0.0-beta.11
  - @0xsequence/wallet-primitives@3.0.0-beta.11

## 3.0.0-beta.10

### Patch Changes

- dapp-client updates
- Updated dependencies
  - @0xsequence/guard@3.0.0-beta.10
  - @0xsequence/identity-instrument@3.0.0-beta.10
  - @0xsequence/relayer@3.0.0-beta.10
  - @0xsequence/wallet-core@3.0.0-beta.10
  - @0xsequence/wallet-primitives@3.0.0-beta.10

## 3.0.0-beta.9

### Patch Changes

- dapp client updates for EOA login
- Updated dependencies
  - @0xsequence/guard@3.0.0-beta.9
  - @0xsequence/identity-instrument@3.0.0-beta.9
  - @0xsequence/relayer@3.0.0-beta.9
  - @0xsequence/wallet-core@3.0.0-beta.9
  - @0xsequence/wallet-primitives@3.0.0-beta.9

## 3.0.0-beta.8

### Patch Changes

- Apple auth fixes
- Updated dependencies
  - @0xsequence/guard@3.0.0-beta.8
  - @0xsequence/identity-instrument@3.0.0-beta.8
  - @0xsequence/relayer@3.0.0-beta.8
  - @0xsequence/wallet-core@3.0.0-beta.8
  - @0xsequence/wallet-primitives@3.0.0-beta.8

## 3.0.0-beta.7

### Patch Changes

- Apple auth fix
- Updated dependencies
  - @0xsequence/guard@3.0.0-beta.7
  - @0xsequence/identity-instrument@3.0.0-beta.7
  - @0xsequence/relayer@3.0.0-beta.7
  - @0xsequence/wallet-core@3.0.0-beta.7
  - @0xsequence/wallet-primitives@3.0.0-beta.7

## 3.0.0-beta.6

### Patch Changes

- Fix signer 404 error, minor fixes
- Updated dependencies
  - @0xsequence/guard@3.0.0-beta.6
  - @0xsequence/identity-instrument@3.0.0-beta.6
  - @0xsequence/relayer@3.0.0-beta.6
  - @0xsequence/wallet-core@3.0.0-beta.6
  - @0xsequence/wallet-primitives@3.0.0-beta.6

## 3.0.0-beta.5

### Patch Changes

- Beta release for v3
- Updated dependencies
  - @0xsequence/guard@3.0.0-beta.5
  - @0xsequence/identity-instrument@3.0.0-beta.5
  - @0xsequence/relayer@3.0.0-beta.5
  - @0xsequence/wallet-core@3.0.0-beta.5
  - @0xsequence/wallet-primitives@3.0.0-beta.5

## 3.0.0-beta.4

### Patch Changes

- RC5 upgrade
- Updated dependencies
  - @0xsequence/guard@3.0.0-beta.4
  - @0xsequence/identity-instrument@3.0.0-beta.4
  - @0xsequence/relayer@3.0.0-beta.4
  - @0xsequence/wallet-core@3.0.0-beta.4
  - @0xsequence/wallet-primitives@3.0.0-beta.4

## 3.0.0-beta.3

### Patch Changes

- 3.0.0-beta.3 with fixes
- Updated dependencies
  - @0xsequence/guard@3.0.0-beta.3
  - @0xsequence/identity-instrument@3.0.0-beta.3
  - @0xsequence/relayer@3.0.0-beta.3
  - @0xsequence/wallet-core@3.0.0-beta.3
  - @0xsequence/wallet-primitives@3.0.0-beta.3

## 3.0.0-beta.2

### Patch Changes

- 3.0.0-beta.2 with identity instrument updates
- Updated dependencies
  - @0xsequence/guard@3.0.0-beta.2
  - @0xsequence/identity-instrument@3.0.0-beta.2
  - @0xsequence/relayer@3.0.0-beta.2
  - @0xsequence/wallet-core@3.0.0-beta.2
  - @0xsequence/wallet-primitives@3.0.0-beta.2

## 3.0.0-beta.1

### Patch Changes

- 3.0.0-beta.1
- Updated dependencies
  - @0xsequence/guard@3.0.0-beta.1
  - @0xsequence/identity-instrument@3.0.0-beta.1
  - @0xsequence/relayer@3.0.0-beta.1
  - @0xsequence/wallet-core@3.0.0-beta.1
  - @0xsequence/wallet-primitives@3.0.0-beta.1

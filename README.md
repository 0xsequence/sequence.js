## sequence.js v3 core libraries and SDK

**NOTE: please see [v2](https://github.com/0xsequence/sequence.js/tree/v2) branch for sequence.js 2.x.x**

---

Sequence v3 core libraries and [wallet-contracts-v3](https://github.com/0xsequence/wallet-contracts-v3) SDK.

## Packages

- `@0xsequence/wallet-primitives`: stateless low-level utilities specifically for interacting directly with sequence wallet's smart contracts
- `@0xsequence/wallet-core`: higher level utilities for creating and using sequence wallets
- `@0xsequence/wallet-wdk`: all-in-one wallet development kit for building a sequence wallet product

## Development

### Getting Started

1. Install dependencies:
   `pnpm install`

2. Build all packages:
   `pnpm build`

### Development Workflow

- Run development mode across all packages:
  `pnpm dev`

- Run tests:
  `pnpm test`

  > **Note:** Tests require [anvil](https://github.com/foundry-rs/foundry/tree/master/anvil) and [forge](https://github.com/foundry-rs/foundry) to be installed. You can run a local anvil instance using `pnpm run test:anvil`.

- Linting and formatting is enforced via git hooks

## License

Apache-2.0

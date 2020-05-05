# arcadeum.js

Javascript &amp; Typescript Encoding Client for Arcadeum Meta-Transaction Relayer

## Usage

## Token encoder

⚠️ encoding only works for implementations of ERC-1155 that conforms to the multi-token-standard (MTS) [specification](https://github.com/arcadeum/multi-token-standard/blob/master/SPECIFICATIONS.md#meta-transactions)

Meta-transactions nonces are used to protect users against replay attacks, MTS implementation keeps next available nonce contract side ([reference](https://github.com/arcadeum/multi-token-standard/blob/master/SPECIFICATIONS.md#nonce))

```typescript
import { TokenEncoder } from 'arcadeum.js'
import { MetaSafeBatchTransferFrom, Opts } from 'arcadeum.js/lib/mts/types'

const encoder = new TokenEncoder(
  CONTRACT_ADDRESS, //'0x123...0'
  WALLET_OR_SIGNER //ethers.Signer
)

// see MTS spec for more meta-tx methods and params types
const call: MetaSafeBatchTransferFrom = {
  type: 'metaSafeBatchTransferFrom',
  params: [receiver, ids, amounts]
}

const options: Opts = {
  nonce: 1,
  gasReceipt: null,
  extra: null
}

const input = await encoder.encode(call, options)

// relayers can now use encoded input to execute meta-tx
await relayer.sendMetaTxn({
  call: {
    contract: CONTRACT_ADDRESS,
    input
  }
})
```

## Niftyswap encoder

[Niftyswap Specification](https://github.com/arcadeum/niftyswap/blob/master/SPECIFICATIONS.md)

⚠️ encoding only works for token pairs that uses implementations of ERC-1155 that conforms to the multi-token-standard (MTS)
[specification](https://github.com/arcadeum/multi-token-standard/blob/master/SPECIFICATIONS.md#meta-transactions)

```typescript
import { NiftyswapEncoder } from 'arcadeum.js'

const encoder = new NiftyswapEncoder(
  NIFTYSWAP_EXCHANGE_ADDRESS, //'0x123...0'
  BASE_CURRENCY_CONTRACT_ADDRESS, //'0x123...0'
  ASSET_CONTRACT_ADDRESS, //'0x123...0'
  WALLET_OR_SIGNER //ethers.Signer
)

const buyOrderEncoding: NiftyswapBuy = {
  type: 'buy',
  recipient: RECIPIENT_ADDRESS,
  transferIds: BASE_CURRENCY_TOKEN_ID,
  transferAmounts: TOTAL_ORDER_COST,
  tokenIdsToBuy: ASSET_IDS,
  tokensAmountsToBuy: ASSET_AMOUNTS,
  deadline: ORDER_DEADLINE
}

const sellOrderEncoding: NiftyswapSell = {
  type: 'sell',
  recipient: RECIPIENT_ADDRESS,
  transferIds: ASSET_IDS,
  transferAmounts: ASSET_AMOUNTS,
  cost: TOTAL_ORDER_COST,
  deadline: ORDER_DEADLINE
}

const buyOrder = await encoder.encode(buyOrderEncoding, txNonce)
const sellOrder = await encoder.encode(sellOrderEncoding, txNonce)

// relayers can now use encoded input to execute meta-tx
await relayer.sendMetaTxn({
  call: {
    contract: CONTRACT_ADDRESS,
    input: buyOrder
  }
})
```

## Universal encoder

TODO: universal txn-relayer and encoding that works with generic contracts without native meta-tx support


--------------

## License
 [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Copyright (c) 2018-present Horizon Blockchain Games Inc.
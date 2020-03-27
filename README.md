# arcadeum.js

Javascript &amp; Typescript Client for Arcadeum Transaction Relayer

## Usage

## multi-token-standard (MTS) encoder

NOTE: encoding only works for implementations of ERC-1155 token standard that conforms to the multi-token-standard [specification](https://github.com/arcadeum/multi-token-standard/blob/master/SPECIFICATIONS.md#meta-transactions)

Meta-transactions nonces are used to protect users against replay attacks, MTS implementation keeps next available nonce contract side ([reference](https://github.com/arcadeum/multi-token-standard/blob/master/SPECIFICATIONS.md#nonce))

```typescript
import { MTSEncoder } from 'arcadeum.js'

const encoder = new MTSEncoder(
  CONTRACT_ADDRESS, //'0x123...0'
  WALLET_OR_SIGNER //ethers.Signer
)

const input = await encoder.encode(
  {
    // see MTS spec for more meta-tx methods and params types
    type: 'metaSafeBatchTransferFrom',
    params: [receiver, ids, amounts]
  },
  {
    // meta-tx nonce
    nonce: 1
    //   gasReceipt
    //   extra
  }
)

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

NOTE: encoding only works for token pairs that uses implementations of ERC-1155 token standard that conforms to the multi-token-standard
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

TODO: universal txn-relayer and encoding that can work with generic contracts

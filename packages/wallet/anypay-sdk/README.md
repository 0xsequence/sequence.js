# @0xsequence/anypay-sdk

> Anypay SDK for sending any token from any chain.

⚠️ This is a work in progress!

## Installation

```bash
npm install @0xsequence/anypay-sdk
```

## Usage

### React Widget Component

The easiest way to integrate Anypay is using our pre-built React widget:

```typescript
import { AnyPayWidget } from '@0xsequence/anypay-sdk/widget'

export const App = () => {
  const sequenceApiKey = import.meta.env.VITE_SEQUENCE_API_KEY

  return (
    <AnyPayWidget
      sequenceApiKey={sequenceApiKey}
    />
  )
}
```

### Low-level API Usage

If you need more control, you can use the low-level APIs directly:

#### Basic Example

```typescript
import { prepareSend } from '@0xsequence/anypay-sdk'
import { createWalletClient, custom } from 'viem'

// Initialize a wallet client
const client = createWalletClient({
  account,
  chain: getChainConfig(chainId),
  transport: custom(window.ethereum),
})

// Prepare and send a transaction
const options = {
  account,
  originTokenAddress: '0x0000000000000000000000000000000000000000', // ETH
  originChainId: 42161, // Arbitrum
  originTokenAmount: '1000000000000000',
  destinationChainId: 8453, // Base
  recipient: '0xYourRecipientAddress',
  destinationTokenAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC on Base
  destinationTokenAmount: '300003', // Amount in USDC decimals (6)
  sequenceApiKey: 'your-api-key',
  fee: '5600000000000',
  client,
}

const { intentAddress, send } = await prepareSend(options)
console.log('Intent address:', intentAddress.toString())

// Send the transaction
await send()
```

#### Advanced Example

```typescript
import {
  getAPIClient,
  getRelayer,
  getIntentCallsPayloads,
  calculateIntentAddress,
  commitIntentConfig,
  sendOriginTransaction,
  getERC20TransferData,
} from '@0xsequence/anypay-sdk'
import { createWalletClient, http } from 'viem'
import { arbitrum } from 'viem/chains'

async function sendCrossChainToken() {
  // Initialize clients
  const apiClient = getAPIClient('http://localhost:4422', process.env.SEQUENCE_API_KEY)
  const originRelayer = getRelayer({ env: 'local' }, originChainId)
  const destinationRelayer = getRelayer({ env: 'local' }, destinationChainId)

  // Create intent
  const args = {
    userAddress: account.address,
    originChainId: 42161,
    originTokenAddress: '0x0000000000000000000000000000000000000000',
    originTokenAmount: '1000000000000000',
    destinationChainId: 8453,
    destinationToAddress: destinationTokenAddress,
    destinationTokenAddress: destinationTokenAddress,
    destinationTokenAmount: destinationTokenAmount,
    destinationCallData: getERC20TransferData(recipient, BigInt(destinationTokenAmount)),
    destinationCallValue: '0',
  }

  const intent = await getIntentCallsPayloads(apiClient, args)

  // Calculate and commit intent
  const intentAddress = calculateIntentAddress(account.address, intent.calls, intent.lifiInfos)
  await commitIntentConfig(apiClient, account.address, intent.calls, intent.preconditions, intent.lifiInfos)

  // Monitor transaction status
  const status = await getMetaTxStatus(relayer, metaTxId, chainId)
  console.log('Transaction status:', status)
}
```

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm run build

# Run tests
pnpm test
```

## License

MIT License

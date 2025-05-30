# anypay-sdk

Anypay SDK for sending any token from any chain.

## Installation

```bash
npm install anypay-sdk
```

## Usage

```typescript
import { AnypaySDK } from 'anypay-sdk'

// Initialize the SDK
const sdk = new AnypaySDK({
  projectAccessKey: 'your-project-key',
  env: 'dev',
  apiUrl: 'https://api.sequence.app',
  useV3Relayers: true, // optional
})

// Get token balances for an address
const balances = await sdk.getTokenBalances('0x...')
console.log('Token balances:', balances.sortedTokens)

// Get meta transaction status
const status = await sdk.getMetaTxnStatus({
  id: '0x...',
  chainId: '1',
})
console.log('Transaction status:', status)

// Get a relayer instance for a specific chain
const relayer = sdk.getRelayer(1) // Ethereum mainnet
```

## Features

- Token balance tracking across multiple chains
- Meta transaction status monitoring
- Relayer management for different chains
- Support for multiple environments (local, dev, prod)
- Built-in sorting and filtering of token balances
- Comprehensive error handling

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

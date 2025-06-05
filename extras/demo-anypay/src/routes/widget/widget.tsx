import { useState } from 'react'
import { AnyPayWidget } from '@0xsequence/anypay-sdk/widget'
import { CustomizationForm } from './components/CustomizationForm'
import { CodeSnippet } from './components/CodeSnippet'

const SUPPORTED_TOKENS = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    imageUrl: 'https://assets.sequence.info/images/tokens/small/1/0x0000000000000000000000000000000000000000.webp',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    imageUrl: 'https://assets.sequence.info/images/tokens/small/1/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.webp',
  },
] as const

const SUPPORTED_CHAINS = [
  { id: 1, name: 'Ethereum', icon: 1 },
  { id: 8453, name: 'Base', icon: 8453 },
  { id: 10, name: 'Optimism', icon: 10 },
  { id: 42161, name: 'Arbitrum', icon: 42161 },
]

export const Widget = () => {
  const sequenceApiKey = import.meta.env.VITE_PROJECT_ACCESS_KEY
  const apiUrl = import.meta.env.VITE_API_URL
  const indexerUrl = import.meta.env.VITE_INDEXER_URL
  const env = import.meta.env.VITE_ENV

  const [toRecipient, setToRecipient] = useState('')
  const [toAmount, setToAmount] = useState('')
  const [toChainId, setToChainId] = useState<number | undefined>()
  const [toToken, setToToken] = useState<'ETH' | 'USDC' | undefined>()

  return (
    <div className="flex flex-col items-center justify-center space-y-8 py-12">
      <div className="text-center space-y-6 max-w-6xl px-4">
        <h1 className="text-4xl font-extrabold text-gray-200">AnyPay Widget Demo</h1>
        <p className="text-xl text-gray-200">
          This demo showcases a multi-step transfer flow using the Anypay SDK. Connect your wallet, select a token,
          specify the amount and recipient, and see the transaction confirmation process in action.
        </p>
      </div>

      <div className="w-full max-w-6xl px-4">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left Column - Config Form */}
          <div className="w-full md:w-1/2">
            <CustomizationForm
              toRecipient={toRecipient}
              setToRecipient={setToRecipient}
              toAmount={toAmount}
              setToAmount={setToAmount}
              toChainId={toChainId}
              setToChainId={setToChainId}
              toToken={toToken}
              setToToken={setToToken}
            />
          </div>

          {/* Right Column - Code Snippet */}
          <div className="w-full md:w-1/2">
            <CodeSnippet toRecipient={toRecipient} toAmount={toAmount} toChainId={toChainId} toToken={toToken} />
          </div>
        </div>
      </div>

      <div className="w-full max-w-6xl px-4">
        <AnyPayWidget
          sequenceApiKey={sequenceApiKey}
          apiUrl={apiUrl}
          indexerUrl={indexerUrl}
          env={env}
          toRecipient={toRecipient || undefined}
          toAmount={toAmount || undefined}
          toChainId={toChainId}
          toToken={toToken}
        />
      </div>
    </div>
  )
}

export default Widget

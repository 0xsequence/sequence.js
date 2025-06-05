import { AnyPayWidget } from '@0xsequence/anypay-sdk/widget'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

const SUPPORTED_TOKENS = [
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'USDC', name: 'USD Coin' },
] as const

export const Widget = () => {
  const sequenceApiKey = import.meta.env.VITE_PROJECT_ACCESS_KEY
  const apiUrl = import.meta.env.VITE_API_URL
  const indexerUrl = import.meta.env.VITE_INDEXER_URL
  const env = import.meta.env.VITE_ENV

  const [toRecipient, setToRecipient] = useState('')
  const [toAmount, setToAmount] = useState('')
  const [toChainId, setToChainId] = useState<number | undefined>()
  const [toToken, setToToken] = useState<'ETH' | 'USDC' | undefined>()
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeExample)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  const codeExample = `import { AnyPayWidget } from '@0xsequence/anypay-sdk/widget'

export const App = () => {
  return (
    <AnyPayWidget
      sequenceApiKey={'key_123...'}${toRecipient ? `\n      toRecipient="${toRecipient}"` : ''}${toAmount ? `\n      toAmount="${toAmount}"` : ''}${toChainId ? `\n      toChainId={${toChainId}}` : ''}${toToken ? `\n      toToken="${toToken}"` : ''}
    />
  )
}`

  return (
    <div className="flex flex-col items-center justify-center space-y-8 py-12">
      <div className="text-center space-y-6 max-w-4xl px-4">
        <h1 className="text-4xl font-extrabold text-gray-200">AnyPay Widget Demo</h1>
        <p className="text-xl text-gray-200">
          This demo showcases a multi-step transfer flow using the Anypay SDK. Connect your wallet, select a token,
          specify the amount and recipient, and see the transaction confirmation process in action.
        </p>
      </div>

      <div className="w-full max-w-4xl px-4">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left Column - Config Form */}
          <div className="w-full md:w-1/2">
            <div className="bg-gray-800 rounded-lg p-6 h-full">
              <h2 className="text-2xl font-bold text-gray-200 mb-4">Customize Widget</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">Recipient Address</label>
                  <input
                    type="text"
                    value={toRecipient}
                    onChange={(e) => setToRecipient(e.target.value.trim())}
                    placeholder="0x..."
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">Amount</label>
                  <input
                    type="text"
                    value={toAmount}
                    onChange={(e) => setToAmount(e.target.value.trim())}
                    placeholder="0.00"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">Chain ID</label>
                  <select
                    value={toChainId || ''}
                    onChange={(e) => setToChainId(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Chain</option>
                    <option value="1">Ethereum (1)</option>
                    <option value="10">Optimism (10)</option>
                    <option value="42161">Arbitrum (42161)</option>
                    <option value="8453">Base (8453)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">Token</label>
                  <select
                    value={toToken || ''}
                    onChange={(e) => setToToken(e.target.value as 'ETH' | 'USDC' | undefined)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Token</option>
                    {SUPPORTED_TOKENS.map((token) => (
                      <option key={token.symbol} value={token.symbol}>
                        {token.name} ({token.symbol})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Code Snippet */}
          <div className="w-full md:w-1/2">
            <div className="bg-gray-800 rounded-lg p-6 h-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-200">Integration Example</h2>
                <button
                  onClick={handleCopy}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 cursor-pointer rounded-lg text-gray-200 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <div className="rounded-lg overflow-hidden">
                <SyntaxHighlighter
                  language="tsx"
                  style={vscDarkPlus}
                  customStyle={{
                    margin: 0,
                    borderRadius: '0.5rem',
                    background: '#1a1a1a',
                    height: '100%',
                  }}
                >
                  {codeExample}
                </SyntaxHighlighter>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-4xl px-4">
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

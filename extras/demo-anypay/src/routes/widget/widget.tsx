import { AnyPayWidget } from '@0xsequence/anypay-sdk/widget'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useState, useRef, useEffect } from 'react'
import { Copy, Check, ChevronDown } from 'lucide-react'
import { NetworkImage, TokenImage } from '@0xsequence/design-system'

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
  const [isCopied, setIsCopied] = useState(false)
  const [isChainDropdownOpen, setIsChainDropdownOpen] = useState(false)
  const [isTokenDropdownOpen, setIsTokenDropdownOpen] = useState(false)
  const chainDropdownRef = useRef<HTMLDivElement>(null)
  const tokenDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chainDropdownRef.current && !chainDropdownRef.current.contains(event.target as Node)) {
        setIsChainDropdownOpen(false)
      }
      if (tokenDropdownRef.current && !tokenDropdownRef.current.contains(event.target as Node)) {
        setIsTokenDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

                <div className="space-y-2" ref={chainDropdownRef}>
                  <label className="block text-sm font-medium text-gray-200 mb-2">Chain ID</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsChainDropdownOpen(!isChainDropdownOpen)}
                      className="w-full flex items-center px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg hover:border-gray-500 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {toChainId ? (
                        <>
                          <NetworkImage chainId={toChainId} size="sm" className="w-5 h-5" />
                          <span className="ml-2 flex-1 text-left text-gray-200">
                            {SUPPORTED_CHAINS.find((chain) => chain.id === toChainId)?.name} ({toChainId})
                          </span>
                        </>
                      ) : (
                        <span className="flex-1 text-left text-gray-400">Select Chain</span>
                      )}
                      <ChevronDown
                        className={`h-5 w-5 text-gray-400 transition-transform ${isChainDropdownOpen ? 'transform rotate-180' : ''}`}
                      />
                    </button>

                    {isChainDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg">
                        {SUPPORTED_CHAINS.map((chain) => (
                          <button
                            key={chain.id}
                            type="button"
                            onClick={() => {
                              setToChainId(chain.id)
                              setIsChainDropdownOpen(false)
                            }}
                            className={`w-full flex items-center px-4 py-3 hover:bg-gray-600 ${
                              toChainId === chain.id ? 'bg-gray-600 text-blue-400' : 'text-gray-200'
                            }`}
                          >
                            <NetworkImage chainId={chain.icon} size="sm" className="w-5 h-5" />
                            <span className="ml-2">
                              {chain.name} ({chain.id})
                            </span>
                            {toChainId === chain.id && <span className="ml-auto text-blue-400">•</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2" ref={tokenDropdownRef}>
                  <label className="block text-sm font-medium text-gray-200 mb-2">Token</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsTokenDropdownOpen(!isTokenDropdownOpen)}
                      className="w-full flex items-center px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg hover:border-gray-500 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {toToken ? (
                        <>
                          <TokenImage
                            symbol={toToken}
                            src={SUPPORTED_TOKENS.find((t) => t.symbol === toToken)?.imageUrl}
                            size="sm"
                          />
                          <span className="ml-2 flex-1 text-left text-gray-200">
                            {SUPPORTED_TOKENS.find((t) => t.symbol === toToken)?.name} ({toToken})
                          </span>
                        </>
                      ) : (
                        <span className="flex-1 text-left text-gray-400">Select Token</span>
                      )}
                      <ChevronDown
                        className={`h-5 w-5 text-gray-400 transition-transform ${isTokenDropdownOpen ? 'transform rotate-180' : ''}`}
                      />
                    </button>

                    {isTokenDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg">
                        {SUPPORTED_TOKENS.map((token) => (
                          <button
                            key={token.symbol}
                            type="button"
                            onClick={() => {
                              setToToken(token.symbol as 'ETH' | 'USDC')
                              setIsTokenDropdownOpen(false)
                            }}
                            className={`w-full flex items-center px-4 py-3 hover:bg-gray-600 ${
                              toToken === token.symbol ? 'bg-gray-600 text-blue-400' : 'text-gray-200'
                            }`}
                          >
                            <TokenImage symbol={token.symbol} src={token.imageUrl} size="sm" />
                            <span className="ml-2">
                              {token.name} ({token.symbol})
                            </span>
                            {toToken === token.symbol && <span className="ml-auto text-blue-400">•</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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

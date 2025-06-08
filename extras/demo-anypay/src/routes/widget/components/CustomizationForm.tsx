import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { NetworkImage, TokenImage } from '@0xsequence/design-system'

const SUPPORTED_CHAINS = [
  { id: 1, name: 'Ethereum', icon: 1 },
  { id: 8453, name: 'Base', icon: 8453 },
  { id: 10, name: 'Optimism', icon: 10 },
  { id: 42161, name: 'Arbitrum', icon: 42161 },
]

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

interface CustomizationFormProps {
  toRecipient: string
  setToRecipient: (value: string) => void
  toAmount: string
  setToAmount: (value: string) => void
  toChainId: number | undefined
  setToChainId: (value: number | undefined) => void
  toToken: 'ETH' | 'USDC' | undefined
  setToToken: (value: 'ETH' | 'USDC' | undefined) => void
  toCalldata: string
  setToCalldata: (value: string) => void
  useCustomButton: boolean
  setUseCustomButton: (value: boolean) => void
  renderInline: boolean
  setRenderInline: (value: boolean) => void
  theme: 'light' | 'dark' | 'auto'
  setTheme: (value: 'light' | 'dark' | 'auto') => void
}

// Local storage keys
const STORAGE_KEYS = {
  RECIPIENT: 'anypay_recipient',
  AMOUNT: 'anypay_amount',
  CHAIN_ID: 'anypay_chain_id',
  TOKEN: 'anypay_token',
  CALLDATA: 'anypay_calldata',
  CUSTOM_BUTTON: 'anypay_custom_button',
  RENDER_INLINE: 'anypay_render_inline',
} as const

export const CustomizationForm: React.FC<CustomizationFormProps> = ({
  toRecipient,
  setToRecipient,
  toAmount,
  setToAmount,
  toChainId,
  setToChainId,
  toToken,
  setToToken,
  toCalldata,
  setToCalldata,
  useCustomButton,
  setUseCustomButton,
  renderInline,
  setRenderInline,
  theme,
  setTheme,
}) => {
  const [isTokenDropdownOpen, setIsTokenDropdownOpen] = useState(false)
  const [isChainDropdownOpen, setIsChainDropdownOpen] = useState(false)

  const tokenDropdownRef = useRef<HTMLDivElement>(null)
  const chainDropdownRef = useRef<HTMLDivElement>(null)

  // Load saved values from localStorage on mount
  useEffect(() => {
    const savedRecipient = localStorage.getItem(STORAGE_KEYS.RECIPIENT)
    const savedAmount = localStorage.getItem(STORAGE_KEYS.AMOUNT)
    const savedChainId = localStorage.getItem(STORAGE_KEYS.CHAIN_ID)
    const savedToken = localStorage.getItem(STORAGE_KEYS.TOKEN) as 'ETH' | 'USDC' | undefined
    const savedCalldata = localStorage.getItem(STORAGE_KEYS.CALLDATA)
    const savedCustomButton = localStorage.getItem(STORAGE_KEYS.CUSTOM_BUTTON)
    const savedRenderInline = localStorage.getItem(STORAGE_KEYS.RENDER_INLINE)
    if (savedRecipient) setToRecipient(savedRecipient)
    if (savedAmount) setToAmount(savedAmount)
    if (savedChainId) setToChainId(Number(savedChainId))
    if (savedToken) setToToken(savedToken)
    if (savedCalldata) setToCalldata(savedCalldata)
    if (savedCustomButton) setUseCustomButton(savedCustomButton === 'true')
    if (savedRenderInline) setRenderInline(savedRenderInline === 'true')
  }, [])

  // Save values to localStorage whenever they change
  useEffect(() => {
    if (toRecipient) localStorage.setItem(STORAGE_KEYS.RECIPIENT, toRecipient)
    else localStorage.removeItem(STORAGE_KEYS.RECIPIENT)
  }, [toRecipient])

  useEffect(() => {
    if (toAmount) localStorage.setItem(STORAGE_KEYS.AMOUNT, toAmount)
    else localStorage.removeItem(STORAGE_KEYS.AMOUNT)
  }, [toAmount])

  useEffect(() => {
    if (toChainId) localStorage.setItem(STORAGE_KEYS.CHAIN_ID, toChainId.toString())
    else localStorage.removeItem(STORAGE_KEYS.CHAIN_ID)
  }, [toChainId])

  useEffect(() => {
    if (toToken) localStorage.setItem(STORAGE_KEYS.TOKEN, toToken)
    else localStorage.removeItem(STORAGE_KEYS.TOKEN)
  }, [toToken])

  useEffect(() => {
    if (toCalldata) localStorage.setItem(STORAGE_KEYS.CALLDATA, toCalldata)
    else localStorage.removeItem(STORAGE_KEYS.CALLDATA)
  }, [toCalldata])

  // Save custom button state to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_BUTTON, useCustomButton.toString())
  }, [useCustomButton])

  useEffect(() => {
    if (renderInline) localStorage.setItem(STORAGE_KEYS.RENDER_INLINE, renderInline.toString())
    else localStorage.removeItem(STORAGE_KEYS.RENDER_INLINE)
  }, [renderInline])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tokenDropdownRef.current && !tokenDropdownRef.current.contains(event.target as Node)) {
        setIsTokenDropdownOpen(false)
      }
      if (chainDropdownRef.current && !chainDropdownRef.current.contains(event.target as Node)) {
        setIsChainDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleReset = () => {
    // Clear form state
    setToRecipient('')
    setToAmount('')
    setToChainId(undefined)
    setToToken(undefined)
    setToCalldata('')
    setUseCustomButton(false)
    setRenderInline(false)
    // Clear localStorage
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key)
    })
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 h-full">
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-200">Customize Widget</h2>
          <p className="text-sm text-gray-400 mt-1">All fields are optional. Use these to preset the widget's state.</p>
        </div>
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

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">Calldata</label>
            <textarea
              value={toCalldata}
              onChange={(e) => setToCalldata(e.target.value.trim())}
              placeholder="0x..."
              rows={4}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <label className="block text-sm font-medium text-gray-200">Custom Button</label>
            <button
              onClick={() => setUseCustomButton(!useCustomButton)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                useCustomButton ? 'bg-blue-500' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  useCustomButton ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-2">
            <label className="block text-sm font-medium text-gray-200">Render Inline</label>
            <button
              onClick={() => setRenderInline(!renderInline)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                renderInline ? 'bg-blue-500' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  renderInline ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-2">
            <label className="block text-sm font-medium text-gray-200">Theme Mode</label>
            <div className="flex rounded-lg overflow-hidden border border-gray-600">
              {(['auto', 'light', 'dark'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setTheme(mode)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    theme === mode ? 'bg-blue-500 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors duration-200 text-sm font-medium border border-gray-600 hover:border-gray-500"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

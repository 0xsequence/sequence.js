import { useState, useCallback } from 'react'
import { AnyPayWidget } from '@0xsequence/anypay-sdk/widget'
import { CustomizationForm } from './components/CustomizationForm'
import { CodeSnippet } from './components/CodeSnippet'
import { AppKitProvider, ConnectButton } from './components/ConnectWallet'

export const Widget = () => {
  const sequenceApiKey = import.meta.env.VITE_PROJECT_ACCESS_KEY
  const apiUrl = import.meta.env.VITE_API_URL
  const indexerUrl = import.meta.env.VITE_INDEXER_URL
  const env = import.meta.env.VITE_ENV

  const [toRecipient, setToRecipient] = useState('')
  const [toAmount, setToAmount] = useState('')
  const [toChainId, setToChainId] = useState<number | undefined>()
  const [toToken, setToToken] = useState<'ETH' | 'USDC' | undefined>()
  const [toCalldata, setToCalldata] = useState('')
  const [renderInline, setRenderInline] = useState(false)
  const [useCustomButton, setUseCustomButton] = useState(false)
  const [provider, setProvider] = useState<any>(null)
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto' | null>(null)

  const handleConnect = useCallback((provider: any) => {
    console.log('provider', provider)
    setProvider(provider)
  }, [])

  const content = (
    <div className="flex flex-col items-center justify-center space-y-8 py-12">
      <div className="text-center space-y-6 max-w-6xl px-4">
        <h1 className="text-3xl font-extrabold text-white mb-4">AnyPay Widget Demo</h1>
        <p className="text-sm text-white leading-relaxed max-w-3xl mx-auto font-light">
          This demo showcases a multi-step transfer flow using the <span className="font-medium">AnyPay SDK</span>.
          Connect your wallet, select a token, specify the amount and recipient, and see the transaction confirmation
          process in action.
        </p>

        <ConnectButton onConnect={handleConnect} />
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
              toCalldata={toCalldata}
              setToCalldata={setToCalldata}
              useCustomButton={useCustomButton}
              setUseCustomButton={setUseCustomButton}
              setRenderInline={setRenderInline}
              renderInline={renderInline}
              theme={theme}
              setTheme={setTheme}
            />
          </div>

          {/* Right Column - Code Snippet */}
          <div className="w-full md:w-1/2">
            <CodeSnippet
              toRecipient={toRecipient}
              toAmount={toAmount}
              toChainId={toChainId}
              toToken={toToken}
              toCalldata={toCalldata}
              useCustomButton={useCustomButton}
              renderInline={renderInline}
              theme={theme}
            >
              <div className="mt-6 w-full max-w-md mx-auto">
                <AnyPayWidget
                  sequenceApiKey={sequenceApiKey}
                  apiUrl={apiUrl}
                  indexerUrl={indexerUrl}
                  env={env}
                  toRecipient={toRecipient || undefined}
                  toAmount={toAmount || undefined}
                  toChainId={toChainId}
                  toToken={toToken}
                  toCalldata={toCalldata || undefined}
                  provider={provider}
                  renderInline={renderInline}
                  theme={theme}
                >
                  {useCustomButton ? (
                    <button className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold shadow-lg hover:from-green-600 hover:to-emerald-600 cursor-pointer transition duration-300">
                      Pay with AnyPay
                    </button>
                  ) : null}
                </AnyPayWidget>
              </div>
            </CodeSnippet>
          </div>
        </div>
      </div>
    </div>
  )

  return <AppKitProvider>{content}</AppKitProvider>
}

export default Widget

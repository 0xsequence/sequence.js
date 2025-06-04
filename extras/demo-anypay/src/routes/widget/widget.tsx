import { AnyPayWidget } from '@0xsequence/anypay-sdk/widget'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

export const Widget = () => {
  const sequenceApiKey = import.meta.env.VITE_PROJECT_ACCESS_KEY
  const apiUrl = import.meta.env.VITE_API_URL
  const indexerUrl = import.meta.env.VITE_INDEXER_URL
  // const env = import.meta.env.VITE_ENV

  const codeExample = `import { AnyPayWidget } from '@0xsequence/anypay-sdk/widget'

export const App = () => {
  return (
    <AnyPayWidget
      sequenceApiKey={'key_123...'}
    />
  )
}`

  return (
    <div className="flex flex-col items-center justify-center space-y-8 py-12">
      <div className="text-center space-y-6 max-w-2xl px-4">
        <h1 className="text-4xl font-extrabold text-gray-200">AnyPay Widget Demo</h1>
        <p className="text-xl text-gray-200">
          This demo showcases a multi-step transfer flow using the Anypay SDK. Connect your wallet, select a token,
          specify the amount and recipient, and see the transaction confirmation process in action.
        </p>
      </div>

      <div className="w-full max-w-2xl bg-gray-800 rounded-lg p-6 mb-8">
        <h2 className="text-2xl font-bold text-gray-200 mb-4">Integration Example</h2>
        <div className="rounded-lg overflow-hidden">
          <SyntaxHighlighter
            language="tsx"
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              borderRadius: '0.5rem',
              background: '#1a1a1a',
            }}
          >
            {codeExample}
          </SyntaxHighlighter>
        </div>
      </div>

      <AnyPayWidget sequenceApiKey={sequenceApiKey} apiUrl={apiUrl} indexerUrl={indexerUrl} />
    </div>
  )
}

export default Widget

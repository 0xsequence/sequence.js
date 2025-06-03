import { AnyPayWidget } from '@anypay/sdk/widget'

export const Widget = () => {
  const sequenceApiKey = import.meta.env.VITE_SEQUENCE_API_KEY
  const apiUrl = import.meta.env.VITE_API_URL || 'https://api.sequence.app'
  const indexerUrl = import.meta.env.VITE_INDEXER_URL || 'https://indexer.sequence.app'

  return (
    <div className="flex flex-col items-center justify-center space-y-8 py-12">
      <div className="text-center space-y-6 max-w-2xl px-4">
        <h1 className="text-4xl font-extrabold text-gray-200">Anypay Transfer Demo</h1>
        <p className="text-xl text-gray-200">
          This demo showcases a multi-step transfer flow using the Anypay SDK. Connect your wallet, select a token,
          specify the amount and recipient, and see the transaction confirmation process in action.
        </p>
      </div>

      <AnyPayWidget sequenceApiKey={sequenceApiKey} apiUrl={apiUrl} indexerUrl={indexerUrl} />
    </div>
  )
}

export default Widget
